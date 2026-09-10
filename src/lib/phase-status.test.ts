import { describe, expect, it } from "vitest";
import { getPhaseState } from "./phase-status";

describe("getPhaseState", () => {
  it("normaliza los estados de completado", () => {
    expect(getPhaseState("Validada")).toBe("complete");
    expect(getPhaseState("Finalizada")).toBe("complete");
    expect(getPhaseState("Completado")).toBe("complete");
  });

  it("normaliza los estados en curso", () => {
    expect(getPhaseState("En desarrollo")).toBe("current");
    expect(getPhaseState("Pendiente de revisión cliente")).toBe("current");
    expect(getPhaseState("En Curso")).toBe("current");
  });

  it("normaliza los bloqueos", () => {
    expect(getPhaseState("Bloqueada")).toBe("blocked");
  });

  it("trata desconocidos y vacíos como pendientes (quieto, nunca error)", () => {
    expect(getPhaseState("No iniciada")).toBe("pending");
    expect(getPhaseState("Pendiente")).toBe("pending");
    expect(getPhaseState("estado-inventado")).toBe("pending");
    expect(getPhaseState(null)).toBe("pending");
    expect(getPhaseState(undefined)).toBe("pending");
  });

  it("ignora mayúsculas y espacios", () => {
    expect(getPhaseState("  VALIDADA ")).toBe("complete");
  });
});
