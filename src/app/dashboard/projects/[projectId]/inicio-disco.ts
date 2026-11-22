import { getPhaseState } from "@/lib/phase-status";
import { daysBetween, formatDateEs } from "@/lib/format-date-es";
import { CLOSING_WEEK_NUMBER } from "@/lib/week-label";
import type { DeliveryLine } from "@/lib/status-headline";

/**
 * El «disco de ahora» de Inicio, derivado SOLO de datos reales (módulo puro, sin React).
 *
 * - La línea va de la primera fecha conocida del proyecto (inicio del proyecto o de una
 *   fase) a las llaves (entrega estimada o real). Si falta alguno de los dos extremos, la
 *   línea pasa a ser ordinal (una casilla por fase) y no se afirma ninguna escala de tiempo.
 * - Nudos: las fases completadas, en su fecha real de cierre: `end_date` o, si no la hay,
 *   el `start_date` de la fase siguiente (el estudio valida una fase y abre la siguiente en
 *   la misma operación). Las que no tienen ninguna de las dos se reparten en orden entre
 *   sus vecinas con fecha, sin inventar una fecha concreta.
 * - El disco se posa en hoy. Su relleno Saffron es el % de avance del ÚLTIMO parte semanal,
 *   y solo en obra o después (un parte es «avance de obra»; pintarlo bajo PROYECTO lo
 *   atribuiría mal). Sin %: el disco lleva el número de la fase en curso y ningún relleno.
 * - La llamada «AVANCE REAL · +N puntos» solo existe si los dos últimos partes tienen %.
 */

export type Etapa = "project" | "construction" | "handover";

export interface DiscoPhase {
  id: string;
  phase_number: string;
  name: string;
  stage: Etapa;
  status?: string | null;
  order_index: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface DiscoUpdate {
  id: string;
  week_number: number;
  progress_percentage?: number | null;
  created_at?: string | null;
}

export interface DiscoData {
  /** false si no hay nada real que dibujar (ni fases, ni fechas, ni %): se omite el dibujo. */
  drawable: boolean;
  /** true: escala de tiempo real; false: una casilla por fase (faltan fechas). */
  timeScaled: boolean;
  /** Fases completadas, 0–1 sobre la línea, en orden. */
  nodes: { id: string; frac: number }[];
  /** Hoy sobre la línea (0–1): donde se posa el disco. */
  now: number;
  /** Etapa del «ahora». */
  stage: Etapa;
  delivered: boolean;
  /** % del último parte (0–100), o null si no hay que pintarlo. */
  progress: number | null;
  /** Número de la fase en curso cuando no hay % («01», «2.1»). */
  numeral: string | null;
  /** Llamada lateral: diferencia con el parte anterior y su contexto en dos líneas. */
  callout: { delta: number; deltaText: string; context: [string, string] } | null;
  /** Subtítulo de cada etiqueta (vacío = no se pinta la etiqueta). */
  labels: Record<Etapa, string>;
  /** Descripción completa para `aria-label`. */
  aria: string;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function isoDay(value?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Días desde una época fija (sin husos: se trocea el string, como format-date-es). */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** "2026-09-19" → "19 sep"; con otro año que el de hoy, "19 sep 2025". */
export function fechaCorta(value: string | null | undefined, today: string): string {
  const iso = isoDay(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const year = iso.slice(0, 4) !== today.slice(0, 4) ? ` ${y}` : "";
  return `${d} ${MESES_CORTOS[m - 1]}${year}`;
}

/** "Fase 9" → "09"; "Fase 2.1" → "2.1"; sin cifras, tal cual. */
export function phaseNumeral(phaseNumber: string): string {
  const m = /(\d+(?:\.\d+)?)/.exec(phaseNumber || "");
  if (!m) return (phaseNumber || "").trim();
  return m[1].includes(".") ? m[1] : m[1].padStart(2, "0");
}

function parteRef(week: number): string {
  return week === CLOSING_WEEK_NUMBER ? "parte de cierre" : `parte ${week}`;
}

function puntos(n: number): string {
  return n === 1 ? "1 punto" : `${n} puntos`;
}

export function buildDisco(input: {
  phases: DiscoPhase[];
  activePhaseId: string | null;
  currentStage: Etapa;
  projectStart?: string | null;
  delivery: DeliveryLine;
  updates: DiscoUpdate[];
  today: string;
}): DiscoData {
  const { activePhaseId, delivery, today } = input;
  const phases = [...input.phases].sort((a, b) => a.order_index - b.order_index);
  const delivered = delivery.kind === "delivered";
  const stage: Etapa = delivered ? "handover" : input.currentStage;
  const isDone = (p: DiscoPhase) => getPhaseState(p.status) === "complete";

  // Cierre real de cada fase completada
  const closeOf = new Map<string, string | null>();
  phases.forEach((p, i) => {
    if (!isDone(p)) return;
    closeOf.set(p.id, isoDay(p.end_date) ?? isoDay(phases[i + 1]?.start_date) ?? null);
  });

  // Extremos de la línea
  const known = [
    isoDay(input.projectStart),
    ...phases.map((p) => isoDay(p.start_date)),
    ...Array.from(closeOf.values()),
  ].filter((v): v is string => !!v);
  const t0 = known.length ? known.reduce((a, b) => (a < b ? a : b)) : null;
  const keysIso = delivery.kind === "unset" ? null : isoDay(delivery.dateIso);
  const timeScaled = !!t0 && !!keysIso && dayNumber(keysIso) > dayNumber(t0);

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const frac = (iso: string) =>
    clamp01((dayNumber(iso) - dayNumber(t0!)) / (dayNumber(keysIso!) - dayNumber(t0!)));

  const n = phases.length;
  const activeIndex = phases.findIndex((p) => p.id === activePhaseId);
  const doneCount = phases.filter(isDone).length;

  let now: number;
  if (delivered) now = 1;
  else if (timeScaled) now = frac(isoDay(today)!);
  else if (n === 0) now = 0;
  else if (activeIndex >= 0) now = (activeIndex + 0.5) / n;
  else now = doneCount / n;

  // Nudos
  const nodes: { id: string; frac: number }[] = [];
  if (timeScaled) {
    const done = phases.filter(isDone);
    const anchors = done.map((p) => {
      const c = closeOf.get(p.id);
      return c ? Math.min(frac(c), now) : null;
    });
    let prev = 0;
    for (let i = 0; i < done.length; i++) {
      let f = anchors[i];
      if (f === null) {
        // Hueco sin fecha: se reparte en orden entre la vecina anterior y la siguiente con fecha
        let j = i;
        while (j < done.length && anchors[j] === null) j++;
        const next = j < done.length ? Math.max(anchors[j]!, prev) : now;
        const gap = j - i;
        for (let k = 0; k < gap; k++) {
          anchors[i + k] = prev + ((k + 1) / (gap + 1)) * (next - prev);
        }
        f = anchors[i]!;
      }
      f = Math.max(f, prev);
      anchors[i] = f;
      prev = f;
      nodes.push({ id: done[i].id, frac: f });
    }
  } else if (n > 0) {
    phases.forEach((p, i) => {
      if (isDone(p)) nodes.push({ id: p.id, frac: Math.min((i + 0.5) / n, delivered ? 1 : now) });
    });
  }

  // El % del último parte (por semana, nunca por el orden del array)
  const updates = [...input.updates].sort(
    (a, b) =>
      b.week_number - a.week_number ||
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  const latest = updates[0];
  const previous = updates[1];
  const hasPct = (u?: DiscoUpdate) =>
    !!u && typeof u.progress_percentage === "number" && Number.isFinite(u.progress_percentage);
  const progress =
    stage !== "project" && hasPct(latest)
      ? Math.round(Math.min(100, Math.max(0, latest.progress_percentage!)))
      : null;

  const active = activeIndex >= 0 ? phases[activeIndex] : null;
  const lastDone = [...phases].reverse().find(isDone);
  const numeral = progress === null ? (active ? phaseNumeral(active.phase_number) : lastDone ? phaseNumeral(lastDone.phase_number) : null) : null;

  let callout: DiscoData["callout"] = null;
  if (progress !== null && hasPct(previous)) {
    const delta = Math.round(latest.progress_percentage! - previous!.progress_percentage!);
    const deltaText = delta > 0 ? `+${puntos(delta)}` : delta < 0 ? `−${puntos(-delta)}` : "Sin cambios";
    const fresh = latest.created_at ? daysBetween(latest.created_at, today) <= 7 : false;
    const ref = parteRef(latest.week_number);
    // «esta semana» solo si el parte es de estos días; si no, se dice de qué parte es
    const context: [string, string] = fresh
      ? ["esta semana", ref]
      : latest.week_number === CLOSING_WEEK_NUMBER
        ? ["en el parte", "de cierre"]
        : ["en el parte", `de la semana ${latest.week_number}`];
    callout = { delta, deltaText, context };
  }

  // Etiquetas con fechas reales
  const proj = phases.filter((p) => p.stage === "project");
  const obra = phases.filter((p) => p.stage === "construction");
  const projStart = isoDay(input.projectStart) ?? (proj.length ? isoDay(proj[0].start_date) : null) ?? t0;

  let proyecto = "";
  if (proj.length) {
    if (proj.every(isDone)) {
      const a = phaseNumeral(proj[0].phase_number);
      const b = phaseNumeral(proj[proj.length - 1].phase_number);
      proyecto = proj.length === 1 ? "hecho" : `fases ${a}–${b} · hechas`;
    } else if (proj.some((p) => getPhaseState(p.status) !== "pending") || (projStart && projStart <= today)) {
      proyecto = projStart ? `desde el ${fechaCorta(projStart, today)}` : `${proj.filter(isDone).length} de ${proj.length} hechas`;
    } else {
      proyecto = projStart ? `empieza el ${fechaCorta(projStart, today)}` : "por empezar";
    }
  }

  let obraLabel = "";
  if (obra.length) {
    const o = obra[0];
    const state = getPhaseState(o.status);
    const start = isoDay(o.start_date);
    if (obra.every(isDone)) {
      const close = closeOf.get(obra[obra.length - 1].id);
      obraLabel = close ? `hecha · ${fechaCorta(close, today)}` : "hecha";
    } else if (state === "current") {
      obraLabel = start ? `desde el ${fechaCorta(start, today)}` : "en marcha";
    } else if (state === "blocked") {
      obraLabel = "en espera";
    } else {
      obraLabel = start && start > today ? `empieza el ${fechaCorta(start, today)}` : "por empezar";
    }
  }

  let llaves: string;
  if (delivery.kind === "delivered") llaves = delivery.dateIso ? `entregada · ${fechaCorta(delivery.dateIso, today)}` : "entregada";
  else if (delivery.kind === "unset" || !delivery.dateIso) llaves = "por fijar";
  else llaves = fechaCorta(delivery.dateIso, today);

  // Descripción para lectores de pantalla
  const parts: string[] = [];
  if (progress !== null) {
    const semana = latest.week_number === CLOSING_WEEK_NUMBER ? "el parte de cierre" : `el parte de la semana ${latest.week_number}`;
    let s = `Avance real de la obra: ${progress} por ciento, según ${semana}`;
    if (callout) {
      s +=
        callout.delta > 0
          ? `, ${puntos(callout.delta)} más que el parte anterior`
          : callout.delta < 0
            ? `, ${puntos(-callout.delta)} menos que el parte anterior`
            : ", igual que el parte anterior";
    }
    parts.push(`${s}.`);
  } else if (active) {
    parts.push(`Ahora: ${active.phase_number}, ${active.name}.`);
  }
  if (n) parts.push(`${doneCount} de ${n} fases completadas.`);
  const etapas: string[] = [];
  if (proj.length) {
    etapas.push(
      proj.every(isDone)
        ? "las fases de proyecto están completadas"
        : `proyecto: ${proj.filter(isDone).length} de ${proj.length} fases completadas`
    );
  }
  if (obra.length) {
    const o = obra[0];
    const start = isoDay(o.start_date);
    const state = getPhaseState(o.status);
    if (obra.every(isDone)) {
      const close = closeOf.get(obra[obra.length - 1].id);
      etapas.push(close ? `la obra terminó el ${formatDateEs(close)}` : "la obra está terminada");
    } else if (state === "current") {
      etapas.push(start ? `la obra está en marcha desde el ${formatDateEs(start)}` : "la obra está en marcha");
    } else if (state === "blocked") {
      etapas.push("la obra está en espera");
    } else {
      etapas.push("la obra está por empezar");
    }
  }
  if (delivery.kind === "delivered") {
    etapas.push(delivery.dateIso ? `la casa se entregó el ${formatDateEs(delivery.dateIso)}` : "la casa está entregada");
  } else if (delivery.kind === "unset" || !delivery.dateIso) {
    etapas.push("la fecha de llaves aún no está fijada");
  } else if (delivery.kind === "paused") {
    etapas.push(`la fecha de llaves, el ${formatDateEs(delivery.dateIso)}, está en revisión durante la pausa`);
  } else {
    etapas.push(`las llaves se estiman para el ${formatDateEs(delivery.dateIso)}`);
  }
  if (etapas.length) {
    const s = etapas.join("; ");
    parts.push(`${s.charAt(0).toUpperCase()}${s.slice(1)}.`);
  }

  return {
    drawable: n > 0 || timeScaled || progress !== null,
    timeScaled,
    nodes,
    now,
    stage,
    delivered,
    progress,
    numeral,
    callout,
    labels: { project: proyecto, construction: obraLabel, handover: llaves },
    aria: parts.join(" "),
  };
}

// ─── Geometría ─────────────────────────────────────────────────────────────────────

export type DiscoVariant = "compacto" | "ancho";

export const DISCO_DIMS: Record<
  DiscoVariant,
  { W: number; H: number; axisY: number; x0: number; x1: number; r: number; fs: number; fsDelta: number; fsBig: number; ls: number }
> = {
  // Móvil: ~1:1 a 358 px de ancho
  compacto: { W: 350, H: 200, axisY: 152, x0: 8, x1: 340, r: 56, fs: 12, fsDelta: 15, fsBig: 40, ls: 1.7 },
  // Escritorio: la columna derecha de la portada (~470 px)
  ancho: { W: 470, H: 252, axisY: 196, x0: 10, x1: 458, r: 74, fs: 13, fsDelta: 18, fsBig: 54, ls: 1.9 },
};

const TITULOS: Record<Etapa, string> = { project: "PROYECTO", construction: "OBRA", handover: "LLAVES" };

/** Ancho estimado de un texto (Montserrat): mayúsculas con interletraje o minúsculas. */
function anchoTexto(text: string, fs: number, caps: boolean, ls = 0): number {
  return caps ? text.length * (fs * 0.7 + ls) : text.length * fs * 0.56;
}

/** Altura (desde abajo) del segmento circular cuya área es `f` del círculo de radio r. */
export function alturaSegmento(f: number, r: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return 2 * r;
  const area = (h: number) => {
    const d = r - h;
    return (r * r * Math.acos(d / r) - d * Math.sqrt(Math.max(0, 2 * r * h - h * h))) / (Math.PI * r * r);
  };
  let lo = 0;
  let hi = 2 * r;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (area(mid) < f) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface DiscoLabel {
  key: Etapa;
  title: string;
  sub: string;
  x: number;
  anchor: "start" | "middle" | "end";
}

export interface DiscoLayout {
  dims: (typeof DISCO_DIMS)[DiscoVariant];
  cx: number;
  cy: number;
  nodes: { id: string; x: number }[];
  doneLen: number;
  restFrom: number;
  /** y del borde superior del relleno y su altura (área = % real). */
  fillTop: number;
  fillH: number;
  /** Línea base de la cifra: entera dentro del relleno, entera encima o, si no cabe, centrada. */
  numY: number;
  callout: null | {
    anchor: "start" | "end";
    x: number;
    ys: [number, number, number, number];
    leader: string;
    dot: { x: number; y: number };
  };
  labels: DiscoLabel[];
}

export function layoutDisco(data: DiscoData, variant: DiscoVariant): DiscoLayout {
  const dims = DISCO_DIMS[variant];
  const { W, axisY, x0, x1, r, fs, ls } = dims;
  const span = x1 - x0;
  const nowX = x0 + data.now * span;
  // El disco entero dentro del dibujo; si el extremo lo empuja, la línea hecha acaba en su centro
  const cx = Math.min(Math.max(nowX, r + 2), W - r - 2);
  const cy = axisY - r;
  const nodes = data.nodes.map((n) => ({ id: n.id, x: Math.min(x0 + n.frac * span, cx) }));

  const fillH = data.progress === null ? 0 : alturaSegmento(data.progress / 100, r);
  const fillTop = cy + r - fillH;

  // Que la línea del relleno no roce la cifra por un par de píxeles: o entera sobre el
  // Saffron (en Jet), o entera sobre el oscuro (en claro); si no cabe en ninguno, centrada
  // y partida por la línea (cada mitad con su color).
  const capH = dims.fsBig * 0.72;
  const pad = r * 0.12;
  const lowMax = cy + r * 0.55;
  const highMin = cy - r * 0.55 + capH;
  const centered = cy + capH / 2;
  let numY = centered;
  if (data.progress !== null) {
    if (fillTop + pad + capH <= lowMax) numY = Math.min(lowMax, Math.max(fillTop + pad + capH, centered));
    else if (fillTop - pad >= highMin) numY = Math.max(highMin, Math.min(fillTop - pad, centered));
  }

  // Llamada lateral, en el lado con sitio
  let callout: DiscoLayout["callout"] = null;
  if (data.callout) {
    const width = Math.max(
      anchoTexto("AVANCE REAL", fs, true, ls),
      anchoTexto(data.callout.deltaText, dims.fsDelta, false),
      anchoTexto(data.callout.context[0], fs, false),
      anchoTexto(data.callout.context[1], fs, false)
    );
    const left = cx - r - 6 - x0;
    const right = W - 6 - (cx + r + 6);
    const side: "start" | "end" = left >= width + 8 || left >= right ? "start" : "end";
    const top = cy - r + fs + 2;
    const ys: [number, number, number, number] = [
      top,
      top + dims.fsDelta + 9,
      top + dims.fsDelta + 9 + fs + 6,
      top + dims.fsDelta + 9 + 2 * (fs + 6),
    ];
    const ruleY = ys[3] + fs - 2;
    const angle = (18 * Math.PI) / 180;
    if (side === "start") {
      const dot = { x: cx - (r + 4) * Math.cos(angle), y: cy - (r + 4) * Math.sin(angle) };
      const bend = Math.max(x0 + 40, dot.x - 22);
      callout = { anchor: "start", x: x0, ys, leader: `M${x0} ${ruleY} H${bend.toFixed(1)} L${dot.x.toFixed(1)} ${dot.y.toFixed(1)}`, dot };
    } else {
      const dot = { x: cx + (r + 4) * Math.cos(angle), y: cy - (r + 4) * Math.sin(angle) };
      const bend = Math.min(W - 6 - 40, dot.x + 22);
      callout = { anchor: "end", x: W - 6, ys, leader: `M${W - 6} ${ruleY} H${bend.toFixed(1)} L${dot.x.toFixed(1)} ${dot.y.toFixed(1)}`, dot };
    }
  }

  // Etiquetas: la de ahora bajo el disco, LLAVES al final, el resto en el hueco que quede
  const order: Etapa[] = ["project", "construction", "handover"];
  const items = order
    .filter((k) => data.labels[k])
    .map((k) => ({
      key: k,
      title: TITULOS[k],
      sub: data.labels[k],
      w: Math.max(anchoTexto(TITULOS[k], fs, true, ls), anchoTexto(data.labels[k], fs, false)),
    }));
  const labels: DiscoLabel[] = [];
  const llaves = items.find((i) => i.key === "handover");
  const llavesLeft = llaves ? W - 2 - llaves.w : W;
  if (llaves) labels.push({ key: "handover", title: llaves.title, sub: llaves.sub, x: W - 2, anchor: "end" });

  const current = data.stage !== "handover" ? items.find((i) => i.key === data.stage) : undefined;
  let curLeft = cx - r;
  let curRight = cx + r;
  if (current) {
    let x = Math.min(Math.max(cx, x0 + current.w / 2), W - 2 - current.w / 2);
    if (llaves && x + current.w / 2 > llavesLeft - 10) x = llavesLeft - 10 - current.w / 2;
    if (x - current.w / 2 >= x0 - 2) {
      labels.push({ key: current.key, title: current.title, sub: current.sub, x, anchor: "middle" });
      curLeft = Math.min(cx - r, x - current.w / 2);
      curRight = Math.max(cx + r, x + current.w / 2);
    }
  }

  const stageIdx = order.indexOf(data.stage);
  const place = (list: typeof items, from: number, to: number, nearest: "first" | "last") => {
    // Si no caben todas, solo la más cercana al disco; si tampoco cabe, ninguna
    const room = to - from;
    const total = list.reduce((s, i) => s + i.w, 0) + 12 * Math.max(0, list.length - 1);
    if (!list.length || room < Math.min(...list.map((i) => i.w))) return;
    const fit = total <= room ? list : nearest === "last" ? list.slice(-1) : list.slice(0, 1);
    const slot = room / fit.length;
    fit.forEach((it, i) => {
      const x = from + slot * (i + 0.5);
      if (it.w <= slot + 4) labels.push({ key: it.key, title: it.title, sub: it.sub, x, anchor: "middle" });
    });
  };
  const before = items.filter((i) => order.indexOf(i.key) < stageIdx && i.key !== "handover");
  const after = items.filter((i) => order.indexOf(i.key) > stageIdx && i.key !== "handover");
  place(before, x0, curLeft - 10, "last");
  place(after, curRight + 10, llavesLeft - 10, "first");

  return {
    dims,
    cx,
    cy,
    nodes,
    // Sin nada hecho ni tiempo transcurrido, no hay trazo macizo (aunque el disco, por caber, se aparte del borde)
    doneLen: data.now > 0 || data.nodes.length > 0 ? Math.max(0, cx - x0) : 0,
    restFrom: cx + 6,
    fillTop,
    fillH,
    numY,
    callout,
    labels,
  };
}
