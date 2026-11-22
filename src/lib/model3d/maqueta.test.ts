import { describe, expect, it } from "vitest";
import { etiquetaVersion, imagenesParaVisor } from "./maqueta";
import type { PortalModel3dImagen } from "@/types/portal";

const base: PortalModel3dImagen = {
  id: "i1",
  project_id: "obra",
  estado: "reformado",
  tipo: "render",
  estancia_id: "salon",
  camara_id: "WEB_salon_02",
  titulo: "Salón desde la cocina",
  orden: 2,
  storage_path: "portal/projects/obra/model3d-images/i1/image.webp",
  thumbnail_storage_path: "portal/projects/obra/model3d-images/i1/thumbnail.webp",
  width: 2000,
  height: 1333,
  original_file_size: 1,
  compressed_file_size: 1,
  created_at: "2026-10-10T10:00:00.000Z",
};

describe("imagenesParaVisor", () => {
  it("pasa estancia, cámara, número y las URLs firmadas", () => {
    expect(imagenesParaVisor([{ ...base, url: "https://g", thumb_url: "https://m" }])).toEqual([
      { id: "i1", estado: "reformado", estancia: "salon", camara: "WEB_salon_02", tipo: "render", n: 2, titulo: "Salón desde la cocina", url: "https://g", thumbUrl: "https://m" },
    ]);
  });

  it("una imagen sin cámara sigue sin cámara (solo galería, sin vuelo)", () => {
    expect(imagenesParaVisor([{ ...base, camara_id: null, url: "u", thumb_url: "t" }])[0].camara).toBeNull();
  });
});

describe("etiquetaVersion", () => {
  it("cuándo se actualizó (la publicación; si no, la subida)", () => {
    expect(etiquetaVersion({ published_at: "2026-10-12T09:30:00.000Z", created_at: "2026-10-01T09:00:00.000Z" })).toBe("Actualizada el 12 de octubre de 2026");
    expect(etiquetaVersion({ published_at: null, created_at: "2026-10-01T09:00:00.000Z" })).toBe("Actualizada el 1 de octubre de 2026");
  });

  it("el día es el de España, no el de UTC", () => {
    // 22:30 UTC del 10 = 00:30 del 11 en Madrid (horario de verano)
    expect(etiquetaVersion({ published_at: "2026-10-10T22:30:00.000Z", created_at: "2026-10-10T22:00:00.000Z" })).toBe("Actualizada el 11 de octubre de 2026");
    // 23:30 UTC del 31 de diciembre = 00:30 del 1 de enero en Madrid (invierno, +1)
    expect(etiquetaVersion({ published_at: "2026-12-31T23:30:00.000Z", created_at: "2026-12-31T23:00:00.000Z" })).toBe("Actualizada el 1 de enero de 2027");
  });
});
