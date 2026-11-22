import { describe, expect, it } from "vitest";
import {
  alturaSegmento,
  buildDisco,
  fechaCorta,
  layoutDisco,
  phaseNumeral,
  type DiscoPhase,
  type DiscoUpdate,
} from "./inicio-disco";

const TODAY = "2026-11-22";

function fases(statuses: string[], extra: Partial<DiscoPhase>[] = []): DiscoPhase[] {
  return statuses.map((status, i) => ({
    id: `f${i}`,
    phase_number: `Fase ${i}`,
    name: `Fase ${i}`,
    stage: i < 9 ? "project" : i === 9 ? "construction" : "handover",
    status,
    order_index: i,
    start_date: null,
    end_date: null,
    ...extra[i],
  }));
}

const enObra = fases(
  [...Array(9).fill("Validada"), "En desarrollo", "No iniciada"],
  [
    { end_date: "2026-03-20" },
    { start_date: "2026-03-23", end_date: "2026-04-17" },
    { start_date: "2026-04-20" }, // sin end_date: se cierra con el start_date de la siguiente
    { start_date: "2026-05-11", end_date: "2026-05-29" },
    {},
    {}, // dos seguidas sin fecha ni siguiente con inicio: se reparten
    { start_date: "2026-07-06", end_date: "2026-07-24" },
    { end_date: "2026-08-21" },
    { end_date: "2026-09-12" },
    { start_date: "2026-09-19" },
  ]
);

const partes: DiscoUpdate[] = [
  { id: "p8", week_number: 8, progress_percentage: 58, created_at: "2026-11-13T10:00:00Z" },
  { id: "p9", week_number: 9, progress_percentage: 63, created_at: "2026-11-20T10:00:00Z" },
];

const base = {
  phases: enObra,
  activePhaseId: "f9",
  currentStage: "construction" as const,
  projectStart: "2026-03-02",
  delivery: { kind: "estimate" as const, dateIso: "2027-01-08" },
  updates: partes,
  today: TODAY,
};

describe("buildDisco", () => {
  it("en obra: escala de tiempo real, % del último parte y llamada con la diferencia", () => {
    const d = buildDisco(base);
    expect(d.timeScaled).toBe(true);
    expect(d.progress).toBe(63);
    expect(d.numeral).toBeNull();
    expect(d.callout).toEqual({ delta: 5, deltaText: "+5 puntos", context: ["esta semana", "parte 9"] });
    // hoy = 265 de 312 días
    expect(d.now).toBeCloseTo(265 / 312, 5);
    expect(d.labels).toEqual({
      project: "fases 00–08 · hechas",
      construction: "desde el 19 sep",
      handover: "8 ene 2027",
    });
    expect(d.aria).toContain("Avance real de la obra: 63 por ciento, según el parte de la semana 9, 5 puntos más");
    expect(d.aria).toContain("las llaves se estiman para el 8 de enero de 2027");
  });

  it("nudos: en su cierre real, el start_date de la siguiente si falta end_date, y en orden siempre", () => {
    const d = buildDisco(base);
    expect(d.nodes).toHaveLength(9);
    const span = 312;
    const at = (iso: string) => (Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5) - Math.round(Date.UTC(2026, 2, 2) / 864e5)) / span;
    expect(d.nodes[0].frac).toBeCloseTo(at("2026-03-20"), 5);
    expect(d.nodes[2].frac).toBeCloseTo(at("2026-05-11"), 5); // cierre = inicio de la Fase 3
    // Fases 4 y 5, sin fecha: entre la Fase 3 (29 may) y la Fase 6 (24 jul)
    expect(d.nodes[4].frac).toBeGreaterThan(d.nodes[3].frac);
    expect(d.nodes[5].frac).toBeGreaterThan(d.nodes[4].frac);
    expect(d.nodes[5].frac).toBeLessThan(d.nodes[6].frac);
    for (let i = 1; i < d.nodes.length; i++) expect(d.nodes[i].frac).toBeGreaterThanOrEqual(d.nodes[i - 1].frac);
    expect(Math.max(...d.nodes.map((n) => n.frac))).toBeLessThanOrEqual(d.now);
  });

  it("en proyecto no pinta el % de un parte: lleva el número de la fase y ningún relleno", () => {
    const d = buildDisco({
      ...base,
      phases: fases(["Validada", "En desarrollo", ...Array(9).fill("No iniciada")]),
      activePhaseId: "f1",
      currentStage: "project",
      updates: [{ id: "p1", week_number: 1, progress_percentage: 10, created_at: "2026-11-22T08:00:00Z" }],
    });
    expect(d.progress).toBeNull();
    expect(d.callout).toBeNull();
    expect(d.numeral).toBe("01");
    expect(d.labels.project).toBe("desde el 2 mar");
    expect(d.labels.construction).toBe("por empezar");
    expect(d.aria).toContain("Ahora: Fase 1, Fase 1.");
  });

  it("un solo parte: % sin llamada (no hay con qué comparar)", () => {
    const d = buildDisco({ ...base, updates: [partes[1]] });
    expect(d.progress).toBe(63);
    expect(d.callout).toBeNull();
  });

  it("parte antiguo: no dice «esta semana»", () => {
    const d = buildDisco({ ...base, today: "2026-12-10" });
    expect(d.callout?.context).toEqual(["en el parte", "de la semana 9"]);
  });

  it("sin fecha de llaves: línea ordinal, sin escala de tiempo, y «por fijar»", () => {
    const d = buildDisco({ ...base, delivery: { kind: "unset" } });
    expect(d.timeScaled).toBe(false);
    expect(d.now).toBeCloseTo(9.5 / 11, 5);
    expect(d.nodes.map((n) => n.frac)).toEqual(Array.from({ length: 9 }, (_, i) => (i + 0.5) / 11));
    expect(d.labels.handover).toBe("por fijar");
    expect(d.aria).toContain("la fecha de llaves aún no está fijada");
  });

  it("sin fases ni partes: disco vacío, sin etiquetas de etapa salvo las llaves", () => {
    const d = buildDisco({
      phases: [],
      activePhaseId: null,
      currentStage: "project",
      projectStart: null,
      delivery: { kind: "unset" },
      updates: [],
      today: TODAY,
    });
    expect(d.nodes).toEqual([]);
    expect(d.progress).toBeNull();
    expect(d.numeral).toBeNull();
    expect(d.labels).toEqual({ project: "", construction: "", handover: "por fijar" });
    expect(d.now).toBe(0);
    expect(d.drawable).toBe(false);
    expect(layoutDisco(d, "compacto").doneLen).toBe(0);
  });

  it("entregada: el disco en las llaves, todo hecho y la fecha real de entrega", () => {
    const d = buildDisco({
      ...base,
      phases: fases([...Array(9).fill("Validada"), "Finalizada", "Finalizada"], [
        ...Array(9).fill({ end_date: "2026-08-01" }),
        { start_date: "2026-09-01", end_date: "2026-11-07" },
        { end_date: "2026-11-14" },
      ]),
      activePhaseId: null,
      currentStage: "handover",
      delivery: { kind: "delivered", dateIso: "2026-11-14" },
      updates: [
        { id: "p6", week_number: 6, progress_percentage: 92, created_at: "2026-10-30T10:00:00Z" },
        { id: "c", week_number: 999, progress_percentage: 100, created_at: "2026-11-06T10:00:00Z" },
      ],
    });
    expect(d.delivered).toBe(true);
    expect(d.now).toBe(1);
    expect(d.stage).toBe("handover");
    expect(d.progress).toBe(100);
    expect(d.callout?.context).toEqual(["en el parte", "de cierre"]);
    expect(d.labels.handover).toBe("entregada · 14 nov");
    expect(d.labels.construction).toBe("hecha · 7 nov");
  });
});

describe("layoutDisco", () => {
  it("el disco cabe entero, la llamada no lo pisa y las etiquetas no se solapan", () => {
    for (const variant of ["compacto", "ancho"] as const) {
      for (const now of [0, 0.3, 0.5, 0.55, 0.7, 1]) {
        const d = { ...buildDisco(base), now };
        const L = layoutDisco(d, variant);
        const { W, r } = L.dims;
        expect(L.cx - r).toBeGreaterThanOrEqual(0);
        expect(L.cx + r).toBeLessThanOrEqual(W);
        if (L.callout) {
          // El texto de la llamada queda a un lado del disco
          if (L.callout.anchor === "start") expect(L.callout.x).toBeLessThan(L.cx - r);
          else expect(L.callout.x).toBeGreaterThan(L.cx + r);
        }
        const boxes = L.labels
          .map((l) => {
            const w = Math.max(l.title.length * 9.7, l.sub.length * 6.9);
            const left = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
            return [left, left + w] as const;
          })
          .sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < boxes.length; i++) expect(boxes[i][0]).toBeGreaterThanOrEqual(boxes[i - 1][1] - 1);
      }
    }
  });

  it("el área Saffron es el % real del círculo", () => {
    const r = 56;
    for (const p of [10, 50, 58, 63, 90]) {
      const h = alturaSegmento(p / 100, r);
      const d = r - h;
      const area = (r * r * Math.acos(d / r) - d * Math.sqrt(2 * r * h - h * h)) / (Math.PI * r * r);
      expect(area).toBeCloseTo(p / 100, 4);
    }
    expect(alturaSegmento(0.5, r)).toBeCloseTo(r, 4);
  });
});

describe("formatos", () => {
  it("fechaCorta: año solo si no es el de hoy", () => {
    expect(fechaCorta("2026-09-19", TODAY)).toBe("19 sep");
    expect(fechaCorta("2027-01-08T00:00:00Z", TODAY)).toBe("8 ene 2027");
    expect(fechaCorta(null, TODAY)).toBe("");
  });

  it("phaseNumeral", () => {
    expect(phaseNumeral("Fase 9")).toBe("09");
    expect(phaseNumeral("Fase 10")).toBe("10");
    expect(phaseNumeral("Fase 2.1")).toBe("2.1");
    expect(phaseNumeral("Entrega")).toBe("Entrega");
  });
});
