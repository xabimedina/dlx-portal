import { cookies } from "next/headers";
import { novedadCookie } from "./novedad-cookie";

/**
 * «Se mueve lo que es de ahora» (propuesta de movimiento, nov 2026): la coreografía de una
 * pantalla solo se reproduce cuando hay algo nuevo para quien mira, una vez por versión.
 *
 * - En el servidor: `await esNovedad("inicio", ultimoParte.id)` dice si la versión es nueva
 *   para este navegador; la página pinta entonces la clase `novedad` en la pieza.
 * - En el cliente: `<MarcarVisto id="inicio" version={…} />` (components/novedad) guarda
 *   la versión vista.
 *
 * Lo visto vive en una cookie funcional de primera parte (los clientes no tienen ficha
 * propia). Sin versión, o con la misma, todo está ya en su estado final; con «reducir
 * movimiento» también, por la regla global de globals.css.
 */
export async function esNovedad(id: string, version: string | null | undefined): Promise<boolean> {
  if (!version) return false;
  const store = await cookies();
  const visto = store.get(novedadCookie(id))?.value;
  return (visto ? decodeURIComponent(visto) : null) !== version;
}

/**
 * Variante por conjunto (p. ej. las decisiones pendientes): es novedad solo si aparece
 * algún elemento que quien mira no había visto. Si el conjunto encoge (porque ha votado),
 * no hay nada nuevo y no se repite la coreografía. La versión que se guarda con
 * `<MarcarVisto>` es la lista de ids separada por comas (`versionDeConjunto`).
 */
export function versionDeConjunto(ids: string[]): string {
  return [...new Set(ids)].sort().join(",");
}

export async function esNovedadConjunto(id: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false;
  const store = await cookies();
  const visto = store.get(novedadCookie(id))?.value;
  const vistos = new Set(visto ? decodeURIComponent(visto).split(",") : []);
  return ids.some((x) => !vistos.has(x));
}
