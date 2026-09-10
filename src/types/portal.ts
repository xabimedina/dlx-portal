/**
 * Modelo de datos del portal (colecciones portal_* del proyecto Firebase
 * compartido `despejalapp`).
 *
 * ⚠️ MANTENER EN SINCRONÍA con `dlx-admin-main/src/types/portal.ts` (módulo
 * Obras): son los MISMOS documentos leídos desde dos apps. Cualquier cambio
 * de campo o de estado se hace en los dos archivos a la vez.
 *
 * Divergencias deliberadas respecto al archivo de dlx-admin (documentadas):
 *  - `PortalMeeting.status` es opcional aquí: las actas antiguas del portal
 *    no llevaban estado y se consideran confirmadas. Obras siempre lo escribe.
 *  - `PortalPhoto.original_url` es opcional aquí: campo heredado de las
 *    primeras subidas del portal; Obras ya no lo escribe.
 */

export type ProjectStage = "project" | "construction" | "handover";
export type ProjectStatus = "Activo" | "Pausado" | "Finalizado";
export type ProjectType = "Reforma" | "Obra Nueva" | "Interiorismo";

export type PhaseStatus =
  | "No iniciada"
  | "En desarrollo"
  | "Pendiente de revisión cliente"
  | "Pendiente de cambios"
  | "Validada"
  | "Bloqueada"
  | "Finalizada";

export type DecisionStatus =
  | "Pendiente"
  | "Votado"
  | "Validada"
  | "En revisión"
  | "Cancelado";

export type DecisionPriority = "Baja" | "Media" | "Alta" | "Urgente";

export type MeetingStatus = "borrador" | "confirmada";

export type DocumentStatus = "Borrador" | "Revisión" | "Aprobado" | "Obsoleto";
export type DocumentCategory =
  | "Plano"
  | "Contrato"
  | "Presupuesto"
  | "Licencia"
  | "Acta"
  | "Factura";

export type RequestStatus = "Pendiente" | "Atendida";
export type RequestCategory = "Revisión" | "Tema para la próxima reunión" | "Consulta";

export interface PortalClient {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  /** Obsoleto (modelo antiguo de cuentas con contraseña); se conserva solo
   *  para leer fichas creadas antes del acceso por email link. */
  user_id: string | null;
  created_at: string;
}

export interface PortalProject {
  id: string;
  client_id: string;
  name: string;
  address: string;
  project_type: ProjectType;
  current_stage: ProjectStage;
  current_phase_id: string | null;
  status: ProjectStatus;
  start_date: string | null;
  estimated_end_date: string | null;
  /** Historial de replanificaciones de la entrega estimada, escrito por
   *  dlx-admin. Uso interno del estudio; el portal no lo muestra al cliente. */
  reschedules?: Array<{
    from: string;
    to: string | null;
    reason: string;
    created_at: string;
  }>;
  /** Emails (en minúsculas) autorizados a ver esta obra en el portal. Es la
   *  lista de control de acceso: la mantiene el módulo Obras de dlx-admin y
   *  la comprueban tanto el servidor del portal como las Security Rules.
   *  Opcional porque las obras anteriores al acceso por email link no la
   *  tienen (equivale a lista vacía: nadie salvo staff). */
  authorized_emails?: string[];
  created_at: string;
}

export interface PortalPhase {
  id: string;
  project_id: string;
  phase_number: string;
  name: string;
  description: string;
  stage: ProjectStage;
  status: PhaseStatus;
  order_index: number;
  start_date: string | null;
  end_date: string | null;
  /** Fecha objetivo de fin ("YYYY-MM-DD") fijada desde dlx-admin. El retraso
   *  se deriva de ella (ver lib/phase-delay.ts); las fases antiguas no la tienen. */
  target_end_date?: string | null;
  /** Historial de replanificaciones escrito por dlx-admin ({from, to, reason,
   *  created_at}). El portal no lo muestra al cliente (uso interno del
   *  estudio); se tipa para que el documento viaje completo. */
  reschedules?: Array<{
    from: string;
    to: string | null;
    reason: string;
    created_at: string;
  }>;
  created_at: string;
}

export interface PortalDecision {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  description: string;
  status: DecisionStatus;
  priority: DecisionPriority;
  due_date: string | null;
  studio_recommendation: string | null;
  client_response: string | null;
  validated_at: string | null;
  created_at: string;
}

export interface PortalMeeting {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  meeting_date: string;
  summary: string | null;
  decisions_summary: string | null;
  studio_tasks: string | null;
  client_tasks: string | null;
  next_steps: string | null;
  /** Las actas antiguas sin estado se consideran confirmadas. */
  status?: MeetingStatus;
  created_at: string;
}

export interface PortalDocument {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  category: DocumentCategory;
  version: string;
  status: DocumentStatus;
  file_url: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface PortalWeeklyUpdate {
  id: string;
  project_id: string;
  week_number: number;
  title: string;
  summary: string;
  progress_percentage: number;
  current_work: string | null;
  next_steps: string | null;
  issues: string | null;
  decisions_needed: string | null;
  attendees?: string | null;
  warranty_info?: string | null;
  recommendations?: string | null;
  created_at: string;
}

export interface PortalPhoto {
  id: string;
  project_id: string;
  phase_id: string | null;
  weekly_update_id: string | null;
  meeting_id?: string | null;
  /** Una foto siempre nace adjunta a un acta, parte o decisión desde dlx-admin. */
  decision_id?: string | null;
  room: string | null;
  caption: string | null;
  /** Heredado de las primeras subidas del portal; Obras ya no lo escribe. */
  original_url?: string | null;
  image_url: string;
  thumbnail_url: string;
  storage_path: string;
  thumbnail_storage_path: string;
  original_file_size: number | null;
  compressed_file_size: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface PortalRequest {
  id: string;
  project_id: string;
  category: RequestCategory;
  message: string;
  status: RequestStatus;
  created_at: string;
}
