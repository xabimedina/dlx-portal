import { describe, expect, it } from "vitest";
import { gremiosDeAsistentes } from "./attendees";

describe("gremiosDeAsistentes", () => {
  it("«Nombre · gremio» separados por comas: solo el gremio", () => {
    expect(gremiosDeAsistentes("Xabi Medina · estudio, Juan Ramos · fontanería")).toEqual(["Estudio", "Fontanería"]);
  });

  it("solo gremios separados por «·», como sugiere el panel", () => {
    expect(gremiosDeAsistentes("Fontanería · Electricidad")).toEqual(["Fontanería", "Electricidad"]);
  });

  it("mezcla de los dos formatos y sin repetidos", () => {
    expect(gremiosDeAsistentes("Juan Ramos · Fontanería, Electricidad · Pintura, fontanería")).toEqual(["Fontanería", "Electricidad", "Pintura"]);
  });

  it("los gremios de varias palabras en minúscula no se toman por nombres", () => {
    expect(gremiosDeAsistentes("Jefe de obra · Alicatador")).toEqual(["Jefe de obra", "Alicatador"]);
  });

  it("un nombre propio suelto no se enseña", () => {
    expect(gremiosDeAsistentes("Juan Ramos, María de la Fuente · interiorismo")).toEqual(["Interiorismo"]);
  });

  it("vacío", () => {
    expect(gremiosDeAsistentes("")).toEqual([]);
    expect(gremiosDeAsistentes(null)).toEqual([]);
    expect(gremiosDeAsistentes(" , · ")).toEqual([]);
  });
});
