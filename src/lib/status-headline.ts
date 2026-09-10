import { getPhaseState } from "./phase-status";
import { getPhaseDelay, todayIso } from "./phase-delay";
import { formatDateEs, daysBetween } from "./format-date-es";

/**
 * Titular de estado del Panel 1 de la home («¿Cómo va?»), 100% derivado de
 * datos: nunca un copy fijo que pueda mentir. Tabla de decisión en orden
 * estricto (ver spec del Tríptico §5.1); la misma derivación de retraso que
 * usa la página El camino (getPhaseDelay), así no pueden contradecirse.
 */

export type HeadlineTone = "jet" | "amber" | "jet-saffron";

export interface StatusHeadline {
  /** Número de regla de la tabla de decisión que aplicó (1-7). */
  rule: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  headline: string;
  /** Coletilla de la regla 4 («— y depende de ti» / «— el estudio está en ello»). */
  detail?: string;
  /** true si la coletilla debe anclar al Panel 2 («depende de ti»). */
  dependsOnYou?: boolean;
  tone: HeadlineTone;
  /** Chip auxiliar ya humanizado («Objetivo de la fase: …», «Arranque: …»). */
  chip?: string | null;
}

interface HeadlinePhase {
  id: string;
  phase_number: string;
  name: string;
  status?: string | null;
  order_index: number;
  end_date?: string | null;
  target_end_date?: string | null;
}

interface HeadlineProject {
  status?: string | null;
  current_phase_id?: string | null;
  start_date?: string | null;
  estimated_end_date?: string | null;
}

interface HeadlineDecision {
  status?: string | null;
  phase_id?: string | null;
}

function byOrder(phases: HeadlinePhase[]): HeadlinePhase[] {
  return [...phases].sort((a, b) => a.order_index - b.order_index);
}

/** "Fase 9" → "la Fase 9"; "9" → "la Fase 9". */
function phaseRef(phaseNumber: string): string {
  const n = (phaseNumber || "").trim();
  return /^fase\b/i.test(n) ? `la ${n}` : `la Fase ${n}`;
}

/**
 * Fase activa: la apuntada por current_phase_id; si no, la primera `current`
 * y en su defecto la primera `pending` (criterio histórico del dashboard).
 */
export function getActivePhase(
  phases: HeadlinePhase[],
  currentPhaseId?: string | null
): HeadlinePhase | null {
  const sorted = byOrder(phases);
  return (
    sorted.find((p) => p.id === currentPhaseId) ||
    sorted.find((p) => getPhaseState(p.status) === "current") ||
    sorted.find((p) => getPhaseState(p.status) === "pending") ||
    null
  );
}

export function getStatusHeadline(input: {
  project: HeadlineProject;
  phases: HeadlinePhase[];
  decisions?: HeadlineDecision[];
  today?: string;
}): StatusHeadline {
  const { project, phases, decisions = [], today = todayIso() } = input;

  // 1. Pausado
  if (project.status === "Pausado") {
    return { rule: 1, headline: "Tu proyecto está en pausa", tone: "jet" };
  }

  // 2. Finalizado
  if (project.status === "Finalizado") {
    return { rule: 2, headline: "Tu casa está terminada", tone: "jet-saffron" };
  }

  const sorted = byOrder(phases);

  // 3. Activo sin arrancar (todas las fases quietas, o sin fases)
  if (!sorted.length || sorted.every((p) => getPhaseState(p.status) === "pending")) {
    return {
      rule: 3,
      headline: "Tu proyecto arranca pronto",
      tone: "jet",
      chip: project.start_date ? `Arranque: ${formatDateEs(project.start_date)}` : null,
    };
  }

  const active = getActivePhase(sorted, project.current_phase_id);

  // 4. Fase activa bloqueada
  if (active && getPhaseState(active.status) === "blocked") {
    const dependsOnYou = decisions.some(
      (d) => d.status === "Pendiente" && d.phase_id === active.id
    );
    return {
      rule: 4,
      headline: "En espera: hay un punto por resolver",
      detail: dependsOnYou ? "— y depende de ti" : "— el estudio está en ello",
      dependsOnYou,
      tone: "amber",
    };
  }

  // 5. Alguna fase ABIERTA pasada de su fecha objetivo (retraso accionable)
  const openDelayed = sorted
    .map((p) => ({ phase: p, delay: getPhaseDelay(p, today) }))
    .filter((x) => x.delay && !x.delay.closed);
  if (openDelayed.length) {
    const pick = openDelayed.find((x) => x.phase.id === active?.id) || openDelayed[0];
    const days = pick.delay!.days;
    const dayText = days === 1 ? "1 día" : `${days} días`;
    const where =
      pick.phase.id === active?.id ? "de esta fase" : `de ${phaseRef(pick.phase.phase_number)}`;
    return {
      rule: 5,
      headline: `En marcha, con ${dayText} sobre el objetivo ${where}`,
      tone: "amber",
      chip: `Objetivo de la fase: ${formatDateEs(pick.phase.target_end_date)}`,
    };
  }

  // 6. Con objetivo y sin retraso abierto
  if (active?.target_end_date) {
    return { rule: 6, headline: "En marcha, al día con el objetivo", tone: "jet" };
  }

  // 7. Sin dato de objetivo: no se afirma «al día» sin dato
  return { rule: 7, headline: "En marcha", tone: "jet" };
}

/**
 * La fila de la fecha de entrega («La fecha, siempre»): qué caso pintar.
 * La redacción exacta vive en la home; aquí solo la derivación.
 */
export type DeliveryLine =
  | { kind: "estimate"; dateIso: string }
  | { kind: "paused"; dateIso: string | null }
  | { kind: "delivered"; dateIso: string | null }
  | { kind: "unset" };

export function getDeliveryLine(
  project: HeadlineProject,
  phases: HeadlinePhase[]
): DeliveryLine {
  if (project.status === "Finalizado") {
    const done = phases
      .filter((p) => getPhaseState(p.status) === "complete" && p.end_date)
      .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)));
    return { kind: "delivered", dateIso: done[0]?.end_date ?? null };
  }
  if (project.status === "Pausado") {
    return { kind: "paused", dateIso: project.estimated_end_date ?? null };
  }
  if (!project.estimated_end_date) return { kind: "unset" };
  return { kind: "estimate", dateIso: project.estimated_end_date };
}

/** Hito reciente: última fase completada (Validada/Finalizada) con end_date
 *  en los últimos 14 días. Devuelve null si no hay ninguna. */
export function getRecentMilestone(
  phases: HeadlinePhase[],
  today: string = todayIso()
): { phaseNumber: string; name: string; endDate: string } | null {
  const recent = phases
    .filter((p) => getPhaseState(p.status) === "complete" && p.end_date)
    .filter((p) => {
      const days = daysBetween(p.end_date!, today);
      return days >= 0 && days <= 14;
    })
    .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)));
  const hit = recent[0];
  return hit ? { phaseNumber: hit.phase_number, name: hit.name, endDate: hit.end_date! } : null;
}
