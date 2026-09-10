import { describe, expect, it } from "vitest";
import { weekLabel, CLOSING_WEEK_NUMBER } from "./week-label";

describe("weekLabel", () => {
  it("muestra el número de semana normal", () => {
    expect(weekLabel(1)).toBe("Semana 1");
    expect(weekLabel(42)).toBe("Semana 42");
  });

  it("muestra el hito de entrega como 'Cierre' (nunca 'Semana 999')", () => {
    expect(weekLabel(CLOSING_WEEK_NUMBER)).toBe("Cierre");
    expect(weekLabel(999)).toBe("Cierre");
  });
});
