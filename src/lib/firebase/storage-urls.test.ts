import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const firmar = vi.hoisted(() => vi.fn());
vi.mock("./admin", () => ({ adminBucket: () => ({ name: "bucket-de-prueba" }) }));
vi.mock("./storage-read-url", () => ({ getStorageReadUrl: firmar }));

import { withSignedModel3dUrls } from "./storage-urls";

const version = {
  conservado_path: "portal/projects/obra/model3d/v1/conservado.glb",
  demolido_path: "portal/projects/obra/model3d/v1/demolido.glb",
  nuevo_path: "portal/projects/obra/model3d/v1/nuevo.glb",
  modelo_web_path: "portal/projects/obra/model3d/v1/modelo_web.json",
};
const imagen = (id: string) => ({
  id,
  storage_path: `portal/projects/obra/model3d-images/${id}/image.webp`,
  thumbnail_storage_path: `portal/projects/obra/model3d-images/${id}/thumbnail.webp`,
});

beforeEach(() => {
  firmar.mockReset();
  firmar.mockImplementation(async (_bucket: unknown, path: string, expires: number) => `https://firmada.test/${path}?hasta=${expires}`);
});

describe("withSignedModel3dUrls", () => {
  it("firma las tres capas y la imagen y la miniatura de cada foto, con una hora de validez", async () => {
    const antes = Date.now();
    const r = await withSignedModel3dUrls(version, [imagen("a"), imagen("b")]);

    expect(r.modelos).toEqual({
      conservado: expect.stringContaining(version.conservado_path),
      demolido: expect.stringContaining(version.demolido_path),
      nuevo: expect.stringContaining(version.nuevo_path),
    });
    expect(r.imagenes.map((i) => [i.url, i.thumb_url])).toEqual([
      [expect.stringContaining("a/image.webp"), expect.stringContaining("a/thumbnail.webp")],
      [expect.stringContaining("b/image.webp"), expect.stringContaining("b/thumbnail.webp")],
    ]);
    // 3 capas + 2 rutas por imagen; el JSON no se firma (lo lee el servidor)
    expect(firmar).toHaveBeenCalledTimes(7);
    expect(firmar.mock.calls.map((c) => c[1])).not.toContain(version.modelo_web_path);
    const caducidad = firmar.mock.calls[0][2] as number;
    expect(caducidad - antes).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(caducidad - antes).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });

  it("al principio de la obra solo hay conservado: no se firma lo que no existe", async () => {
    const r = await withSignedModel3dUrls({ ...version, demolido_path: null, nuevo_path: null }, []);
    expect(r.modelos).toEqual({ conservado: expect.stringContaining(version.conservado_path) });
    expect(firmar).toHaveBeenCalledTimes(1);
  });

  it("una imagen que no se puede firmar se omite; las capas, no", async () => {
    firmar.mockImplementation(async (_b: unknown, path: string) => {
      if (path.includes("/b/")) throw new Error("sin permiso");
      return `https://firmada.test/${path}`;
    });
    const r = await withSignedModel3dUrls(version, [imagen("a"), imagen("b")]);
    expect(r.imagenes.map((i) => i.id)).toEqual(["a"]);

    firmar.mockRejectedValue(new Error("sin permiso"));
    await expect(withSignedModel3dUrls(version, [])).rejects.toThrow("sin permiso");
  });
});
