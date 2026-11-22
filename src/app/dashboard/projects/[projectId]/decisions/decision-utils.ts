import type { PortalDecision, PortalPhoto } from "@/types/portal";
import { daysBetween } from "@/lib/format-date-es";

/**
 * Lógica pura de la pantalla «Decisiones» (sin React): agrupación por estado,
 * orden de urgencia, plazos en palabras tranquilas y la etiqueta honesta de cada foto.
 */

/** Las decisiones antiguas pueden llevar un documento vinculado (campo heredado). */
export type Decision = PortalDecision & { document_id?: string | null };

/** Estados desde los que el cliente puede responder (los mismos que admite el servidor). */
const EDITABLES = new Set(["Pendiente", "En revisión", "Votado"]);
export const esEditable = (status: string): boolean => EDITABLES.has(status);

/** Grupo de los chips: pendientes de ti, esperando al estudio (ya respondidas) y cerradas. */
export type Grupo = "pendientes" | "esperando" | "cerradas";
export function grupoDe(status: string): Grupo {
  if (status === "Pendiente") return "pendientes";
  if (status === "En revisión" || status === "Votado") return "esperando";
  return "cerradas";
}

const PRIORIDAD: Record<string, number> = { Urgente: 0, Alta: 1, Media: 2, Baja: 3 };

/** Pendientes por urgencia: prioridad, plazo más cercano y antigüedad (como «Lo que te toca»). */
export function ordenarPendientes<T extends { priority: string; due_date?: string | null; created_at?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const pa = PRIORIDAD[a.priority] ?? 4;
    const pb = PRIORIDAD[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    const da = a.due_date || "9999-12-31";
    const db = b.due_date || "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

/** Ya decididas: primero las que esperan al estudio, luego las cerradas; las recientes arriba. */
export function ordenarDecididas<T extends { status: string; validated_at?: string | null; created_at?: string }>(list: T[]): T[] {
  const fecha = (d: T) => String(d.validated_at || d.created_at || "");
  return [...list].sort((a, b) => {
    const ga = grupoDe(a.status) === "esperando" ? 0 : 1;
    const gb = grupoDe(b.status) === "esperando" ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return fecha(b).localeCompare(fecha(a));
  });
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function partes(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || "").trim());
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Plazo de una decisión en palabras tranquilas: «Hasta mañana», «Hasta el lunes 30 de
 * noviembre». Un plazo pasado no riñe: dice cuándo era y que aún se puede responder.
 * `today` llega del servidor (fecha de Madrid) para que servidor y cliente pinten igual.
 */
export function plazoEnPalabras(due: string | null | undefined, today: string): { texto: string; vencido: boolean } | null {
  const p = due ? partes(due) : null;
  const hoy = partes(today);
  if (!p || !hoy || !due) return null;
  const dias = daysBetween(today, due);
  const fecha = `${p.d} de ${MESES[p.m - 1]}${p.y !== hoy.y ? ` de ${p.y}` : ""}`;
  if (dias < 0) return { texto: `El plazo era el ${fecha}. Aún puedes responder.`, vencido: true };
  if (dias === 0) return { texto: "Hasta hoy", vencido: false };
  if (dias === 1) return { texto: "Hasta mañana", vencido: false };
  const semana = DIAS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return { texto: `Hasta el ${semana} ${fecha}`, vencido: false };
}

/** «8 de octubre» a partir de un ISO (fecha o marca de tiempo). */
export function diaMes(iso: string | null | undefined): string {
  const p = iso ? partes(iso) : null;
  return p ? `${p.d} de ${MESES[p.m - 1]}` : "";
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Etiqueta honesta de una foto adjunta: el modelo no guarda el tipo de imagen, así que
 * solo se etiqueta cuando el pie lo dice («Render…», «Referencia…», «Foto de obra…») o
 * cuando la foto viene de un parte de obra. Si no se sabe, no se etiqueta.
 */
export function etiquetaFoto(photo: Pick<PortalPhoto, "caption" | "weekly_update_id">): string | undefined {
  const texto = sinAcentos(photo.caption ?? "");
  if (/\brender/.test(texto)) return "Render";
  if (/\b(referencia|catalogo|inspiracion)/.test(texto)) return "Referencia";
  if (photo.weekly_update_id || /\b(foto de obra|en obra|visita|estado actual)\b/.test(texto)) return "Foto de obra";
  return undefined;
}

const NUMEROS = ["", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];

/** Entradilla según lo pendiente: cuántas esperan y si hay recomendación del estudio. */
export function entradilla(pendientes: Array<Pick<Decision, "studio_recommendation">>): string {
  const n = pendientes.length;
  if (n === 0) {
    return "Aquí eliges acabados, calidades o luminarias que te propone el estudio y das tu aprobación para que la obra avance. Ahora no tienes nada pendiente.";
  }
  const cuantas = n === 1 ? "Una elección espera tu respuesta." : `${NUMEROS[n] ?? n} elecciones esperan tu respuesta.`;
  const conReco = pendientes.filter((d) => (d.studio_recommendation ?? "").trim()).length;
  if (conReco === 0) return cuantas;
  if (conReco === n) return `${cuantas} ${n === 1 ? "Te damos nuestra recomendación." : "En cada una te damos nuestra recomendación."}`;
  return `${cuantas} Donde la tenemos, te damos nuestra recomendación.`;
}

/** «1,2 MB» a partir de bytes. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1)).toLocaleString("es-ES")} ${sizes[i]}`;
}
