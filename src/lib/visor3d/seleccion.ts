/**
 * Qué estancia queda seleccionada al cambiar de estado (actual ↔ reformado).
 * Misma regla que la demo: primero por id (el WEB_ID de Revit) y, si no
 * existe en el otro estado, la que contiene el punto que mira la cámara.
 * La cámara no se mueve; esto solo decide la selección y el aviso.
 */
import { pip, type Punto2 } from "./geometria";

export type FaseVisor = "actual" | "reformado";

export interface EstanciaSeleccionable {
  id: string;
  nombre: string;
  contorno: readonly Punto2[];
}

export interface Reasignacion<T> {
  estancia: T | null;
  /** Texto del aviso (toast) o null si no hay nada que contar */
  aviso: string | null;
}

/**
 * @param previa estancia seleccionada en el estado de origen
 * @param destino estancias del estado al que se pasa
 * @param faseDestino estado al que se pasa (cambia el tiempo verbal del aviso)
 * @param mira punto de planta que mira la cámara (controls.target → { x, y: -z })
 */
export function reasignarEstancia<T extends EstanciaSeleccionable>(
  previa: T | null,
  destino: readonly T[],
  faseDestino: FaseVisor,
  mira: { x: number; y: number },
): Reasignacion<T> {
  if (!previa) return { estancia: null, aviso: null };

  const mismaId = destino.find((e) => e.id === previa.id);
  if (mismaId) {
    return { estancia: mismaId, aviso: mismaId.nombre !== previa.nombre ? `${previa.nombre} → ${mismaId.nombre}` : null };
  }

  const porPunto = destino.find((e) => pip(e.contorno, mira.x, mira.y));
  if (porPunto) {
    const aviso = faseDestino === "reformado"
      ? `${previa.nombre} pasa a formar parte de ${porPunto.nombre}`
      : `${previa.nombre} antes era parte de ${porPunto.nombre}`;
    return { estancia: porPunto, aviso };
  }

  return { estancia: null, aviso: `${previa.nombre} no existe en este estado` };
}
