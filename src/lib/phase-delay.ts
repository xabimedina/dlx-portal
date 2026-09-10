import { getPhaseState } from "./phase-status";

/**
 * Retraso derivado de la fecha objetivo de una fase (target_end_date, fijada
 * desde dlx-admin). Nunca se almacena: se calcula comparando el objetivo con
 * hoy (fase abierta) o con la fecha real de fin (fase cerrada). Espejo de
 * dlx-admin/src/pages/obras/detail/phase-delay.ts adaptado a los estados
 * laxos del portal (se normalizan con getPhaseState).
 */

const MS_PER_DAY = 86_400_000;

/** "YYYY-MM-DD" de hoy en hora local (las fechas del módulo son date-only). */
export function todayIso(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export interface PhaseDelay {
  days: number;
  /** true si la fase ya está cerrada: retraso histórico, no accionable. */
  closed: boolean;
}

export function getPhaseDelay(
  phase: {
    status?: string | null;
    end_date?: string | null;
    target_end_date?: string | null;
  },
  today: string = todayIso()
): PhaseDelay | null {
  const target = phase.target_end_date;
  if (!target) return null;
  const closed = getPhaseState(phase.status) === "complete";
  const reference = closed ? phase.end_date : today;
  if (!reference) return null;
  const days = Math.round((Date.parse(reference) - Date.parse(target)) / MS_PER_DAY);
  if (!Number.isFinite(days) || days <= 0) return null;
  return { days, closed };
}
