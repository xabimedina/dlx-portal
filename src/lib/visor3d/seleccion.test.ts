import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { polyStats } from "./geometria";
import { reasignarEstancia, type EstanciaSeleccionable } from "./seleccion";

// Contrato de ejemplo (lo que genera Revit), compartido con la demo
const ejemplo = JSON.parse(
  readFileSync(new URL("../../../../visor-3d/datos/modelo_web.ejemplo.json", import.meta.url), "utf8"),
) as { fases: Record<"actual" | "reformado", { estancias: EstanciaSeleccionable[] }> };
const actual = ejemplo.fases.actual.estancias;
const reformado = ejemplo.fases.reformado.estancias;
const por = (lista: EstanciaSeleccionable[], id: string) => {
  const e = lista.find((x) => x.id === id);
  if (!e) throw new Error(`Falta ${id} en el ejemplo`);
  return e;
};
/** La cámara mira al centro de la estancia seleccionada, como tras volar a ella */
const centro = (e: EstanciaSeleccionable) => {
  const s = polyStats(e.contorno);
  return { x: s.cx, y: s.cy };
};

describe("reasignarEstancia al cambiar de estado", () => {
  it("Baño → Baño por id, sin aviso (mismo nombre)", () => {
    const r = reasignarEstancia(por(actual, "bano"), reformado, "reformado", centro(por(actual, "bano")));
    expect(r.estancia?.id).toBe("bano");
    expect(r.aviso).toBeNull();
  });

  it("Salón → Salón-cocina por id, avisando del nombre nuevo", () => {
    const r = reasignarEstancia(por(actual, "salon"), reformado, "reformado", centro(por(actual, "salon")));
    expect(r.estancia?.id).toBe("salon");
    expect(r.aviso).toBe("Salón → Salón-cocina");
  });

  it("Cocina → Salón-cocina por el punto que mira la cámara", () => {
    const r = reasignarEstancia(por(actual, "cocina"), reformado, "reformado", centro(por(actual, "cocina")));
    expect(r.estancia?.nombre).toBe("Salón-cocina");
    expect(r.aviso).toBe("Cocina pasa a formar parte de Salón-cocina");
  });

  it("Pasillo → Salón-cocina o Distribuidor según dónde se mire", () => {
    const pasillo = por(actual, "pasillo");
    expect(reasignarEstancia(pasillo, reformado, "reformado", { x: 2, y: 3.9 }).estancia?.id).toBe("salon");
    expect(reasignarEstancia(pasillo, reformado, "reformado", centro(pasillo)).estancia?.id).toBe("salon");
    const r = reasignarEstancia(pasillo, reformado, "reformado", { x: 8, y: 3.9 });
    expect(r.estancia?.id).toBe("distribuidor");
    expect(r.aviso).toBe("Pasillo pasa a formar parte de Distribuidor");
  });

  it("de vuelta al estado actual, el aviso habla en pasado", () => {
    const r = reasignarEstancia(por(reformado, "distribuidor"), actual, "actual", centro(por(reformado, "distribuidor")));
    expect(r.estancia?.id).toBe("pasillo");
    expect(r.aviso).toBe("Distribuidor antes era parte de Pasillo");
  });

  it("Distribuidor → nada en actual si la cámara mira fuera de la vivienda", () => {
    const r = reasignarEstancia(por(reformado, "distribuidor"), actual, "actual", { x: 12, y: 3.9 });
    expect(r.estancia).toBeNull();
    expect(r.aviso).toBe("Distribuidor no existe en este estado");
  });

  it("sin selección no hay nada que reasignar", () => {
    expect(reasignarEstancia(null, reformado, "reformado", { x: 1, y: 1 })).toEqual({ estancia: null, aviso: null });
  });
});
