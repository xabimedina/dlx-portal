/**
 * Etiqueta de un parte de obra. El módulo Obras registra el hito de entrega
 * como week_number 999: aquí se muestra como "Cierre" (igual que en la
 * consola del estudio) en vez de un desconcertante "Semana 999".
 */
export const CLOSING_WEEK_NUMBER = 999;

export function weekLabel(weekNumber: number): string {
  return weekNumber === CLOSING_WEEK_NUMBER ? "Cierre" : `Semana ${weekNumber}`;
}
