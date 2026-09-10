/**
 * Punto único de verdad para el estado visual de una fase.
 *
 * El modelo de datos histórico acumuló dos vocabularios mezclados
 * ("No iniciada / En desarrollo / Validada / Finalizada" y
 *  "Pendiente / En Curso / Completado"). Para que el timeline y los
 * paneles nunca pinten una fase como "error" por un estado no contemplado,
 * todo estado se normaliza aquí a una de cuatro categorías canónicas.
 */
export type PhaseState = "complete" | "current" | "blocked" | "pending";

const COMPLETE = new Set([
  "completado",
  "completada",
  "finalizada",
  "finalizado",
  "validada",
  "validado",
  "entregada",
]);

const CURRENT = new Set([
  "en desarrollo",
  "en curso",
  "pendiente de revisión cliente",
  "pendiente de revision cliente",
  "pendiente de cambios",
  "pendiente de validación",
  "pendiente de validacion",
  "revisión",
  "revision",
  "en revisión",
  "en revision",
]);

const BLOCKED = new Set([
  "bloqueada",
  "bloqueado",
]);

/**
 * Devuelve la categoría visual de una fase a partir de su estado textual.
 * Cualquier estado no reconocido se trata como "pending" (quieto, nunca error).
 */
export function getPhaseState(status: string | null | undefined): PhaseState {
  const s = (status ?? "").trim().toLowerCase();
  if (COMPLETE.has(s)) return "complete";
  if (BLOCKED.has(s)) return "blocked";
  if (CURRENT.has(s)) return "current";
  // "No iniciada", "Pendiente" y cualquier desconocido → pendiente
  return "pending";
}
