import { weekLabel } from "./week-label";
import { formatDayMonthEs } from "./format-date-es";

/**
 * Agregador del Panel 2 de la home («¿Qué me toca a mí?»). Reúne TODO lo que
 * espera respuesta del cliente, venga de donde venga: decisiones formales,
 * fases pendientes de su revisión, tareas de la última acta confirmada y las
 * decisiones sueltas del último parte de obra. También produce la sub-lista
 * «En manos del estudio» (cosas suyas que ya respondió y esperan al estudio),
 * con traducciones fijas: jamás «Votado»/«En revisión» en crudo.
 */

export type ClientActionSection = "decisions" | "phases" | "meetings";

export interface ClientAction {
  key: string;
  verb: "Decidir" | "Revisar" | "Ver acta" | "Responder";
  title: string;
  /** Línea de origen ya humanizada («antes del 3 de junio · hay recomendación…»). */
  origin: string;
  section: ClientActionSection;
  dueDateIso: string | null;
  urgent: boolean;
  hasRecommendation: boolean;
}

export interface StudioItem {
  key: string;
  text: string;
}

interface AggDecision {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  created_at?: string;
  phase_id?: string | null;
  studio_recommendation?: string | null;
}

interface AggPhase {
  id: string;
  phase_number: string;
  name: string;
  status?: string | null;
  order_index: number;
}

interface AggMeeting {
  id: string;
  meeting_date: string;
  client_tasks?: string | null;
  status?: string | null;
}

interface AggUpdate {
  id: string;
  week_number: number;
  created_at?: string;
  decisions_needed?: string | null;
}

interface AggRequest {
  id: string;
  category: string;
  status?: string | null;
  created_at: string;
}

const PRIORITY_ORDER: Record<string, number> = { Urgente: 0, Alta: 1, Media: 2, Baja: 3 };

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "o", "u", "en", "para", "por",
  "un", "una", "unos", "unas", "al", "a", "con", "que", "se", "su", "sus",
  "lo", "le", "es", "vs", "antes", "tras", "sobre", "entre", "sin", "mas",
]);

/** minúsculas, sin acentos ni signos, espacios colapsados. */
export function normalizeText(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Textos del estudio que en realidad dicen «nada» («Ninguna incidencia…»,
 * «Sin novedades», «No hay decisiones pendientes»): no generan acción ni
 * tarjeta de imprevisto.
 */
export function isNoOpStudioText(value?: string | null): boolean {
  const n = normalizeText(value);
  if (!n) return true;
  return /^(ninguna|ninguno|ningun|sin|no hay)\b/.test(n);
}

/** Las actas antiguas sin estado se consideran confirmadas; las `borrador` no
 *  existen para el cliente. */
export function isConfirmedMeeting(meeting: { status?: string | null }): boolean {
  return !meeting.status || meeting.status === "confirmada";
}

/**
 * ¿El texto libre del parte se refiere a una decisión formal ya listada?
 * Coincidencia por contención del título normalizado o por solapamiento de
 * sus palabras significativas (≥60%): el estudio no repite el título literal.
 */
export function textsMatch(decisionTitle: string, freeText: string): boolean {
  const title = normalizeText(decisionTitle);
  const text = normalizeText(freeText);
  if (!title || !text) return false;
  if (text.includes(title) || title.includes(text)) return true;
  const words = title.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (!words.length) return false;
  const textWords = new Set(text.split(" "));
  const hits = words.filter((w) => textWords.has(w)).length;
  return hits / words.length >= 0.6;
}

/** "Fase 4" → "Fase 4"; "4" → "Fase 4". */
function phaseRef(phaseNumber: string): string {
  const n = (phaseNumber || "").trim();
  return /^fase\b/i.test(n) ? n : `Fase ${n}`;
}

export function buildClientActions(input: {
  decisions?: AggDecision[];
  phases?: AggPhase[];
  meetings?: AggMeeting[];
  weeklyUpdates?: AggUpdate[];
  requests?: AggRequest[];
  /** Hoy en ISO (aaaa-mm-dd), para saber si un plazo ya pasó. Por defecto, la fecha de Madrid. */
  today?: string;
}): { actions: ClientAction[]; studio: StudioItem[] } {
  const today = input.today ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
  const {
    decisions = [],
    phases = [],
    meetings = [],
    weeklyUpdates = [],
    requests = [],
  } = input;

  const actions: ClientAction[] = [];

  // 1. Decisiones pendientes → Decidir
  const pending = decisions
    .filter((d) => d.status === "Pendiente")
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority || ""] ?? 4;
      const pb = PRIORITY_ORDER[b.priority || ""] ?? 4;
      if (pa !== pb) return pa - pb;
      const da = a.due_date || "9999-12-31";
      const db = b.due_date || "9999-12-31";
      if (da !== db) return da.localeCompare(db);
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
  for (const d of pending) {
    // Un plazo vencido no puede decir «antes del…»: dice cuándo era y pasa a urgente
    const overdue = !!d.due_date && d.due_date.slice(0, 10) < today;
    actions.push({
      key: `dec-${d.id}`,
      verb: "Decidir",
      title: d.title,
      origin: [
        d.due_date ? (overdue ? `el plazo era el ${formatDayMonthEs(d.due_date)}` : `antes del ${formatDayMonthEs(d.due_date)}`) : null,
        d.studio_recommendation ? "hay recomendación del estudio" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      section: "decisions",
      dueDateIso: d.due_date ?? null,
      urgent: d.priority === "Urgente" || overdue,
      hasRecommendation: !!d.studio_recommendation,
    });
  }

  // 2. Fases esperando el visto bueno del cliente → Revisar
  const reviews = phases
    .filter((p) => normalizeText(p.status) === "pendiente de revision cliente")
    .sort((a, b) => a.order_index - b.order_index);
  for (const p of reviews) {
    actions.push({
      key: `phase-${p.id}`,
      verb: "Revisar",
      title: `Revisa la ${phaseRef(p.phase_number)}: ${p.name}`,
      origin: "El estudio espera tu visto bueno",
      section: "phases",
      dueDateIso: null,
      urgent: false,
      hasRecommendation: false,
    });
  }

  // 3. Tareas del cliente del acta confirmada más reciente → Ver acta
  const acta = meetings
    .filter(isConfirmedMeeting)
    .filter((m) => !isNoOpStudioText(m.client_tasks))
    .sort((a, b) => String(b.meeting_date).localeCompare(String(a.meeting_date)))[0];
  if (acta) {
    actions.push({
      key: `meet-${acta.id}`,
      verb: "Ver acta",
      title: (acta.client_tasks || "").trim(),
      origin: `Acordado en la reunión del ${formatDayMonthEs(acta.meeting_date)}`,
      section: "meetings",
      dueDateIso: null,
      urgent: false,
      hasRecommendation: false,
    });
  }

  // 4. Decisiones sueltas del ÚLTIMO parte → Responder (con dedupe contra 1)
  const latest = [...weeklyUpdates].sort(
    (a, b) =>
      b.week_number - a.week_number ||
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
  )[0];
  if (latest && !isNoOpStudioText(latest.decisions_needed)) {
    const duplicated = pending.some((d) => textsMatch(d.title, latest.decisions_needed!));
    if (!duplicated) {
      actions.push({
        key: `wup-${latest.id}`,
        verb: "Responder",
        title: (latest.decisions_needed || "").trim(),
        origin: `Del parte de la ${weekLabel(latest.week_number)}`,
        section: "meetings",
        dueDateIso: null,
        urgent: false,
        hasRecommendation: false,
      });
    }
  }

  // Sub-lista «En manos del estudio» (sin CTA; traducciones fijas)
  const studio: StudioItem[] = [];
  for (const d of decisions.filter((d) => d.status === "En revisión")) {
    studio.push({
      key: `dec-${d.id}`,
      text: `${d.title} · pediste una revisión — esperando respuesta del estudio`,
    });
  }
  for (const d of decisions.filter((d) => d.status === "Votado")) {
    studio.push({
      key: `dec-${d.id}`,
      text: `${d.title} · tu elección está registrada — el estudio la confirma en breve`,
    });
  }
  for (const r of requests.filter((r) => r.status === "Pendiente")) {
    studio.push({
      key: `req-${r.id}`,
      text: `Tu ${r.category.toLowerCase()} del ${formatDayMonthEs(r.created_at)} — pendiente de respuesta`,
    });
  }

  return { actions, studio };
}
