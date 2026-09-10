import { describe, expect, it } from "vitest";
import { extractProjectIdFromPath } from "./storage-paths";

describe("extractProjectIdFromPath", () => {
  it("extrae el projectId del formato canónico portal/projects/{id}/...", () => {
    expect(
      extractProjectIdFromPath("portal/projects/abc123/project-documents/Plano/plano.pdf")
    ).toBe("abc123");
    expect(extractProjectIdFromPath("portal/projects/abc123/photos/p1/image.webp")).toBe("abc123");
  });

  it("rechaza rutas fuera del árbol del portal", () => {
    // Portfolio de dlx-web
    expect(extractProjectIdFromPath("projects/images/foto.webp")).toBeNull();
    // Formato legado {projectId}/... (antes lo aceptaba el fallback permisivo)
    expect(extractProjectIdFromPath("abc123/secreto.pdf")).toBeNull();
    expect(extractProjectIdFromPath("blog/images/portada.webp")).toBeNull();
    expect(extractProjectIdFromPath("")).toBeNull();
  });

  it("rechaza el prefijo sin projectId", () => {
    expect(extractProjectIdFromPath("portal/projects/")).toBeNull();
    expect(extractProjectIdFromPath("portal/projects")).toBeNull();
  });

  it("no se deja engañar por 'projects' en otra posición", () => {
    expect(extractProjectIdFromPath("otra/portal/projects/abc123/f.pdf")).toBeNull();
  });
});
