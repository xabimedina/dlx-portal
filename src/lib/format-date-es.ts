import { todayIso } from "./phase-delay";

/**
 * Humanización de fechas en es-ES para el portal cliente: el cliente nunca ve
 * un ISO crudo ni un "N/A" (regla de diseño del Tríptico).
 *
 * Las fechas del modelo son date-only ("YYYY-MM-DD") o timestamps ISO. Para
 * evitar el desajuste de huso horario de `new Date("YYYY-MM-DD")` (parsea en
 * UTC) y los errores de hidratación, aquí NUNCA se construye un Date para
 * formatear: se trocea el string, igual que los formateadores históricos de
 * las subpáginas y que lib/phase-delay.ts.
 */

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function dateParts(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || "").trim());
  if (!match) return null;
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y: Number(match[1]), m, d };
}

/** "2026-11-15" → "15 de noviembre de 2026". Devuelve "" si no es una fecha. */
export function formatDateEs(value?: string | null): string {
  const p = value ? dateParts(value) : null;
  if (!p) return "";
  return `${p.d} de ${MONTHS_ES[p.m - 1]} de ${p.y}`;
}

/** "2026-07-04" → "4 de julio" (sin año, para fechas cercanas). */
export function formatDayMonthEs(value?: string | null): string {
  const p = value ? dateParts(value) : null;
  if (!p) return "";
  return `${p.d} de ${MONTHS_ES[p.m - 1]}`;
}

/** Días entre dos fechas (date-only), positivo si `toIso` es posterior. */
export function daysBetween(fromIso: string, toIso: string = todayIso()): number {
  const from = fromIso ? dateParts(fromIso) : null;
  const to = toIso ? dateParts(toIso) : null;
  if (!from || !to) return 0;
  return Math.round(
    (Date.UTC(to.y, to.m - 1, to.d) - Date.UTC(from.y, from.m - 1, from.d)) / 86_400_000
  );
}

/** Recencia relativa: "hoy", "ayer", "hace 4 días", "hace 3 semanas", "hace 2 meses". */
export function relativeDaysEs(value: string, today: string = todayIso()): string {
  const days = daysBetween(value, today);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 14) return `hace ${days} días`;
  if (days < 60) return `hace ${Math.round(days / 7)} semanas`;
  const months = Math.round(days / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}
