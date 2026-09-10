import { describe, expect, it } from "vitest";
import {
  formatDateEs,
  formatDayMonthEs,
  daysBetween,
  relativeDaysEs,
} from "./format-date-es";

describe("formatDateEs", () => {
  it("humaniza una fecha date-only sin pasar por Date (sin desfase UTC)", () => {
    expect(formatDateEs("2026-11-15")).toBe("15 de noviembre de 2026");
    expect(formatDateEs("2026-07-04")).toBe("4 de julio de 2026");
  });

  it("acepta timestamps ISO usando solo la parte de fecha", () => {
    expect(formatDateEs("2026-07-30T17:00:00Z")).toBe("30 de julio de 2026");
  });

  it("valores nulos o no-fecha → cadena vacía (el caller decide el copy)", () => {
    expect(formatDateEs(null)).toBe("");
    expect(formatDateEs(undefined)).toBe("");
    expect(formatDateEs("N/A")).toBe("");
    expect(formatDateEs("")).toBe("");
  });
});

describe("formatDayMonthEs", () => {
  it("día y mes sin año", () => {
    expect(formatDayMonthEs("2026-07-03")).toBe("3 de julio");
  });
});

describe("daysBetween", () => {
  it("cuenta días entre date-only", () => {
    expect(daysBetween("2026-07-04", "2026-07-12")).toBe(8);
    expect(daysBetween("2026-07-12", "2026-07-12")).toBe(0);
  });
});

describe("relativeDaysEs", () => {
  it("hoy / ayer / hace N días", () => {
    expect(relativeDaysEs("2026-07-12", "2026-07-12")).toBe("hoy");
    expect(relativeDaysEs("2026-07-11", "2026-07-12")).toBe("ayer");
    expect(relativeDaysEs("2026-07-08", "2026-07-12")).toBe("hace 4 días");
  });

  it("a partir de 14 días pasa a semanas, y a meses desde 60", () => {
    expect(relativeDaysEs("2026-06-28", "2026-07-12")).toBe("hace 2 semanas");
    expect(relativeDaysEs("2026-04-01", "2026-07-12")).toBe("hace 3 meses");
  });
});
