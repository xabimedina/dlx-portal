import { describe, expect, it } from "vitest";
import { sortClientProjects } from "./project-sort";

const p = (id: string, status: string, created_at: string) => ({ id, status, created_at });

describe("sortClientProjects", () => {
  it("pone los proyectos activos primero", () => {
    const sorted = sortClientProjects([
      p("finalizado-reciente", "Finalizado", "2026-06-01"),
      p("activo-antiguo", "Activo", "2025-01-01"),
    ]);
    expect(sorted.map(x => x.id)).toEqual(["activo-antiguo", "finalizado-reciente"]);
  });

  it("dentro de cada grupo, los más recientes primero", () => {
    const sorted = sortClientProjects([
      p("a", "Activo", "2026-01-01"),
      p("b", "Activo", "2026-06-01"),
      p("c", "Pausado", "2026-03-01"),
      p("d", "Finalizado", "2026-05-01"),
    ]);
    expect(sorted.map(x => x.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("tolera created_at ausente y no muta el array original", () => {
    const input = [p("a", "Activo", ""), p("b", "Activo", "2026-06-01")];
    const sorted = sortClientProjects(input);
    expect(sorted.map(x => x.id)).toEqual(["b", "a"]);
    expect(input.map(x => x.id)).toEqual(["a", "b"]);
  });
});
