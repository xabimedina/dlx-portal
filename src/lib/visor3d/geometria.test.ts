import { describe, expect, it } from "vitest";
import { BoxGeometry } from "three";
import { pip, polyStats, sectionSegments, type Punto2 } from "./geometria";

// Salón-cocina del piso de ejemplo (reformado): una L con el hueco del baño
const L: Punto2[] = [[0, 0], [5.4, 0], [5.4, 3.3], [6, 3.3], [6, 4.5], [3.5, 4.5], [3.5, 7.5], [0, 7.5]];

describe("pip (punto en polígono)", () => {
  it("dentro de la L, en el brazo largo y en el corto", () => {
    expect(pip(L, 1.75, 6)).toBe(true); // donde estaba la cocina
    expect(pip(L, 2.7, 1.65)).toBe(true); // donde estaba el salón
    expect(pip(L, 5, 3.9)).toBe(true); // tramo oeste del antiguo pasillo
  });

  it("fuera de la L y en su hueco", () => {
    expect(pip(L, -1, 3)).toBe(false);
    expect(pip(L, 4.5, 6)).toBe(false); // el baño, dentro de la caja de la L
    expect(pip(L, 8, 3.9)).toBe(false); // el distribuidor
  });
});

describe("polyStats", () => {
  it("rectángulo: área, centroide y medidas", () => {
    const s = polyStats([[6, 0], [10, 0], [10, 3.3], [6, 3.3]]);
    expect(s.area).toBeCloseTo(13.2, 6);
    expect(s.cx).toBeCloseTo(8, 6);
    expect(s.cy).toBeCloseTo(1.65, 6);
    expect(s.w).toBeCloseTo(4, 6);
    expect(s.d).toBeCloseTo(3.3, 6);
  });

  it("la L de Salón-cocina mide 35,52 m² y su centroide cae dentro", () => {
    const s = polyStats(L);
    expect(s.area).toBeCloseTo(35.52, 6);
    expect(s.w).toBeCloseTo(6, 6);
    expect(s.d).toBeCloseTo(7.5, 6);
    expect(pip(L, s.cx, s.cy)).toBe(true);
  });

  it("el sentido del contorno no cambia el área", () => {
    expect(polyStats([...L].reverse()).area).toBeCloseTo(35.52, 6);
  });

  it("contorno degenerado: área 0 y centro de su caja, sin NaN", () => {
    const s = polyStats([[0, 0], [2, 0], [4, 0]]);
    expect(s.area).toBe(0);
    expect(s.cx).toBe(2);
    expect(s.cy).toBe(0);
  });
});

describe("sectionSegments (línea de sección)", () => {
  // Caja de 2 × 1 m en planta y 2,7 m de alto, centrada en (3, 1.35, -1)
  const caja = () => {
    const g = new BoxGeometry(2, 2.7, 1);
    g.translate(3, 1.35, -1);
    return g;
  };

  const comprobarRectangulo = (segs: number[]) => {
    expect(segs).toHaveLength(8 * 6);
    let longitud = 0;
    for (let i = 0; i < segs.length; i += 6) {
      const [x0, y0, z0, x1, y1, z1] = segs.slice(i, i + 6);
      expect(y0).toBe(1.404);
      expect(y1).toBe(1.404);
      for (const [x, z] of [[x0, z0], [x1, z1]]) {
        // Cada extremo está sobre el perímetro del rectángulo x 2…4, z -1,5…-0,5
        const enLadoX = Math.abs(x - 2) < 1e-9 || Math.abs(x - 4) < 1e-9;
        const enLadoZ = Math.abs(z + 1.5) < 1e-9 || Math.abs(z + 0.5) < 1e-9;
        expect(enLadoX || enLadoZ).toBe(true);
      }
      longitud += Math.hypot(x1 - x0, z1 - z0);
    }
    expect(longitud).toBeCloseTo(2 * (2 + 1), 9);
  };

  it("caja indexada cortada por el centro → 8 segmentos que forman su rectángulo", () => {
    const g = caja();
    comprobarRectangulo(sectionSegments(g.attributes.position.array, g.index?.array ?? null, 1.4001, 1.404));
  });

  it("igual sin índice (como llegan las mallas tras toNonIndexed)", () => {
    const g = caja().toNonIndexed();
    comprobarRectangulo(sectionSegments(g.attributes.position.array, null, 1.4001, 1.404));
  });

  it("0 segmentos si el plano no toca la caja", () => {
    const g = caja();
    expect(sectionSegments(g.attributes.position.array, g.index?.array ?? null, 3.2, 3.204)).toEqual([]);
    expect(sectionSegments(g.attributes.position.array, g.index?.array ?? null, -0.5, -0.496)).toEqual([]);
  });
});
