/**
 * Estilo del estudio en el 3D: maqueta blanca sobre papel, líneas finas en
 * gris medio, azafrán para la obra nueva (en Reformado) y la selección, y
 * rojo suave discontinuo para lo que se derriba. Revit solo aporta geometría:
 * los materiales del GLB se descartan. (La demo aprobada era sobre Jet con
 * aristas negras; Xabier pidió el aspecto de lámina axonométrica el
 * 2026-10-28 y el proceso Actual → Derribos → Reformado el 2026-10-29.)
 */
import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import type { Rol } from "./roles";

export type Capa = "conservado" | "demolido" | "nuevo";
/** Las tres pestañas, en el orden de la obra: cómo está, qué se derriba, cómo quedará */
export type Modo = "actual" | "derribos" | "reformado";

export const CAPAS: Capa[] = ["conservado", "demolido", "nuevo"];

// Tokens del design system (mismos valores que el CSS del visor)
export const C = {
  jet: "#333533", jet950: "#1e201e", jet800: "#333533", jet700: "#43463f", jet500: "#6e726b",
  jet400: "#8c9089", jet300: "#aeb1ab", jet200: "#cfd1cd", jet100: "#e6e7e4", smoke: "#f5f3f4",
  saffron: "#eeba0b",
  /** Fondo del lienzo: blanco roto cálido */
  papel: "#f1efeb",
} as const;

export const ROL_FILL: Record<Rol, string> = { muro: "#fbfaf8", acabado: "#fbfaf8", mobiliario: "#ebe9e4", cocina: "#e2e0db", sanitario: "#ffffff" };

export type LineaId = "ink" | "inkSoft" | "inkNuevo" | "derribo" | "secInk" | "secNuevo" | "secDerribo";
export type Mirada = "normal" | "derribo" | "nuevo";

export interface Look {
  fill: (rol: Rol) => string;
  opacity: number;
  edge: (rol: Rol) => LineaId;
  sec: LineaId;
  /** Color de la tapa de corte (el poché del dibujo) */
  cap: (rol: Rol) => string;
  shadow: boolean;
}

/** Los acabados (capas finas) dibujan sus aristas más flojas: si no, cada pared se ve con doble línea */
const arista = (fuerte: LineaId, acabado: LineaId) => (rol: Rol): LineaId => (rol === "acabado" ? acabado : fuerte);
/**
 * Poché: lo que corta el plano se rellena oscuro, como en un plano de planta.
 * Muros y acabados casi negro; muebles cortados, gris oscuro.
 */
const poche = (muro: string, resto: string) => (rol: Rol) => (rol === "muro" || rol === "acabado" ? muro : resto);
/**
 * En Reformado va en azafrán todo lo nuevo (tabiques, puertas, cocina, baño y
 * muebles) salvo los acabados: la pintura y los suelos cubren toda la casa y
 * la teñirían entera.
 */
const enAzafran = (rol: Rol) => rol !== "acabado";

/** Rojo suave de los derribos */
export const ROJO = { relleno: "#eba79c", acabado: "#f8e6e2", linea: "#c4513f", seccion: "#a8402f", tapa: "#e29384" } as const;

// Tres miradas sobre cada capa según el modo
export const LOOK: Record<Mirada, Look> = {
  normal: { fill: (rol) => ROL_FILL[rol], opacity: 1, edge: arista("ink", "inkSoft"), sec: "secInk", cap: poche(C.jet700, C.jet500), shadow: true },
  // Lo que se derriba, en rojo suave y discontinuo; un suelo o un alicatado que se levanta, apenas rosado, para que manden los tabiques
  derribo: {
    fill: (rol) => (rol === "acabado" ? ROJO.acabado : ROJO.relleno),
    opacity: 0.4,
    edge: arista("derribo", "inkSoft"),
    sec: "secDerribo",
    cap: () => ROJO.tapa,
    shadow: false,
  },
  nuevo: {
    fill: (rol) => (enAzafran(rol) ? C.saffron : ROL_FILL[rol]),
    opacity: 1,
    edge: (rol) => (enAzafran(rol) ? "inkNuevo" : "inkSoft"),
    sec: "secNuevo",
    cap: (rol) => (enAzafran(rol) ? "#9a7400" : C.jet700),
    shadow: true,
  },
};

export const MODE_STYLE: Record<Modo, Record<Capa, Mirada | null>> = {
  actual: { conservado: "normal", demolido: "normal", nuevo: null },
  derribos: { conservado: "normal", demolido: "derribo", nuevo: null },
  reformado: { conservado: "normal", demolido: null, nuevo: "nuevo" },
};

/** Derribos se mira sobre la distribución de hoy: estancias, fotos y cámaras del estado actual */
export const faseDe = (modo: Modo): "actual" | "reformado" => (modo === "reformado" ? "reformado" : "actual");

export interface Materiales {
  /** Relleno de modelo, recortado por el plano de corte de su capa */
  malla: (color: string, clip: THREE.Plane[]) => THREE.MeshLambertMaterial;
  /** Juego de líneas de una capa (cada capa el suyo: se desvanece sola al cambiar de estado) */
  lineas: (clip: THREE.Plane[]) => Record<LineaId, LineMaterial>;
  /** Contorno de la estancia seleccionada */
  sel: LineMaterial;
  /** Ajusta el grosor de todas las líneas al tamaño del lienzo (obligatorio en cada cambio) */
  resolucion: (ancho: number, alto: number) => void;
  dispose: () => void;
}

export function crearMateriales(): Materiales {
  const creados: THREE.Material[] = [];
  const todasLineas: LineMaterial[] = [];
  let res: [number, number] = [1, 1];
  const malla = (color: string, clip: THREE.Plane[]) => {
    const m = new THREE.MeshLambertMaterial({ color, clippingPlanes: clip, clipShadows: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    creados.push(m);
    return m;
  };
  const linea = (color: string, linewidth: number, clip: THREE.Plane[], dashed = false) => {
    const m = new LineMaterial({ color, linewidth, dashed, dashSize: 0.12, gapSize: 0.08, clippingPlanes: clip });
    m.resolution.set(...res);
    todasLineas.push(m);
    return m;
  };
  return {
    malla,
    lineas: (clip) => ({
      ink: linea("#7b7f78", 1, clip),
      inkSoft: linea("#a7aaa3", 0.9, clip),
      inkNuevo: linea("#a57d00", 1, clip),
      derribo: linea(ROJO.linea, 1.3, clip, true),
      // La línea de sección va justo en el plano de corte (no se recorta) y es lo que más pesa del dibujo
      secInk: linea(C.jet950, 2.4, []),
      secNuevo: linea("#5c4500", 2.4, []),
      secDerribo: linea(ROJO.seccion, 2, [], true),
    }),
    sel: linea(C.saffron, 2.2, []),
    resolucion: (ancho, alto) => {
      res = [ancho, alto];
      for (const m of todasLineas) m.resolution.set(ancho, alto);
    },
    dispose: () => {
      for (const m of creados) m.dispose();
      for (const m of todasLineas) m.dispose();
    },
  };
}
