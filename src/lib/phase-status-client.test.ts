import { describe, expect, it } from "vitest";
import { phaseStatusClientLabel } from "./phase-status-client";

describe("phaseStatusClientLabel", () => {
  it("traduce la tabla completa de estados internos", () => {
    expect(phaseStatusClientLabel("No iniciada")).toBe("Por llegar");
    expect(phaseStatusClientLabel("En desarrollo")).toBe("En marcha");
    expect(phaseStatusClientLabel("Pendiente de revisión cliente")).toBe("Esperando tu revisión");
    expect(phaseStatusClientLabel("Pendiente de cambios")).toBe("Ajustando tus cambios");
    expect(phaseStatusClientLabel("Validada")).toBe("Validada por ti");
    expect(phaseStatusClientLabel("Bloqueada")).toBe("En espera");
    expect(phaseStatusClientLabel("Finalizada")).toBe("Completada");
  });

  it("los estados históricos laxos caen por getPhaseState, nunca en crudo", () => {
    expect(phaseStatusClientLabel("Completado")).toBe("Completada");
    expect(phaseStatusClientLabel("En Curso")).toBe("En marcha");
    expect(phaseStatusClientLabel("Pendiente")).toBe("Por llegar");
    expect(phaseStatusClientLabel("bloqueado")).toBe("En espera");
  });

  it("desconocidos y vacíos → quietos («Por llegar»), jamás el literal", () => {
    expect(phaseStatusClientLabel("estado-marciano")).toBe("Por llegar");
    expect(phaseStatusClientLabel(null)).toBe("Por llegar");
    expect(phaseStatusClientLabel(undefined)).toBe("Por llegar");
  });
});
