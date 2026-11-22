/**
 * Geometría pura del visor 3D (sin three ni DOM), portada de la demo aprobada
 * (`visor-3d/demo/index.html`).
 *
 * Planta en metros con los ejes de Revit: x hacia la derecha, y hacia el norte.
 * En la escena de three la planta y va a -z: (x, y, z)_revit → (x, z, -y)_three.
 */

/** Punto en planta [x, y] */
export type Punto2 = readonly [number, number];

export interface EstadisticasPoligono {
  /** Área en m² (siempre positiva, sea cual sea el sentido del contorno) */
  area: number;
  /** Centroide del polígono (centro de su caja si el área es 0) */
  cx: number;
  cy: number;
  /** Ancho (x) y fondo (y) de su caja */
  w: number;
  d: number;
}

export function polyStats(poly: readonly Punto2[]): EstadisticasPoligono {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  A /= 2;
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  if (A === 0) return { area: 0, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, d: maxY - minY };
  return { area: Math.abs(A), cx: cx / (6 * A), cy: cy / (6 * A), w: maxX - minX, d: maxY - minY };
}

/** Punto en polígono (regla par-impar) */
export function pip(poly: readonly Punto2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Intersección de una malla (en coordenadas de three) con el plano horizontal
 * y = h: devuelve los segmentos de la línea de sección como
 * [x0, yOut, z0, x1, yOut, z1, …], listos para `LineSegmentsGeometry.setPositions`.
 * Los vértices que caen justo en el plano no cortan: llamar con h ligeramente
 * desplazado (la demo usa corte + 1e-4).
 */
export function sectionSegments(
  posiciones: ArrayLike<number>,
  indices: ArrayLike<number> | null,
  h: number,
  yOut: number,
): number[] {
  const tri = indices ? indices.length / 3 : posiciones.length / 9;
  const out: number[] = [];
  const ids = [0, 0, 0];
  for (let t = 0; t < tri; t++) {
    for (let k = 0; k < 3; k++) ids[k] = indices ? indices[t * 3 + k] : t * 3 + k;
    let n = 0, x0 = 0, z0 = 0, x1 = 0, z1 = 0;
    for (let e = 0; e < 3; e++) {
      const a = ids[e], b = ids[(e + 1) % 3];
      const da = posiciones[a * 3 + 1] - h, db = posiciones[b * 3 + 1] - h;
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const s = da / (da - db);
        const x = posiciones[a * 3] + (posiciones[b * 3] - posiciones[a * 3]) * s;
        const z = posiciones[a * 3 + 2] + (posiciones[b * 3 + 2] - posiciones[a * 3 + 2]) * s;
        if (n === 0) { x0 = x; z0 = z; } else { x1 = x; z1 = z; }
        n++;
      }
    }
    if (n === 2) out.push(x0, yOut, z0, x1, yOut, z1);
  }
  return out;
}
