/**
 * Piso de ejemplo del visor 3D: los mismos datos que la demo aprobada
 * (`visor-3d/demo/index.html`) y la exportación de sus tres capas a GLB, que
 * son las fixtures del banco E2E. Sin DOM ni imports relativos: lo carga
 * `scripts/generar-fixtures-visor.mjs` directamente con Node.
 *
 * Coordenadas de planta en metros: x hacia la derecha, y hacia el norte.
 * En three.js la planta y va a -z: (x, y, z)_revit → (x, z, -y)_three.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

export type Capa = "conservado" | "demolido" | "nuevo";
export type Cat = "muro" | "mobiliario" | "cocina" | "sanitario";
export type Fase = "actual" | "reformado";
export type Punto = [number, number];

interface Hueco {
  at: number;
  w: number;
  /** Alféizar (0 = puerta) */
  b?: number;
  /** Dintel */
  t?: number;
}

export interface Muro {
  layer: Capa;
  axis: "x" | "y";
  p: number;
  a: number;
  b: number;
  t: number;
  op?: Hueco[];
}

export interface Mueble {
  layer: Capa;
  cat: Exclude<Cat, "muro">;
  nombre: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
}

export interface EstanciaEjemplo {
  id: string;
  nombre: string;
  poly: Punto[];
  nota: string;
  lab?: Punto;
}

export interface ImagenEjemplo {
  estado: Fase;
  room: string;
  n: number;
  eye: Punto;
  at: Punto;
  titulo?: string;
}

export const CAPAS: Capa[] = ["conservado", "demolido", "nuevo"];

export const H = 2.7; // altura libre
export const CENTER = { x: 5, y: 3.75 }; // centro de la vivienda en planta

export const WALLS: Muro[] = [
  // Cerramientos exteriores (se conservan). Ventanas: alféizar 0,90 / dintel 2,20
  { layer: "conservado", axis: "x", p: -0.15, a: -0.3, b: 10.3, t: 0.3, op: [{ at: 1.5, w: 1.4, b: 0.9, t: 2.2 }, { at: 4.0, w: 1.4, b: 0.9, t: 2.2 }, { at: 8.0, w: 1.2, b: 0.9, t: 2.2 }] },
  { layer: "conservado", axis: "x", p: 7.65, a: -0.3, b: 10.3, t: 0.3, op: [{ at: 1.75, w: 1.2, b: 0.9, t: 2.2 }, { at: 4.5, w: 0.6, b: 1.3, t: 2.0 }, { at: 7.75, w: 1.4, b: 0.9, t: 2.2 }] },
  { layer: "conservado", axis: "y", p: -0.15, a: 0, b: 7.5, t: 0.3 },
  { layer: "conservado", axis: "y", p: 10.15, a: 0, b: 7.5, t: 0.3, op: [{ at: 3.9, w: 0.9 }] }, // puerta de entrada
  // Tabiquería existente
  { layer: "demolido", axis: "y", p: 6.0, a: 0, b: 3.24, t: 0.12 }, // salón / dormitorio 2
  { layer: "demolido", axis: "x", p: 3.3, a: 0, b: 5.94, t: 0.12, op: [{ at: 3.0, w: 0.9 }] }, // salón / pasillo
  { layer: "conservado", axis: "x", p: 3.3, a: 5.94, b: 10, t: 0.12, op: [{ at: 8.0, w: 0.9 }] }, // dormitorio 2 / pasillo
  { layer: "demolido", axis: "x", p: 4.5, a: 0, b: 3.44, t: 0.12, op: [{ at: 1.8, w: 0.9 }] }, // cocina / pasillo
  { layer: "conservado", axis: "x", p: 4.5, a: 3.44, b: 5.56, t: 0.12, op: [{ at: 4.5, w: 0.8 }] }, // baño / pasillo
  { layer: "conservado", axis: "x", p: 4.5, a: 5.56, b: 10, t: 0.12, op: [{ at: 7.75, w: 0.9 }] }, // dormitorio 1 / pasillo
  { layer: "conservado", axis: "y", p: 3.5, a: 4.56, b: 7.5, t: 0.12 }, // cocina / baño
  { layer: "conservado", axis: "y", p: 5.5, a: 4.56, b: 7.5, t: 0.12 }, // baño / dormitorio 1
  // Obra nueva: el tabique del dormitorio 2 se desplaza 60 cm hacia el salón
  { layer: "nuevo", axis: "y", p: 5.4, a: 0, b: 3.24, t: 0.12 },
  { layer: "nuevo", axis: "x", p: 3.3, a: 5.34, b: 5.94, t: 0.12 },
];

// Mobiliario y equipamiento (cajas: x, y, ancho, fondo, alto)
export const FURN: Mueble[] = [
  // Estado actual: se retira
  { layer: "demolido", cat: "mobiliario", nombre: "Sofá", x: 0.15, y: 0.7, w: 0.9, d: 2.0, h: 0.72 },
  { layer: "demolido", cat: "mobiliario", nombre: "Mesa baja", x: 1.5, y: 1.3, w: 0.9, d: 0.5, h: 0.4 },
  { layer: "demolido", cat: "mobiliario", nombre: "Mueble TV", x: 5.4, y: 0.9, w: 0.5, d: 1.5, h: 0.5 },
  { layer: "demolido", cat: "mobiliario", nombre: "Mesa de comedor", x: 3.0, y: 1.6, w: 1.4, d: 0.8, h: 0.75 },
  { layer: "demolido", cat: "mobiliario", nombre: "Cama", x: 8.1, y: 0.9, w: 1.9, d: 1.4, h: 0.5 },
  { layer: "demolido", cat: "mobiliario", nombre: "Armario", x: 6.06, y: 0.3, w: 0.6, d: 1.8, h: 2.3 },
  { layer: "demolido", cat: "cocina", nombre: "Encimera de cocina", x: 0, y: 4.56, w: 0.6, d: 2.94, h: 0.9 },
  { layer: "demolido", cat: "cocina", nombre: "Encimera de cocina", x: 0.6, y: 6.9, w: 2.84, d: 0.6, h: 0.9 },
  { layer: "demolido", cat: "cocina", nombre: "Frigorífico de cocina", x: 2.8, y: 4.56, w: 0.64, d: 0.7, h: 1.8 },
  // Se conserva
  { layer: "conservado", cat: "sanitario", nombre: "Lavabo", x: 3.56, y: 4.6, w: 0.45, d: 0.6, h: 0.85 },
  { layer: "conservado", cat: "sanitario", nombre: "Inodoro", x: 3.56, y: 5.6, w: 0.4, d: 0.65, h: 0.42 },
  { layer: "conservado", cat: "sanitario", nombre: "Plato de ducha", x: 4.6, y: 6.6, w: 0.84, d: 0.9, h: 0.08 },
  { layer: "conservado", cat: "mobiliario", nombre: "Cama", x: 6.9, y: 5.4, w: 1.6, d: 2.0, h: 0.5 },
  { layer: "conservado", cat: "mobiliario", nombre: "Armario", x: 9.4, y: 4.6, w: 0.6, d: 2.9, h: 2.3 },
  // Obra nueva
  { layer: "nuevo", cat: "mobiliario", nombre: "Sofá", x: 2.2, y: 0.6, w: 0.95, d: 2.4, h: 0.72 },
  { layer: "nuevo", cat: "mobiliario", nombre: "Mesa baja", x: 3.5, y: 1.3, w: 0.6, d: 1.0, h: 0.38 },
  { layer: "nuevo", cat: "mobiliario", nombre: "Mueble TV", x: 4.8, y: 0.8, w: 0.5, d: 1.7, h: 0.45 },
  { layer: "nuevo", cat: "mobiliario", nombre: "Mesa de comedor", x: 0.6, y: 3.5, w: 1.8, d: 0.9, h: 0.75 },
  { layer: "nuevo", cat: "cocina", nombre: "Isla de cocina", x: 1.3, y: 5.3, w: 2.0, d: 0.9, h: 0.9 },
  { layer: "nuevo", cat: "cocina", nombre: "Encimera de cocina", x: 0, y: 6.9, w: 3.44, d: 0.6, h: 0.9 },
  { layer: "nuevo", cat: "cocina", nombre: "Columna de cocina", x: 0, y: 5.9, w: 0.65, d: 1.0, h: 2.2 },
  { layer: "nuevo", cat: "mobiliario", nombre: "Cama", x: 8.0, y: 1.0, w: 2.0, d: 1.6, h: 0.5 },
  { layer: "nuevo", cat: "mobiliario", nombre: "Armario", x: 5.46, y: 0.3, w: 0.6, d: 2.7, h: 2.4 },
];

// Estancias por fase. El id hace de WEB_ID: si coincide en las dos fases, es la misma estancia.
export const ROOMS: Record<Fase, EstanciaEjemplo[]> = {
  actual: [
    { id: "salon", nombre: "Salón", poly: [[0, 0], [6, 0], [6, 3.3], [0, 3.3]], nota: "En el reformado se une con la cocina y el tramo oeste del pasillo." },
    { id: "dorm2", nombre: "Dormitorio 2", poly: [[6, 0], [10, 0], [10, 3.3], [6, 3.3]], nota: "Se amplía 60 cm hacia el salón: el tabique se demuele y se levanta uno nuevo." },
    { id: "pasillo", nombre: "Pasillo", poly: [[0, 3.3], [10, 3.3], [10, 4.5], [0, 4.5]], nota: "Desaparece. Su mitad oeste pasa al salón; la este queda como distribuidor." },
    { id: "cocina", nombre: "Cocina", poly: [[0, 4.5], [3.5, 4.5], [3.5, 7.5], [0, 7.5]], nota: "Se abre al salón con isla. Se demuele el tabique del pasillo." },
    { id: "bano", nombre: "Baño", poly: [[3.5, 4.5], [5.5, 4.5], [5.5, 7.5], [3.5, 7.5]], nota: "Se mantiene la distribución; se renuevan los acabados." },
    { id: "dorm1", nombre: "Dormitorio 1", poly: [[5.5, 4.5], [10, 4.5], [10, 7.5], [5.5, 7.5]], nota: "Se mantiene." },
  ],
  reformado: [
    { id: "salon", nombre: "Salón-cocina", poly: [[0, 0], [5.4, 0], [5.4, 3.3], [6, 3.3], [6, 4.5], [3.5, 4.5], [3.5, 7.5], [0, 7.5]], lab: [2.2, 2.4], nota: "Antes: Salón, Cocina y el tramo oeste del Pasillo. Cocina abierta con isla." },
    { id: "dorm2", nombre: "Dormitorio 2", poly: [[5.4, 0], [10, 0], [10, 3.3], [5.4, 3.3]], nota: "Antes: Dormitorio 2, ampliado 60 cm. Armario nuevo en el tabique nuevo." },
    { id: "distribuidor", nombre: "Distribuidor", poly: [[6, 3.3], [10, 3.3], [10, 4.5], [6, 4.5]], nota: "Antes: tramo este del Pasillo. Da acceso a baño y dormitorios." },
    { id: "bano", nombre: "Baño", poly: [[3.5, 4.5], [5.5, 4.5], [5.5, 7.5], [3.5, 7.5]], nota: "Se mantiene la distribución; se renuevan los acabados." },
    { id: "dorm1", nombre: "Dormitorio 1", poly: [[5.5, 4.5], [10, 4.5], [10, 7.5], [5.5, 7.5]], nota: "Se mantiene." },
  ],
};

// Imágenes por estancia y estado, atadas a una cámara (ojo y punto de mira en planta).
// El nombre de la cámara es el que asigna la imagen al subirla: WEB_<estancia>_<nn>.jpg
export const MEDIA: ImagenEjemplo[] = [
  { estado: "actual", room: "salon", n: 1, eye: [5.6, 0.5], at: [1.0, 2.4] },
  { estado: "actual", room: "cocina", n: 1, eye: [3.1, 4.8], at: [0.4, 7.0] },
  { estado: "actual", room: "pasillo", n: 1, eye: [9.6, 3.9], at: [0.5, 3.9] },
  { estado: "actual", room: "dorm2", n: 1, eye: [6.4, 3.0], at: [9.5, 0.8] },
  { estado: "actual", room: "bano", n: 1, eye: [4.5, 4.7], at: [4.5, 7.3] },
  { estado: "actual", room: "dorm1", n: 1, eye: [5.8, 4.7], at: [9.0, 7.0] },
  { estado: "reformado", room: "salon", n: 1, eye: [5.7, 4.1], at: [1.2, 6.2], titulo: "Cocina abierta desde la entrada" },
  { estado: "reformado", room: "salon", n: 2, eye: [0.8, 6.6], at: [4.6, 1.4], titulo: "Salón desde la cocina" },
  { estado: "reformado", room: "dorm2", n: 1, eye: [5.7, 3.0], at: [9.4, 1.0] },
  { estado: "reformado", room: "bano", n: 1, eye: [4.5, 4.7], at: [4.5, 7.3] },
  { estado: "reformado", room: "dorm1", n: 1, eye: [5.8, 4.7], at: [9.0, 7.0] },
];

/** Forjado bajo toda la vivienda (x0, x1, y0, y1 en planta; cota de -0,25 a 0) */
export const FORJADO = { x0: -0.3, x1: 10.3, y0: -0.3, y1: 7.8, z0: -0.25, z1: 0 };

// Caja por rangos de planta (x0..x1, y0..y1) y altura (z0..z1). Planta y → mundo -z.
export function boxGeo(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0);
  g.translate((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2);
  return g;
}

export function wallBoxes(w: Muro): THREE.BufferGeometry[] {
  const { axis, p, a, b, t, op = [] } = w;
  const out: THREE.BufferGeometry[] = [];
  const half = t / 2;
  const seg = (s: number, e: number, z0: number, z1: number) => {
    if (e - s <= 1e-4 || z1 - z0 <= 1e-4) return;
    out.push(axis === "x" ? boxGeo(s, e, p - half, p + half, z0, z1) : boxGeo(p - half, p + half, s, e, z0, z1));
  };
  let cur = a;
  for (const o of [...op].sort((u, v) => u.at - v.at)) {
    const s = o.at - o.w / 2, e = o.at + o.w / 2, bo = o.b ?? 0, to = o.t ?? 2.1;
    seg(cur, s, 0, H);
    if (bo > 0) seg(s, e, 0, bo);
    if (to < H) seg(s, e, to, H);
    cur = e;
  }
  seg(cur, b, 0, H);
  return out;
}

/* ===================== Fixtures GLB (como las convierte ifc_a_glb.py) =====================
   Cada capa imita la salida de `visor-3d/revit/ifc_a_glb.py` desde un IFC 2x3 de Revit:
   un nodo por elemento bajo «world», llamado «<ClaseIFC>/<Familia>:<Tipo>:<id Revit>#<id IFC>»,
   solo posiciones (sin normales ni UV) y un material neutro que el visor descarta.
   Además, cada elemento lleva la geometría centrada y la posición en el nodo, para que el
   cargador tenga que aplicar matrixWorld (así lo exportan otros, como Leia). */

const CLASE_IFC: Record<Cat, string> = {
  muro: "IfcWallStandardCase",
  mobiliario: "IfcFurnishingElement",
  cocina: "IfcFurnishingElement",
  sanitario: "IfcFlowTerminal",
};
const ID_REVIT: Record<Capa, number> = { conservado: 310000, demolido: 320000, nuevo: 330000 };

const cm = (m: number) => Math.round(m * 100);

function escenaDeCapa(capa: Capa): THREE.Scene {
  const escena = new THREE.Scene();
  const raiz = new THREE.Group();
  raiz.name = "world";
  escena.add(raiz);
  const material = new THREE.MeshBasicMaterial({ color: "#cccccc" });

  let idRevit = ID_REVIT[capa];
  let idIfc = 17;
  const elemento = (clase: string, familia: string, tipo: string, piezas: THREE.BufferGeometry[]) => {
    const geo = piezas.length === 1 ? piezas[0] : mergeGeometries(piezas, false);
    if (piezas.length > 1) piezas.forEach((p) => p.dispose());
    geo.deleteAttribute("normal");
    geo.deleteAttribute("uv");
    geo.clearGroups();
    geo.computeBoundingBox();
    const centro = new THREE.Vector3();
    geo.boundingBox?.getCenter(centro);
    geo.translate(-centro.x, -centro.y, -centro.z);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `${clase}/${familia}:${tipo}:${++idRevit}#${(idIfc += 13)}`;
    mesh.position.copy(centro);
    raiz.add(mesh);
  };

  for (const w of WALLS) {
    if (w.layer !== capa) continue;
    elemento(CLASE_IFC.muro, "Muro básico", w.t >= 0.2 ? `Fachada ${cm(w.t)}` : `Tabique ${cm(w.t)}`, wallBoxes(w));
  }
  if (capa === "conservado") {
    const f = FORJADO;
    elemento("IfcSlab", "Suelo", `Forjado ${cm(f.z1 - f.z0)}`, [boxGeo(f.x0, f.x1, f.y0, f.y1, f.z0, f.z1)]);
  }
  for (const m of FURN) {
    if (m.layer !== capa) continue;
    elemento(CLASE_IFC[m.cat], m.nombre, `${cm(m.w)}x${cm(m.d)}x${cm(m.h)}`, [boxGeo(m.x, m.x + m.w, m.y, m.y + m.d, 0, m.h)]);
  }
  escena.updateMatrixWorld(true);
  return escena;
}

function liberar(escena: THREE.Scene) {
  escena.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}

/** Exporta las tres capas del piso de ejemplo como GLB binarios. */
export async function exportarFixtures(): Promise<Record<Capa, ArrayBuffer>> {
  const exporter = new GLTFExporter();
  const out = {} as Record<Capa, ArrayBuffer>;
  for (const capa of CAPAS) {
    const escena = escenaDeCapa(capa);
    try {
      const glb = await exporter.parseAsync(escena, { binary: true });
      if (!(glb instanceof ArrayBuffer)) throw new Error(`La exportación de ${capa} no devolvió un GLB binario`);
      out[capa] = glb;
    } finally {
      liberar(escena);
    }
  }
  return out;
}
