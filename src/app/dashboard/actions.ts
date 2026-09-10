"use server";

import { revalidatePath } from 'next/cache';
import { COL_PROJECTS } from '@/lib/firebase/config';
import { getUserProfile } from '@/lib/firebase/profile';
import { canProfileReadProject, getProject, getProjectIdFromDecision } from '@/lib/firebase/db';
import { extractProjectIdFromPath } from '@/lib/firebase/storage-paths';

const now = () => new Date().toISOString();

/** Longitud máxima de los textos que escribe el cliente (comentarios, solicitudes). */
const MAX_TEXT_LENGTH = 2000;

/** Estados desde los que el cliente puede responder una decisión. Una decisión
 *  ya 'Validada' o 'Cancelado' solo la reabre el estudio desde Obras. */
const CLIENT_EDITABLE_DECISION_STATUSES = ['Pendiente', 'En revisión', 'Votado'];

/** Categorías de solicitud admitidas (las mismas que ofrece la interfaz). */
const REQUEST_CATEGORIES = ['Tema para la próxima reunión', 'Revisión', 'Consulta'];

/** Verifica que el usuario logueado tenga acceso al proyecto: staff siempre;
 *  cliente solo si su email verificado está en authorized_emails de la obra. */
async function validateClientProjectAccess(projectId: string): Promise<{ authorized: boolean; error?: string }> {
  const profile = await getUserProfile();
  if (!profile) return { authorized: false, error: "Acceso denegado: Usuario no autenticado." };
  if (profile.role === 'admin') return { authorized: true };

  const project = await getProject(projectId);
  if (!project || !canProfileReadProject(project, profile)) {
    return { authorized: false, error: "Acceso denegado: No tienes autorización sobre este proyecto." };
  }
  return { authorized: true };
}

/** Aplica un cambio de estado a una decisión (Firestore), validando que
 *  su estado actual admita respuesta del cliente. */
async function updateDecisionStatus(decisionId: string, fields: Record<string, string | null>) {
  const projectId = await getProjectIdFromDecision(decisionId);
  if (!projectId) throw new Error("La decisión seleccionada no existe.");

  const check = await validateClientProjectAccess(projectId);
  if (!check.authorized) throw new Error(check.error || "Acceso denegado.");

  const { adminDb } = await import('@/lib/firebase/admin');
  const decisionRef = adminDb().collection(COL_PROJECTS).doc(projectId).collection('decisions').doc(decisionId);

  const snap = await decisionRef.get();
  if (!snap.exists) throw new Error("La decisión seleccionada no existe.");
  const currentStatus = snap.data()?.status;
  if (!CLIENT_EDITABLE_DECISION_STATUSES.includes(currentStatus)) {
    throw new Error(
      `Esta decisión ya está cerrada y no admite cambios; si necesitas reabrirla, contacta con el estudio.`
    );
  }

  await decisionRef.update(fields);
}

/** Normaliza y limita un texto escrito por el cliente. */
function sanitizeClientText(value: string | null | undefined, label: string): string {
  const text = (value || '').trim();
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`${label} es demasiado largo (máximo ${MAX_TEXT_LENGTH} caracteres).`);
  }
  return text;
}

/** Valida una decisión (estado 'Validada'). El comentario es opcional. */
export async function validateDecisionAction(decisionId: string, clientResponse: string) {
  const text = sanitizeClientText(clientResponse, "El comentario");
  await updateDecisionStatus(decisionId, { client_response: text, validated_at: now(), status: 'Validada' });
  revalidatePath('/dashboard', 'layout');
}

/** Solicita una revisión de una decisión (estado 'En revisión'). Exige motivo. */
export async function requestDecisionReviewAction(decisionId: string, clientComment: string) {
  const text = sanitizeClientText(clientComment, "El motivo de la revisión");
  if (!text) throw new Error("Escribe el motivo por el que solicitas la revisión.");
  await updateDecisionStatus(decisionId, { client_response: text, validated_at: null, status: 'En revisión' });
  revalidatePath('/dashboard', 'layout');
}

/**
 * Genera una URL firmada transitoria (60 s) para descargar un documento privado
 * desde Firebase Storage, validando antes la propiedad del proyecto.
 */
export async function getSignedDocumentUrlAction(storagePath: string): Promise<string> {
  const projectId = extractProjectIdFromPath(storagePath);
  if (!projectId) throw new Error("Ruta de archivo inválida: solo se firman archivos del portal (portal/projects/...).");

  const check = await validateClientProjectAccess(projectId);
  if (!check.authorized) throw new Error(check.error || "Acceso denegado: no autorizado a descargar este archivo.");

  try {
    const { adminBucket } = await import('@/lib/firebase/admin');
    const [url] = await adminBucket().file(storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 1000,
    });
    return url;
  } catch (error: any) {
    console.error(`Error al generar la URL firmada para ${storagePath}:`, error);
    throw new Error("No se pudo generar la firma temporal de descarga del archivo.");
  }
}


/** El cliente registra una solicitud (revisión, tema para la próxima reunión o consulta).
 *  Queda registrada en el portal en vez de perderse por WhatsApp o correo. */
export async function createClientRequestAction(projectId: string, category: string, message: string) {
  if (!REQUEST_CATEGORIES.includes(category)) {
    return { success: false, error: "Categoría de solicitud no válida." };
  }
  const text = (message || '').trim();
  if (!text) return { success: false, error: "Escribe el contenido de la solicitud." };
  if (text.length > MAX_TEXT_LENGTH) {
    return { success: false, error: `La solicitud es demasiado larga (máximo ${MAX_TEXT_LENGTH} caracteres).` };
  }

  const check = await validateClientProjectAccess(projectId);
  if (!check.authorized) return { success: false, error: check.error || "Acceso denegado." };

  const id = `req-${Date.now()}`;
  const record = { id, project_id: projectId, category, message: text, status: 'Pendiente' as const, created_at: now() };

  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    await adminDb().collection(COL_PROJECTS).doc(projectId).collection('requests').doc(id).set(record);
    revalidatePath('/dashboard', 'layout');
    return { success: true, request: record };
  } catch (error: any) {
    console.error("Error al registrar la solicitud del cliente:", error);
    return { success: false, error: "No se pudo registrar la solicitud." };
  }
}
