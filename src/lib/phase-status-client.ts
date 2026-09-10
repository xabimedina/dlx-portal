import { getPhaseState, type PhaseState } from "./phase-status";

/**
 * Tabla de mapeo de estados internos de fase → lenguaje cliente. Es la ÚNICA
 * vía de pintado de estados de fase en el portal: ninguna cadena interna
 * ("Bloqueada", "Pendiente de revisión cliente"…) puede llegar al DOM del
 * cliente. El color/categoría visual sigue saliendo de getPhaseState.
 */
const LABELS: Record<string, string> = {
  "no iniciada": "Por llegar",
  "en desarrollo": "En marcha",
  "pendiente de revisión cliente": "Esperando tu revisión",
  "pendiente de revision cliente": "Esperando tu revisión",
  "pendiente de cambios": "Ajustando tus cambios",
  "validada": "Validada por ti",
  "bloqueada": "En espera",
  "finalizada": "Completada",
};

/** Estados históricos laxos no contemplados en la tabla: se resuelven por la
 *  categoría visual, para que ningún estado desconocido se pinte en crudo. */
const FALLBACK: Record<PhaseState, string> = {
  complete: "Completada",
  current: "En marcha",
  blocked: "En espera",
  pending: "Por llegar",
};

export function phaseStatusClientLabel(status: string | null | undefined): string {
  const key = (status ?? "").trim().toLowerCase();
  return LABELS[key] ?? FALLBACK[getPhaseState(status)];
}
