/**
 * Carga de las tres capas GLB (conservado / demolido / nuevo) y construcción
 * de lo que el visor pinta de cada una: una malla por rol con sus aristas, el
 * stencil de los muros para las tapas de corte, las tapas del resto y la
 * línea de sección. Sustituye al bloque de cajas de la demo; el resto
 * (stencil, tapa, aristas, sección) se porta tal cual.
 *
 * Todo lo de una capa cuelga de su grupo y se recorta con su propio plano:
 * al cambiar de estado la capa sube o baja entera (con su corte) y se
 * desvanece sin tocar a las demás.
 */
import * as THREE from "three";
import type { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { nombresDeRuta, rolDe, type Rol } from "./roles";
import { LOOK, ROL_FILL, type Capa, type LineaId, type Materiales, type Mirada } from "./materiales";

export const ROLES: Rol[] = ["muro", "acabado", "mobiliario", "cocina", "sanitario"];

/** Geometría ya en coordenadas del visor (suelo a 0), sin índice y con normales planas, agrupada por rol */
export type GeometriaPorRol = Partial<Record<Rol, THREE.BufferGeometry>>;

/**
 * Descarga una capa y la deja lista: aplica la posición de cada nodo, baja
 * todo a la cota del suelo, se queda solo con las posiciones (el visor pone
 * normales planas: aspecto de maqueta) y une las mallas de cada rol.
 */
export async function cargarCapa(
  loader: GLTFLoader,
  url: string,
  cotaBase: number,
  onProgreso?: (cargado: number, total: number) => void,
): Promise<GeometriaPorRol> {
  const gltf = await loader.loadAsync(url, (e) => onProgreso?.(e.loaded, e.total));
  gltf.scene.updateMatrixWorld(true);
  const porRol: Partial<Record<Rol, THREE.BufferGeometry[]>> = {};
  const desechar = new Set<{ dispose: () => void }>();
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const rol = rolDe(nombresDeRuta(o));
    const fuente = o.geometry as THREE.BufferGeometry;
    const g = fuente.index ? fuente.toNonIndexed() : fuente.clone();
    g.applyMatrix4(o.matrixWorld);
    g.translate(0, -cotaBase, 0);
    for (const a of Object.keys(g.attributes)) if (a !== "position") g.deleteAttribute(a);
    g.computeVertexNormals(); // sin índice = normales planas por cara
    (porRol[rol] ??= []).push(g);
    desechar.add(fuente);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) desechar.add(m);
  });
  for (const r of desechar) r.dispose();

  const out: GeometriaPorRol = {};
  for (const rol of ROLES) {
    const lista = porRol[rol];
    if (!lista?.length) continue;
    out[rol] = lista.length === 1 ? lista[0] : mergeGeometries(lista, false);
    if (lista.length > 1) lista.forEach((g) => g.dispose());
  }
  return out;
}

export interface Parte {
  rol: Rol;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  edges: LineSegments2;
  /** Tapa de corte de lo que no es muro: la cara interior en el color de la tapa */
  tapaInterior: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
}

export interface CapaVisor {
  name: Capa;
  group: THREE.Group;
  parts: Parte[];
  visible: boolean;
  /** Plano de corte propio: corta a la altura del corte más lo que la capa esté subida */
  plano: THREE.Plane;
  lineas: Record<LineaId, LineMaterial>;
  /** Mirada aplicada (null = capa fuera de este estado) */
  mirada: Mirada | null;
  /** Opacidad de la capa entera durante las transiciones (1 = como dicta la mirada) */
  op: number;
  /** Toda la capa unida, para la línea de sección */
  all: THREE.BufferGeometry | null;
  /** Stencil y tapa de los muros (sólidos cerrados) */
  stencil: THREE.Group | null;
  cap: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  sec: LineSegments2;
}

function makeStencil(geom: THREE.BufferGeometry, order: number, clip: THREE.Plane[]) {
  const g = new THREE.Group();
  const base = { depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, clippingPlanes: clip };
  const back = new THREE.MeshBasicMaterial({ ...base, side: THREE.BackSide, stencilFail: THREE.IncrementWrapStencilOp, stencilZFail: THREE.IncrementWrapStencilOp, stencilZPass: THREE.IncrementWrapStencilOp });
  const front = new THREE.MeshBasicMaterial({ ...base, side: THREE.FrontSide, stencilFail: THREE.DecrementWrapStencilOp, stencilZFail: THREE.DecrementWrapStencilOp, stencilZPass: THREE.DecrementWrapStencilOp });
  for (const mat of [back, front]) {
    const m = new THREE.Mesh(geom, mat);
    m.renderOrder = order;
    m.frustumCulled = false;
    g.add(m);
  }
  return g;
}

function makeCap(order: number, centro: THREE.Vector2, lado: number) {
  const mat = new THREE.MeshBasicMaterial({ color: LOOK.normal.cap("muro"), side: THREE.DoubleSide, stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(centro.x, 1.4, centro.y);
  m.renderOrder = order;
  m.frustumCulled = false;
  m.onAfterRender = (r) => r.clearStencil();
  return m;
}

export function edgesOf(geom: THREE.BufferGeometry, material: LineMaterial) {
  const eg = new THREE.EdgesGeometry(geom, 30);
  const lg = new LineSegmentsGeometry().setPositions(eg.attributes.position.array as Float32Array);
  eg.dispose();
  const l = new LineSegments2(lg, material);
  l.computeLineDistances();
  l.renderOrder = 11;
  return l;
}

/**
 * Monta en escena una capa ya cargada. `orden` separa las pasadas de stencil
 * de cada capa (la demo usa 1, 2, 3); `centro` y `lado` dimensionan la tapa
 * (centro en coordenadas x, z de three).
 */
export function montarCapa(
  name: Capa,
  geometria: GeometriaPorRol,
  orden: number,
  materiales: Materiales,
  corte: number,
  centro: THREE.Vector2,
  lado: number,
): CapaVisor {
  const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), corte);
  const clip = [plano];
  const lineas = materiales.lineas(clip);
  const group = new THREE.Group();
  const parts: Parte[] = [];
  for (const rol of ROLES) {
    const g = geometria[rol];
    if (!g) continue;
    const mesh = new THREE.Mesh(g, materiales.malla(ROL_FILL[rol], clip));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 10;
    const edges = edgesOf(g, lineas.ink);
    group.add(mesh, edges);
    let tapaInterior: Parte["tapaInterior"] = null;
    if (rol !== "muro") {
      // Mismo desplazamiento de profundidad que la malla: sin él, la cara trasera de una capa de pintura de 1 cm
      // (pegada a la pared) gana a la cara delantera, que sí lo lleva, y la pared se ve del color del poché
      tapaInterior = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: LOOK.normal.cap(rol), side: THREE.BackSide, clippingPlanes: clip, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
      tapaInterior.renderOrder = 10;
      group.add(tapaInterior);
    }
    parts.push({ rol, mesh, edges, tapaInterior });
  }
  // La línea de sección no repasa los acabados: dibujaría cada pared dos veces
  const todas = parts.filter((p) => p.rol !== "acabado").map((p) => p.mesh.geometry);
  const all = todas.length === 0 ? null : todas.length === 1 ? todas[0] : mergeGeometries(todas, false);
  const muros = geometria.muro;
  const stencil = muros ? makeStencil(muros, orden, clip) : null;
  const cap = muros ? makeCap(orden + 0.1, centro, lado) : null;
  const sec = new LineSegments2(new LineSegmentsGeometry(), lineas.secInk);
  sec.visible = false;
  sec.renderOrder = 12;
  sec.frustumCulled = false;
  if (stencil) group.add(stencil);
  if (cap) group.add(cap);
  group.add(sec);
  return { name, group, parts, visible: true, plano, lineas, mirada: null, op: 1, all, stencil, cap, sec };
}
