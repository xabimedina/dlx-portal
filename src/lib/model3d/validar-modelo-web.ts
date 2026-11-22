/**
 * Contrato y validación de `modelo_web.json` (estancias y cámaras por estado,
 * lo genera `visor-3d/revit/export_modelo_web.py`). Coordenadas de planta de
 * Revit en metros. Un JSON con errores no se puede publicar; con avisos, sí.
 *
 * La maqueta está desde el inicio de la obra: al principio solo hay estado
 * actual (el levantamiento) y el reformado llega en versiones posteriores. Por
 * eso «fases.reformado» puede faltar o venir sin estancias; el actual, no.
 *
 * COPIA IDÉNTICA en dlx-admin-main/src/lib/model3d/ y dlx-portal-main/src/lib/model3d/
 * (con su test): cambiar las dos a la vez.
 */

export type Punto2 = [number, number];
export type Punto3 = [number, number, number];
export type FaseModelo = "actual" | "reformado";

export interface EstanciaModelo {
  /** WEB_ID: la misma id en los dos estados es «la misma estancia» */
  id: string;
  nombre: string;
  contorno: Punto2[];
  numero?: string;
  nivel?: string;
  /** Cota del suelo en metros (origen interno de Revit): el visor pone ahí el 0 del corte */
  cota?: number;
  area_m2?: number;
  centro?: Punto2;
  caja?: [number, number, number, number];
  /** Dónde poner la etiqueta si el centroide no cae bien (estancias en L) */
  etiqueta?: Punto2;
  nota?: string;
}

export interface CamaraModelo {
  /** «WEB_<estancia>_<nn>», el nombre de la vista de Revit */
  id: string;
  estancia: string;
  ojo: Punto3;
  mira: Punto3;
  arriba?: Punto3;
  fov?: number;
}

export interface EstadoModelo {
  nombre_revit?: string;
  estancias: EstanciaModelo[];
  camaras: CamaraModelo[];
}

export interface ModeloWeb {
  version: 1;
  proyecto?: string;
  altura_libre?: number;
  fases: Record<FaseModelo, EstadoModelo>;
  avisos: string[];
}

export interface ResultadoValidacion {
  ok: boolean;
  errores: string[];
  avisos: string[];
  /** El modelo normalizado (solo los campos conocidos) si no hay errores */
  modelo: ModeloWeb | null;
}

/** ¿Trae el modelo estancias del reformado? (al principio de la obra, no) */
export const tieneReformado = (modelo: ModeloWeb): boolean => modelo.fases.reformado.estancias.length > 0;

const FASES: FaseModelo[] = ["actual", "reformado"];
const ETIQUETA: Record<FaseModelo, string> = { actual: "Estado actual", reformado: "Estado reformado" };
/** Mismo patrón que export_modelo_web.py: ^WEB_(.+?)_(\d+)$ */
const PATRON_CAMARA = /^WEB_(.+?)_(\d+)$/;

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const esTexto = (v: unknown): v is string => typeof v === "string";
const esPunto2 = (v: unknown): v is Punto2 => Array.isArray(v) && v.length === 2 && v.every(esNumero);
const esPunto3 = (v: unknown): v is Punto3 => Array.isArray(v) && v.length === 3 && v.every(esNumero);
const esCaja = (v: unknown): v is [number, number, number, number] => Array.isArray(v) && v.length === 4 && v.every(esNumero);

function areaContorno(contorno: Punto2[]): number {
  let a = 0;
  for (let i = 0; i < contorno.length; i++) {
    const [x0, y0] = contorno[i], [x1, y1] = contorno[(i + 1) % contorno.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a / 2);
}

export function validarModeloWeb(datos: unknown): ResultadoValidacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  const fallo = (): ResultadoValidacion => ({ ok: false, errores, avisos, modelo: null });

  if (!esObjeto(datos)) {
    errores.push("El archivo no es un modelo_web.json (no es un objeto JSON).");
    return fallo();
  }
  if (datos.version !== 1) errores.push(`Versión del archivo no admitida (${String(datos.version)}): se esperaba la 1.`);
  if (datos.unidades !== undefined && datos.unidades !== "m") {
    errores.push(`Las coordenadas deben venir en metros (el archivo dice «${String(datos.unidades)}»).`);
  }
  if (Array.isArray(datos.avisos)) avisos.push(...datos.avisos.filter(esTexto));

  const fasesJson = esObjeto(datos.fases) ? datos.fases : {};
  const fases = {} as Record<FaseModelo, EstadoModelo>;

  for (const fase of FASES) {
    const crudo = fasesJson[fase];
    // Sin reformado todavía: estado vacío (el visor solo enseña el actual)
    if (fase === "reformado" && crudo === undefined) {
      fases.reformado = { estancias: [], camaras: [] };
      continue;
    }
    if (!esObjeto(crudo)) {
      errores.push(`Falta el estado ${fase} («fases.${fase}»).`);
      continue;
    }
    const pre = ETIQUETA[fase];
    const estancias: EstanciaModelo[] = [];
    const camaras: CamaraModelo[] = [];

    if (crudo.estancias !== undefined && !Array.isArray(crudo.estancias)) errores.push(`${pre}: «estancias» debe ser una lista.`);
    else if (fase === "actual" && !(Array.isArray(crudo.estancias) && crudo.estancias.length > 0)) errores.push(`${pre}: no hay ninguna estancia.`);
    const vistas = new Set<string>();
    for (const [i, e] of (Array.isArray(crudo.estancias) ? crudo.estancias : []).entries()) {
      if (!esObjeto(e) || !esTexto(e.id) || !e.id.trim()) {
        errores.push(`${pre}: la estancia n.º ${i + 1} no tiene id (WEB_ID).`);
        continue;
      }
      const id = e.id;
      if (vistas.has(id)) errores.push(`${pre}: la estancia «${id}» está repetida.`);
      vistas.add(id);
      if (!esTexto(e.nombre) || !e.nombre.trim()) errores.push(`${pre}: la estancia «${id}» no tiene nombre.`);
      if (!Array.isArray(e.contorno) || !e.contorno.every(esPunto2)) {
        errores.push(`${pre}: el contorno de «${id}» no es una lista de puntos [x, y].`);
        continue;
      }
      const contorno = e.contorno as Punto2[];
      if (contorno.length < 3) errores.push(`${pre}: el contorno de «${id}» necesita al menos 3 puntos.`);
      else if (areaContorno(contorno) < 1e-6) errores.push(`${pre}: el contorno de «${id}» no encierra superficie (¿habitación sin cerrar en Revit?).`);
      if (e.etiqueta !== undefined && !esPunto2(e.etiqueta)) avisos.push(`${pre}: la etiqueta de «${id}» no es un punto [x, y]; se usa el centro.`);

      estancias.push({
        id,
        nombre: esTexto(e.nombre) ? e.nombre.trim() : "",
        contorno: contorno.map(([x, y]) => [x, y]),
        ...(esTexto(e.numero) ? { numero: e.numero } : {}),
        ...(esTexto(e.nivel) ? { nivel: e.nivel } : {}),
        ...(esNumero(e.cota) ? { cota: e.cota } : {}),
        ...(esNumero(e.area_m2) ? { area_m2: e.area_m2 } : {}),
        ...(esPunto2(e.centro) ? { centro: e.centro } : {}),
        ...(esCaja(e.caja) ? { caja: e.caja } : {}),
        ...(esPunto2(e.etiqueta) ? { etiqueta: e.etiqueta } : {}),
        ...(esTexto(e.nota) && e.nota.trim() ? { nota: e.nota.trim() } : {}),
      });
    }

    if (crudo.camaras !== undefined && !Array.isArray(crudo.camaras)) errores.push(`${pre}: «camaras» debe ser una lista.`);
    const idsCamara = new Set<string>();
    for (const [i, c] of (Array.isArray(crudo.camaras) ? crudo.camaras : []).entries()) {
      if (!esObjeto(c) || !esTexto(c.id) || !c.id.trim()) {
        errores.push(`${pre}: la cámara n.º ${i + 1} no tiene nombre.`);
        continue;
      }
      const id = c.id;
      const patron = PATRON_CAMARA.exec(id);
      if (!patron) errores.push(`${pre}: la cámara «${id}» no sigue el patrón WEB_<estancia>_<nn>.`);
      if (idsCamara.has(id)) errores.push(`${pre}: la cámara ${id} está repetida.`);
      idsCamara.add(id);
      if (!esTexto(c.estancia) || !vistas.has(c.estancia)) {
        errores.push(`${pre}: la cámara ${id} es de la estancia «${String(c.estancia)}», que no existe en ese estado.`);
      } else if (patron && patron[1].toLowerCase() !== c.estancia.toLowerCase()) {
        avisos.push(`${pre}: la cámara ${id} se llama como «${patron[1]}» pero está en «${c.estancia}».`);
      }
      for (const punto of ["ojo", "mira"] as const) {
        if (!esPunto3(c[punto])) errores.push(`${pre}: la cámara ${id} tiene mal el punto «${punto}» (tres números).`);
      }
      if (esTexto(c.estancia) && esPunto3(c.ojo) && esPunto3(c.mira)) {
        camaras.push({
          id,
          estancia: c.estancia,
          ojo: c.ojo,
          mira: c.mira,
          ...(esPunto3(c.arriba) ? { arriba: c.arriba } : {}),
          ...(esNumero(c.fov) ? { fov: c.fov } : {}),
        });
      }
    }

    fases[fase] = {
      ...(esTexto(crudo.nombre_revit) ? { nombre_revit: crudo.nombre_revit } : {}),
      estancias,
      camaras,
    };
  }

  const todas = FASES.flatMap((f) => fases[f]?.estancias ?? []);
  if (todas.length && !todas.some((e) => e.cota !== undefined)) {
    avisos.push("Las estancias no traen «cota» (script de Dynamo anterior): el visor supone el suelo a cota 0; si la maqueta sale flotando o enterrada, vuelve a exportar con el script actual.");
  }

  if (errores.length) return fallo();
  return {
    ok: true,
    errores,
    avisos,
    modelo: {
      version: 1,
      ...(esTexto(datos.proyecto) ? { proyecto: datos.proyecto } : {}),
      ...(esNumero(datos.altura_libre) ? { altura_libre: datos.altura_libre } : {}),
      fases,
      avisos,
    },
  };
}
