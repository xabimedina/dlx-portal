import { describe, expect, it } from "vitest";
import {
  entradilla,
  esEditable,
  etiquetaFoto,
  grupoDe,
  ordenarDecididas,
  ordenarPendientes,
  plazoEnPalabras,
} from "./decision-utils";

describe("plazoEnPalabras", () => {
  const hoy = "2026-11-22"; // domingo

  it("sin plazo no dice nada", () => {
    expect(plazoEnPalabras(null, hoy)).toBeNull();
  });

  it("hoy y mañana en palabras", () => {
    expect(plazoEnPalabras("2026-11-22", hoy)?.texto).toBe("Hasta hoy");
    expect(plazoEnPalabras("2026-11-23", hoy)?.texto).toBe("Hasta mañana");
  });

  it("con el día de la semana y sin año si es el mismo", () => {
    expect(plazoEnPalabras("2026-11-30", hoy)).toEqual({ texto: "Hasta el lunes 30 de noviembre", vencido: false });
    expect(plazoEnPalabras("2027-01-08", hoy)?.texto).toBe("Hasta el viernes 8 de enero de 2027");
  });

  it("un plazo pasado no riñe", () => {
    expect(plazoEnPalabras("2026-11-15", hoy)).toEqual({
      texto: "El plazo era el 15 de noviembre. Aún puedes responder.",
      vencido: true,
    });
  });
});

describe("grupos y orden", () => {
  it("agrupa por estado del modelo", () => {
    expect(grupoDe("Pendiente")).toBe("pendientes");
    expect(grupoDe("En revisión")).toBe("esperando");
    expect(grupoDe("Votado")).toBe("esperando");
    expect(grupoDe("Validada")).toBe("cerradas");
    expect(grupoDe("Cancelado")).toBe("cerradas");
  });

  it("solo se responde lo que admite el servidor", () => {
    expect(["Pendiente", "En revisión", "Votado", "Validada", "Cancelado"].filter(esEditable)).toEqual([
      "Pendiente",
      "En revisión",
      "Votado",
    ]);
  });

  it("pendientes: prioridad, plazo y antigüedad", () => {
    const list = [
      { id: "a", priority: "Media", due_date: "2026-11-24", created_at: "1" },
      { id: "b", priority: "Urgente", due_date: null, created_at: "2" },
      { id: "c", priority: "Media", due_date: "2026-11-23", created_at: "3" },
      { id: "d", priority: "Media", due_date: null, created_at: "0" },
    ] as const;
    expect(ordenarPendientes([...list]).map((d) => d.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("decididas: primero las que esperan al estudio, luego las cerradas recientes", () => {
    const list = [
      { id: "v1", status: "Validada", validated_at: "2026-10-01", created_at: "2026-09-01" },
      { id: "r", status: "En revisión", validated_at: null, created_at: "2026-08-01" },
      { id: "v2", status: "Validada", validated_at: "2026-11-01", created_at: "2026-09-01" },
    ];
    expect(ordenarDecididas(list).map((d) => d.id)).toEqual(["r", "v2", "v1"]);
  });
});

describe("etiquetaFoto", () => {
  it("solo etiqueta lo que el pie o el origen dicen", () => {
    expect(etiquetaFoto({ caption: "Render del salón", weekly_update_id: null })).toBe("Render");
    expect(etiquetaFoto({ caption: "Referencia: latón cepillado", weekly_update_id: null })).toBe("Referencia");
    expect(etiquetaFoto({ caption: "Foto de obra: tomas de agua", weekly_update_id: null })).toBe("Foto de obra");
    expect(etiquetaFoto({ caption: null, weekly_update_id: "parte-1" })).toBe("Foto de obra");
    expect(etiquetaFoto({ caption: "Muestra de roble sobre el suelo", weekly_update_id: null })).toBeUndefined();
    expect(etiquetaFoto({ caption: null, weekly_update_id: null })).toBeUndefined();
  });
});

describe("entradilla", () => {
  it("cuenta lo pendiente y la recomendación sin prometer de más", () => {
    expect(entradilla([{ studio_recommendation: "Roble" }])).toBe(
      "Una elección espera tu respuesta. Te damos nuestra recomendación."
    );
    expect(entradilla([{ studio_recommendation: "Roble" }, { studio_recommendation: null }])).toBe(
      "Dos elecciones esperan tu respuesta. Donde la tenemos, te damos nuestra recomendación."
    );
    expect(entradilla([{ studio_recommendation: null }, { studio_recommendation: "" }, { studio_recommendation: null }])).toBe(
      "Tres elecciones esperan tu respuesta."
    );
    expect(entradilla([])).toMatch(/Ahora no tienes nada pendiente\.$/);
  });
});
