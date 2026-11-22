import { describe, expect, it } from "vitest";
import { buscarCamara, parseNombreCamara } from "./nombre-camara";

describe("parseNombreCamara", () => {
  it("WEB_<estancia>_<nn>.jpg asigna estancia y cámara", () => {
    expect(parseNombreCamara("WEB_salon_01.jpg")).toEqual({ estancia: "salon", n: 1, camaraId: "WEB_salon_01", aviso: null });
    expect(parseNombreCamara("WEB_dorm2_03.webp")).toEqual({ estancia: "dorm2", n: 3, camaraId: "WEB_dorm2_03", aviso: null });
  });

  it("tolera mayúsculas y espacios alrededor", () => {
    expect(parseNombreCamara("web_SALON_01.JPG")).toEqual({ estancia: "salon", n: 1, camaraId: "WEB_salon_01", aviso: null });
    expect(parseNombreCamara("  WEB_salon_01 .png")).toMatchObject({ camaraId: "WEB_salon_01", aviso: null });
  });

  it("estancias con guion o guion bajo en el id", () => {
    expect(parseNombreCamara("WEB_salon-cocina_02.jpg")).toMatchObject({ estancia: "salon-cocina", n: 2, camaraId: "WEB_salon-cocina_02" });
    expect(parseNombreCamara("WEB_dorm_1_02.jpg")).toMatchObject({ estancia: "dorm_1", n: 2, camaraId: "WEB_dorm_1_02" });
  });

  it("conserva el número tal cual lo escribió Revit", () => {
    expect(parseNombreCamara("WEB_bano_1.jpg")).toMatchObject({ n: 1, camaraId: "WEB_bano_1" });
  });

  it("sufijos de copia: misma cámara, con aviso", () => {
    const r = parseNombreCamara("WEB_salon_01 (2).jpg");
    expect(r).toMatchObject({ estancia: "salon", n: 1, camaraId: "WEB_salon_01" });
    expect(r?.aviso).toBe("El nombre lleva «(2)» detrás del número: se asigna a WEB_salon_01.");
    expect(parseNombreCamara("WEB_salon_01 - copia.jpg")).toMatchObject({ camaraId: "WEB_salon_01", aviso: expect.stringContaining("copia") });
  });

  it("devuelve null si no sigue el patrón", () => {
    expect(parseNombreCamara("IMG_2034.jpg")).toBeNull();
    expect(parseNombreCamara("WEB_salon.jpg")).toBeNull();
    expect(parseNombreCamara("WEB__01.jpg")).toBeNull();
    expect(parseNombreCamara("salon_01.jpg")).toBeNull();
    expect(parseNombreCamara("")).toBeNull();
  });
});

describe("buscarCamara", () => {
  const camaras = [
    { id: "WEB_salon_01", estancia: "salon" },
    { id: "WEB_salon_2", estancia: "salon" },
    { id: "WEB_cocina_01", estancia: "cocina" },
  ];

  it("por id exacto, sin distinguir mayúsculas", () => {
    expect(buscarCamara(parseNombreCamara("web_SALON_01.jpg")!, camaras)?.id).toBe("WEB_salon_01");
  });

  it("por estancia y número aunque cambien los ceros", () => {
    expect(buscarCamara(parseNombreCamara("WEB_salon_02.jpg")!, camaras)?.id).toBe("WEB_salon_2");
    expect(buscarCamara(parseNombreCamara("WEB_cocina_1.jpg")!, camaras)?.id).toBe("WEB_cocina_01");
  });

  it("null si la cámara no existe en la versión", () => {
    expect(buscarCamara(parseNombreCamara("WEB_salon_03.jpg")!, camaras)).toBeNull();
    expect(buscarCamara(parseNombreCamara("WEB_bano_01.jpg")!, camaras)).toBeNull();
  });
});
