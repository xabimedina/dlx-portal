import "server-only";
import { COL_CLIENTS, COL_PROJECTS } from "./config";
import type { Profile } from "./profile";
import type {
  PortalClient,
  PortalProject,
  PortalPhase,
  PortalMeeting,
  PortalDecision,
  PortalDocument,
  PortalWeeklyUpdate,
  PortalPhoto,
  PortalRequest,
} from "@/types/portal";

/**
 * Capa de LECTURA de datos sobre Firestore (Admin SDK, servidor).
 *
 * Estructura de datos (todo cuelga del proyecto). Las colecciones raíz llevan
 * el prefijo `portal_` para no chocar con las del resto del ecosistema DLX
 * (ver ./config.ts):
 *   portal_users/{uid}                  perfiles de staff
 *   portal_clients/{clientId}           ficha de cliente (datos de contacto)
 *   portal_projects/{projectId}         proyecto; authorized_emails es la
 *                                       lista de acceso de los clientes
 *     ├─ phases/{id}
 *     ├─ decisions/{id}
 *     ├─ meetings/{id}
 *     ├─ documents/{id}
 *     ├─ weeklyUpdates/{id}
 *     └─ photos/{id}
 *
 * Los nombres de campo se mantienen en snake_case (project_id, full_name,
 * meeting_date, file_url…) idénticos al modelo anterior, para que la interfaz
 * no tenga que cambiar.
 */

async function db() {
  const { adminDb } = await import("./admin");
  return adminDb();
}

function docData<T = any>(snap: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T;
}

function listData<T = any>(snap: FirebaseFirestore.QuerySnapshot): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
}

// ---------- Autorización por email (lista authorized_emails) ----------

/**
 * ¿Puede este perfil ver esta obra? Staff siempre; un cliente solo si su
 * email VERIFICADO está en authorized_emails. Es la misma comprobación que
 * hacen las Security Rules; aquí se repite porque el portal lee con el
 * Admin SDK (que las omite).
 */
export function canProfileReadProject(project: PortalProject, profile: Profile): boolean {
  if (profile.role === "admin") return true;
  if (!profile.email_verified || !profile.email) return false;
  return (project.authorized_emails ?? []).includes(profile.email);
}

/** Obras cuya lista de autorizados contiene el email verificado del perfil. */
export async function getProjectsForProfile(profile: Profile): Promise<PortalProject[]> {
  if (!profile.email_verified || !profile.email) return [];
  const snap = await (await db())
    .collection(COL_PROJECTS)
    .where("authorized_emails", "array-contains", profile.email)
    .get();
  return listData<PortalProject>(snap);
}

// ---------- Clientes y proyectos ----------

export async function getProject(projectId: string): Promise<PortalProject | null> {
  return docData<PortalProject>(await (await db()).collection(COL_PROJECTS).doc(projectId).get());
}

export async function listProjects(): Promise<PortalProject[]> {
  const snap = await (await db()).collection(COL_PROJECTS).orderBy("created_at", "desc").get();
  return listData<PortalProject>(snap);
}

export async function listClients(): Promise<PortalClient[]> {
  const snap = await (await db()).collection(COL_CLIENTS).orderBy("created_at", "desc").get();
  return listData<PortalClient>(snap);
}

/**
 * Devuelve el proyecto si el perfil tiene acceso (admin: cualquiera;
 * cliente: solo si su email verificado está autorizado). Si no, null.
 */
export async function getProjectForAccess(projectId: string, profile: Profile): Promise<PortalProject | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  return canProfileReadProject(project, profile) ? project : null;
}

// ---------- Subcolecciones ----------

async function sub(projectId: string, name: string) {
  return (await db()).collection(COL_PROJECTS).doc(projectId).collection(name);
}

export async function getPhases(projectId: string): Promise<PortalPhase[]> {
  const snap = await (await sub(projectId, "phases")).orderBy("order_index", "asc").get();
  return listData<PortalPhase>(snap);
}

export async function getMeetings(projectId: string): Promise<PortalMeeting[]> {
  const snap = await (await sub(projectId, "meetings")).orderBy("meeting_date", "desc").get();
  return listData<PortalMeeting>(snap);
}

export async function getRequests(projectId: string): Promise<PortalRequest[]> {
  const snap = await (await sub(projectId, "requests")).orderBy("created_at", "desc").get();
  return listData<PortalRequest>(snap);
}

export async function getDecisions(projectId: string): Promise<PortalDecision[]> {
  const snap = await (await sub(projectId, "decisions")).orderBy("created_at", "desc").get();
  return listData<PortalDecision>(snap);
}

export async function getDocuments(projectId: string): Promise<PortalDocument[]> {
  const snap = await (await sub(projectId, "documents")).orderBy("created_at", "desc").get();
  return listData<PortalDocument>(snap);
}

export async function getWeeklyUpdates(projectId: string): Promise<PortalWeeklyUpdate[]> {
  const snap = await (await sub(projectId, "weeklyUpdates")).orderBy("created_at", "desc").get();
  return listData<PortalWeeklyUpdate>(snap);
}

export async function getPhotos(projectId: string): Promise<PortalPhoto[]> {
  const snap = await (await sub(projectId, "photos")).orderBy("created_at", "desc").get();
  return listData<PortalPhoto>(snap);
}

/**
 * Localiza el project_id de una decisión por su id (búsqueda en grupo de colecciones).
 */
export async function getProjectIdFromDecision(decisionId: string): Promise<string | null> {
  const snap = await (await db())
    .collectionGroup("decisions")
    .where("id", "==", decisionId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return (snap.docs[0].data() as any).project_id || null;
}

// ---------- Agregados globales (paneles de administración) ----------

/**
 * Consulta de grupo de colecciones: recorre la subcolección `name` de TODOS los
 * proyectos a la vez (p. ej. todas las decisiones del estudio). Sin orderBy para
 * no requerir índices compuestos; el orden/recuento se resuelve en la página.
 */
async function listGroup<T>(name: string): Promise<T[]> {
  const snap = await (await db()).collectionGroup(name).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as T[];
}

export async function listAllDecisions(): Promise<PortalDecision[]> { return listGroup<PortalDecision>("decisions"); }
export async function listAllWeeklyUpdates(): Promise<PortalWeeklyUpdate[]> { return listGroup<PortalWeeklyUpdate>("weeklyUpdates"); }
