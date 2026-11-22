import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tieneReformado, validarModeloWeb } from "./validar-modelo-web";

// Contrato de ejemplo (lo que genera visor-3d/revit/export_modelo_web.py)
const texto = readFileSync(new URL("../../../../visor-3d/datos/modelo_web.ejemplo.json", import.meta.url), "utf8");
/** Copia nueva del ejemplo para poder estropearla en cada caso */
const ejemplo = () => JSON.parse(texto);

describe("validarModeloWeb", () => {
  it("el JSON de ejemplo es válido y sin avisos", () => {
    const r = validarModeloWeb(ejemplo());
    expect(r.errores).toEqual([]);
    expect(r.avisos).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.modelo?.fases.actual.estancias).toHaveLength(6);
    expect(r.modelo?.fases.reformado.estancias).toHaveLength(5);
    expect(r.modelo?.fases.reformado.camaras.map((c) => c.id)).toContain("WEB_salon_02");
  });

  it("los avisos del propio JSON pasan tal cual y no impiden publicar", () => {
    const j = ejemplo();
    j.avisos = ["La cámara 'WEB_cocina_01' está dentro de 'Salón', no de 'Cocina'."];
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(true);
    expect(r.avisos).toEqual(["La cámara 'WEB_cocina_01' está dentro de 'Salón', no de 'Cocina'."]);
  });

  it("id de estancia repetida en una fase", () => {
    const j = ejemplo();
    j.fases.actual.estancias[1].id = "salon";
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(false);
    expect(r.errores).toContain("Estado actual: la estancia «salon» está repetida.");
  });

  it("contorno de 2 puntos y contorno sin área", () => {
    const j = ejemplo();
    j.fases.reformado.estancias[2].contorno = [[6, 3.3], [10, 3.3]];
    j.fases.reformado.estancias[3].contorno = [[0, 0], [1, 0], [2, 0]];
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(false);
    expect(r.errores).toContain("Estado reformado: el contorno de «distribuidor» necesita al menos 3 puntos.");
    expect(r.errores).toContain("Estado reformado: el contorno de «bano» no encierra superficie (¿habitación sin cerrar en Revit?).");
  });

  it("cámara huérfana: su estancia no existe en esa fase", () => {
    const j = ejemplo();
    j.fases.reformado.camaras.push({ ...j.fases.reformado.camaras[0], id: "WEB_cocina_01", estancia: "cocina" });
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(false);
    expect(r.errores).toContain("Estado reformado: la cámara WEB_cocina_01 es de la estancia «cocina», que no existe en ese estado.");
  });

  it("nombre de cámara fuera del patrón y cámara repetida", () => {
    const j = ejemplo();
    j.fases.actual.camaras[0].id = "Vista 3D 1";
    j.fases.actual.camaras[2].id = "WEB_cocina_01";
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(false);
    expect(r.errores).toContain("Estado actual: la cámara «Vista 3D 1» no sigue el patrón WEB_<estancia>_<nn>.");
    expect(r.errores).toContain("Estado actual: la cámara WEB_cocina_01 está repetida.");
  });

  it("cámara cuyo nombre apunta a otra estancia: aviso, no error", () => {
    const j = ejemplo();
    j.fases.actual.camaras[1].estancia = "salon"; // WEB_cocina_01 asignada al salón
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(true);
    expect(r.avisos).toContain("Estado actual: la cámara WEB_cocina_01 se llama como «cocina» pero está en «salon».");
  });

  it("sin «cota» en ninguna estancia: aviso (se supone el suelo a 0)", () => {
    const j = ejemplo();
    for (const f of ["actual", "reformado"]) for (const e of j.fases[f].estancias) delete e.cota;
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(true);
    expect(r.avisos).toEqual([expect.stringContaining("no traen «cota»")]);
    expect(r.modelo?.fases.actual.estancias[0].cota).toBeUndefined();
  });

  it("la cota pasa al modelo", () => {
    const j = ejemplo();
    j.fases.actual.estancias[0].cota = 9.15;
    expect(validarModeloWeb(j).modelo?.fases.actual.estancias[0].cota).toBe(9.15);
  });

  it("sin estado actual no hay maqueta", () => {
    const j = ejemplo();
    delete j.fases.actual;
    const r = validarModeloWeb(j);
    expect(r.ok).toBe(false);
    expect(r.modelo).toBeNull();
    expect(r.errores).toContain("Falta el estado actual («fases.actual»).");
    const k = ejemplo();
    k.fases.actual.estancias = [];
    expect(validarModeloWeb(k).errores).toContain("Estado actual: no hay ninguna estancia.");
  });

  it("al principio de la obra basta el estado actual: sin reformado o con el reformado vacío", () => {
    const j = ejemplo();
    delete j.fases.reformado;
    const r = validarModeloWeb(j);
    expect(r.errores).toEqual([]);
    expect(r.modelo?.fases.reformado).toEqual({ estancias: [], camaras: [] });
    expect(r.modelo && tieneReformado(r.modelo)).toBe(false);

    const k = ejemplo();
    k.fases.reformado = { nombre_revit: "Nueva construcción", estancias: [], camaras: [] };
    const s = validarModeloWeb(k);
    expect(s.ok).toBe(true);
    expect(s.modelo && tieneReformado(s.modelo)).toBe(false);

    const completo = validarModeloWeb(ejemplo()).modelo;
    expect(completo && tieneReformado(completo)).toBe(true);
  });

  it("versión, unidades y forma general", () => {
    expect(validarModeloWeb(null).errores).toEqual(["El archivo no es un modelo_web.json (no es un objeto JSON)."]);
    expect(validarModeloWeb({ ...ejemplo(), version: 2 }).errores).toContain("Versión del archivo no admitida (2): se esperaba la 1.");
    expect(validarModeloWeb({ ...ejemplo(), unidades: "mm" }).errores).toContain("Las coordenadas deben venir en metros (el archivo dice «mm»).");
  });

  it("estancia sin nombre y cámara con coordenadas rotas", () => {
    const j = ejemplo();
    j.fases.actual.estancias[0].nombre = "  ";
    j.fases.actual.camaras[0].ojo = [1, "a", 2];
    const r = validarModeloWeb(j);
    expect(r.errores).toContain("Estado actual: la estancia «salon» no tiene nombre.");
    expect(r.errores).toContain("Estado actual: la cámara WEB_salon_01 tiene mal el punto «ojo» (tres números).");
  });
});
