import { describe, expect, it } from "vitest";
import { getPhaseDelay } from "./phase-delay";

describe("getPhaseDelay (portal)", () => {
  it("sin fecha objetivo → null", () => {
    expect(
      getPhaseDelay({ status: "En desarrollo", end_date: null }, "2026-07-11")
    ).toBeNull();
  });

  it("fase abierta en plazo → null", () => {
    expect(
      getPhaseDelay(
        { status: "En desarrollo", end_date: null, target_end_date: "2026-08-01" },
        "2026-07-11"
      )
    ).toBeNull();
  });

  it("fase abierta pasada de fecha → días de retraso", () => {
    expect(
      getPhaseDelay(
        { status: "En Curso", end_date: null, target_end_date: "2026-07-01" },
        "2026-07-11"
      )
    ).toEqual({ days: 10, closed: false });
  });

  it("fase cerrada compara con la fecha real de fin (estados laxos incluidos)", () => {
    expect(
      getPhaseDelay(
        { status: "Completado", end_date: "2026-06-05", target_end_date: "2026-06-01" },
        "2026-07-11"
      )
    ).toEqual({ days: 4, closed: true });
  });

  it("fase cerrada en plazo → null aunque hoy sea posterior al objetivo", () => {
    expect(
      getPhaseDelay(
        { status: "Finalizada", end_date: "2026-05-30", target_end_date: "2026-06-01" },
        "2026-07-11"
      )
    ).toBeNull();
  });
});
