import { describe, expect, it } from "vitest";
import {
  getStatusHeadline,
  getDeliveryLine,
  getRecentMilestone,
  getActivePhase,
} from "./status-headline";

const TODAY = "2026-07-12";

function phase(over: Partial<Parameters<typeof getActivePhase>[0][number]> = {}) {
  return {
    id: "f1",
    phase_number: "Fase 1",
    name: "Distribución",
    status: "En desarrollo",
    order_index: 0,
    end_date: null,
    target_end_date: null,
    ...over,
  };
}

describe("getStatusHeadline (tabla de decisión en orden)", () => {
  it("regla 1: Pausado gana a todo", () => {
    const r = getStatusHeadline({
      project: { status: "Pausado", current_phase_id: "f1" },
      phases: [phase({ status: "Bloqueada" })],
      today: TODAY,
    });
    expect(r).toMatchObject({ rule: 1, headline: "Tu proyecto está en pausa", tone: "jet" });
  });

  it("regla 2: Finalizado", () => {
    const r = getStatusHeadline({
      project: { status: "Finalizado" },
      phases: [phase({ status: "Finalizada" })],
      today: TODAY,
    });
    expect(r).toMatchObject({ rule: 2, headline: "Tu casa está terminada", tone: "jet-saffron" });
  });

  it("regla 3: sin fases → arranca pronto (con fecha de arranque si existe)", () => {
    const r = getStatusHeadline({
      project: { status: "Activo", start_date: "2026-09-01" },
      phases: [],
      today: TODAY,
    });
    expect(r.rule).toBe(3);
    expect(r.headline).toBe("Tu proyecto arranca pronto");
    expect(r.chip).toBe("Arranque: 1 de septiembre de 2026");
  });

  it("regla 3: todas las fases quietas equivale a sin arrancar", () => {
    const r = getStatusHeadline({
      project: { status: "Activo" },
      phases: [phase({ status: "No iniciada" }), phase({ id: "f2", status: "Pendiente", order_index: 1 })],
      today: TODAY,
    });
    expect(r.rule).toBe(3);
    expect(r.chip).toBeNull();
  });

  it("regla 4: bloqueada CON decisión pendiente de esa fase → depende de ti", () => {
    const r = getStatusHeadline({
      project: { status: "Activo", current_phase_id: "f1" },
      phases: [phase({ status: "Bloqueada" })],
      decisions: [{ status: "Pendiente", phase_id: "f1" }],
      today: TODAY,
    });
    expect(r).toMatchObject({
      rule: 4,
      headline: "En espera: hay un punto por resolver",
      detail: "— y depende de ti",
      dependsOnYou: true,
      tone: "amber",
    });
  });

  it("regla 4: bloqueada SIN decisión dependiente → el estudio está en ello", () => {
    const r = getStatusHeadline({
      project: { status: "Activo", current_phase_id: "f1" },
      phases: [phase({ status: "Bloqueada" })],
      decisions: [{ status: "Pendiente", phase_id: "otra-fase" }],
      today: TODAY,
    });
    expect(r.detail).toBe("— el estudio está en ello");
    expect(r.dependsOnYou).toBe(false);
  });

  it("regla 5: retraso ABIERTO sobre el objetivo, con chip humanizado", () => {
    const r = getStatusHeadline({
      project: { status: "Activo", current_phase_id: "f1" },
      phases: [phase({ status: "En desarrollo", target_end_date: "2026-07-04" })],
      today: TODAY,
    });
    expect(r).toMatchObject({
      rule: 5,
      headline: "En marcha, con 8 días sobre el objetivo de esta fase",
      tone: "amber",
      chip: "Objetivo de la fase: 4 de julio de 2026",
    });
  });

  it("regla 5: singular «1 día» y mención de la fase si la retrasada no es la activa", () => {
    const r = getStatusHeadline({
      project: { status: "Activo", current_phase_id: "f2" },
      phases: [
        phase({ id: "f1", phase_number: "Fase 1", status: "En desarrollo", target_end_date: "2026-07-11" }),
        phase({ id: "f2", phase_number: "Fase 2", status: "En desarrollo", order_index: 1 }),
      ],
      today: TODAY,
    });
    expect(r.headline).toBe("En marcha, con 1 día sobre el objetivo de la Fase 1");
  });

  it("un retraso CERRADO (fase acabada tarde) no dispara la regla 5", () => {
    const r = getStatusHeadline({
      project: { status: "Activo", current_phase_id: "f2" },
      phases: [
        phase({ id: "f1", status: "Finalizada", end_date: "2026-07-08", target_end_date: "2026-07-01" }),
        phase({ id: "f2", status: "En desarrollo", order_index: 1, target_end_date: "2026-08-01" }),
      ],
      today: TODAY,
    });
    expect(r).toMatchObject({ rule: 6, headline: "En marcha, al día con el objetivo", tone: "jet" });
  });

  it("regla 7: sin target_end_date no se afirma «al día»", () => {
    const r = getStatusHeadline({
      project: { status: "Activo", current_phase_id: "f1" },
      phases: [phase({ status: "En desarrollo" })],
      today: TODAY,
    });
    expect(r).toMatchObject({ rule: 7, headline: "En marcha", tone: "jet" });
  });
});

describe("getDeliveryLine", () => {
  it("estimación normal", () => {
    expect(
      getDeliveryLine({ status: "Activo", estimated_end_date: "2026-11-15" }, [])
    ).toEqual({ kind: "estimate", dateIso: "2026-11-15" });
  });

  it("sin fecha estimada → unset (el estudio aún no la ha fijado)", () => {
    expect(getDeliveryLine({ status: "Activo", estimated_end_date: null }, [])).toEqual({
      kind: "unset",
    });
  });

  it("pausado → en revisión durante la pausa", () => {
    expect(
      getDeliveryLine({ status: "Pausado", estimated_end_date: "2026-11-15" }, [])
    ).toEqual({ kind: "paused", dateIso: "2026-11-15" });
  });

  it("finalizado → entregada con el end_date de la última fase completada", () => {
    expect(
      getDeliveryLine({ status: "Finalizado", estimated_end_date: "2026-11-15" }, [
        phase({ id: "f1", status: "Finalizada", end_date: "2026-10-01" }),
        phase({ id: "f2", status: "Finalizada", end_date: "2026-10-20", order_index: 1 }),
      ])
    ).toEqual({ kind: "delivered", dateIso: "2026-10-20" });
  });
});

describe("getRecentMilestone", () => {
  it("fase completada en los últimos 14 días", () => {
    const hit = getRecentMilestone(
      [phase({ status: "Validada", end_date: "2026-07-05" })],
      TODAY
    );
    expect(hit).toMatchObject({ phaseNumber: "Fase 1", endDate: "2026-07-05" });
  });

  it("nada si la última completada es antigua", () => {
    expect(
      getRecentMilestone([phase({ status: "Finalizada", end_date: "2026-05-01" })], TODAY)
    ).toBeNull();
  });
});
