/**
 * Visor 3D de la maqueta (actual / derribos / reformado), sin React: se monta
 * en un contenedor y expone la API del §7.5 del handoff. La interfaz (segmento,
 * panel de estancias, carril de corte, imagen a pantalla, avisos) la pinta el
 * componente que lo envuelve, escuchando los eventos.
 *
 * Portado de la demo aprobada (`visor-3d/demo/index.html`): mismas funciones,
 * mismas constantes. Diferencias: las capas llegan en GLB, todo se lleva a la
 * cota del suelo de las estancias (0 = suelo, como en la demo) y las medidas
 * de la vivienda salen de los contornos del JSON. Desde el 2026-10-28 el
 * aspecto es el de una lámina axonométrica clara (ver materiales.ts y
 * camara.ts) y el cambio de estado se anima: lo que se derriba sube y se
 * desvanece, lo nuevo baja a su sitio.
 *
 * Solo navegador: importarlo únicamente desde un componente cliente con
 * `next/dynamic(..., { ssr: false })`.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { CSS2DRenderer, type CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { CamaraModelo, FaseModelo, ModeloWeb } from "@/lib/model3d/validar-modelo-web";
import { pip, sectionSegments } from "./geometria";
import { reasignarEstancia } from "./seleccion";
import { CAPAS, C, LOOK, MODE_STYLE, crearMateriales, faseDe, type Capa, type Mirada, type Modo } from "./materiales";
import { cargarCapa, montarCapa, type CapaVisor, type GeometriaPorRol } from "./capas";
import { Encuadre, FOV_AXO, FOV_PERSP, Vuelos, factorFov, vistaEstancia, vistaGeneral, type Margenes, type Vista } from "./camara";
import { crearObjetosEstancia, crearPin, estanciaVisor, type EstanciaVisor, type ObjetosEstancia } from "./etiquetas";

export type { Capa, Modo } from "./materiales";
export type { EstanciaVisor } from "./etiquetas";
export type { Margenes } from "./camara";

export interface ImagenVisor {
  id: string;
  estado: FaseModelo;
  /** Id de estancia (WEB_ID) */
  estancia: string;
  /** Id de la cámara de Revit, o null si la imagen no tiene punto de vista */
  camara: string | null;
  tipo: "foto" | "render";
  /** Número que se enseña («Foto 01») */
  n: number;
  titulo: string | null;
  /** URL de la imagen grande y de la miniatura; null = marcador de prueba */
  url: string | null;
  thumbUrl: string | null;
}

export interface OpcionesVisor {
  /** URLs de las capas (firmadas en producción); al principio de la obra solo hay conservado */
  modelos: Partial<Record<Capa, string>>;
  /** modelo_web.json ya validado */
  datos: ModeloWeb;
  imagenes: ImagenVisor[];
  /** Carpeta de los decodificadores Draco */
  draco?: string;
  /** Sombras más baratas en móvil */
  movil?: boolean;
  /** Lo que tapan los paneles superpuestos, para centrar la cámara en el hueco libre */
  margenes?: () => Margenes;
}

export interface EventosVisor {
  listo: undefined;
  progreso: number;
  estado: Modo;
  estancia: EstanciaVisor | null;
  /** La imagen abierta (cuando la cámara ya ha llegado) o null al cerrarla */
  imagen: ImagenVisor | null;
  aviso: string;
  corte: number;
  error: Error;
}

export interface Visor3D {
  readonly estancias: Record<FaseModelo, EstanciaVisor[]>;
  /** Imágenes con un punto de vista que existe en el modelo */
  tieneCamara(idImagen: string): boolean;
  setEstado(modo: Modo): void;
  seleccionar(id: string | null, opts?: { volar?: boolean }): void;
  abrirImagen(id: string): void;
  cerrarImagen(): void;
  setCorte(metros: number): void;
  vistaGeneral(): void;
  /** Volver a medir el lienzo y los paneles (el contenedor ya se observa solo) */
  relayout(): void;
  on<K extends keyof EventosVisor>(evento: K, fn: (valor: EventosVisor[K]) => void): () => void;
  destroy(): void;
}

/** El navegador no puede crear un contexto WebGL */
export class ErrorWebGL extends Error {}

export const CORTE_MIN = 0.6;
export const CORTE_MAX = 3;
export const CORTE_INICIAL = 1.4;
/** Por encima de esto no hay corte (tapas y sección ocultas) */
const SIN_CORTE = 2.95;
/** Metros que sube lo que desaparece y desde los que baja lo que aparece al cambiar de estado */
const ALTO = 1.6;

export function createVisor3D(contenedor: HTMLElement, opciones: OpcionesVisor): Visor3D {
  const { datos, imagenes } = opciones;
  const margenes = opciones.margenes ?? (() => ({ izquierda: 0, arriba: 0, abajo: 0 }));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================== Datos ============================== */
  const todasCotas = (["actual", "reformado"] as const).flatMap((f) => datos.fases[f].estancias.map((e) => e.cota)).filter((c): c is number => c !== undefined);
  const cotaBase = todasCotas.length ? Math.min(...todasCotas) : 0;
  const H = datos.altura_libre ?? 2.7;

  const estancias: Record<FaseModelo, EstanciaVisor[]> = {
    actual: datos.fases.actual.estancias.map((e) => estanciaVisor(e, "actual")),
    reformado: datos.fases.reformado.estancias.map((e) => estanciaVisor(e, "reformado")),
  };
  const todas = [...estancias.actual, ...estancias.reformado];
  const xs = todas.flatMap((e) => e.contorno.map((p) => p[0])), ys = todas.flatMap((e) => e.contorno.map((p) => p[1]));
  const caja = xs.length ? { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) } : { x0: -5, x1: 5, y0: -5, y1: 5 };
  const CENTER = { x: (caja.x0 + caja.x1) / 2, y: (caja.y0 + caja.y1) / 2 };
  const radio = Math.hypot(caja.x1 - caja.x0, caja.y1 - caja.y0) / 2 + 0.35;

  /** Cámara de una imagen (sin distinguir mayúsculas), en su estado */
  const camaraDe = (img: ImagenVisor): CamaraModelo | null => {
    if (!img.camara) return null;
    const id = img.camara.toLowerCase();
    return datos.fases[img.estado].camaras.find((c) => c.id.toLowerCase() === id) ?? null;
  };
  /** Revit (x, y, z) → three (x, z - cota, -y) */
  const aThree = (p: readonly [number, number, number]) => new THREE.Vector3(p[0], p[2] - cotaBase, -p[1]);

  /* ============================== Escena ============================== */
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true, powerPreference: "high-performance" });
  } catch (err) {
    throw new ErrorWebGL(err instanceof Error ? err.message : String(err));
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new THREE.Color(C.papel), 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = opciones.movil ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.outline = "none";
  contenedor.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "m3d-labels";
  Object.assign(labelRenderer.domElement.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none" });
  contenedor.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV_AXO, 1, 0.1, Math.max(300, radio * 30) * factorFov(FOV_AXO));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
  controls.screenSpacePanning = false;

  // Luz de estudio: casi todo es luz de cielo blanca (caras superiores blancas, laterales en gris suave) y un sol que deja sombras ligeras
  scene.add(new THREE.HemisphereLight(0xffffff, 0xebe8e2, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(CENTER.x - 7, 15, -CENTER.y + 9);
  sun.target.position.set(CENTER.x, 0, -CENTER.y);
  sun.castShadow = true;
  const mapa = opciones.movil ? 1024 : 2048;
  sun.shadow.mapSize.set(mapa, mapa);
  const s = Math.max(10, radio * 1.6);
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 50 + radio * 2 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // Sombra de contacto sobre el papel, alrededor de la vivienda (se coloca bajo el suelo al cargar)
  const sombraSuelo = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(80, radio * 6), Math.max(80, radio * 6)),
    new THREE.ShadowMaterial({ color: C.jet, opacity: 0.1 }),
  );
  sombraSuelo.rotation.x = -Math.PI / 2;
  sombraSuelo.position.set(CENTER.x, -0.01, -CENTER.y);
  sombraSuelo.receiveShadow = true;
  scene.add(sombraSuelo);

  // Cada capa recorta con su propio plano (ver capas.ts)
  const materiales = crearMateriales();

  /* ============================== Estado y eventos ============================== */
  const state: {
    mode: Modo;
    sel: EstanciaVisor | null;
    cut: number;
    media: ImagenVisor | null;
    returnView: (Vista & { cut: number }) | null;
    destruido: boolean;
    listo: boolean;
  } = { mode: "actual", sel: null, cut: CORTE_INICIAL, media: null, returnView: null, destruido: false, listo: false };

  /**
   * Se dibuja solo cuando algo cambia (cámara, corte, estado, selección,
   * tamaño): quieta, la maqueta no gasta batería en el móvil. Los vuelos y las
   * transiciones dibujan mientras duran.
   */
  let sucio = true;
  const redibujar = () => { sucio = true; };

  const oyentes = new Map<keyof EventosVisor, Set<(v: never) => void>>();
  function emit<K extends keyof EventosVisor>(ev: K, valor: EventosVisor[K]) {
    for (const fn of oyentes.get(ev) ?? []) (fn as (v: EventosVisor[K]) => void)(valor);
  }

  const layers = {} as Partial<Record<Capa, CapaVisor>>;
  const capasMontadas = () => Object.values(layers) as CapaVisor[];

  /* ============================== Estancias e imágenes ============================== */
  const objetos = new Map<EstanciaVisor, ObjetosEstancia>();
  for (const e of todas) {
    const o = crearObjetosEstancia(e, materiales.sel, () => seleccionar(e.id, { volar: true }));
    o.label.visible = false;
    scene.add(o.fill, o.line, o.label);
    objetos.set(e, o);
  }
  const pins = new Map<ImagenVisor, CSS2DObject>();
  for (const img of imagenes) {
    const cam = camaraDe(img);
    if (!cam) continue;
    const ojo = aThree(cam.ojo);
    const titulo = `${img.tipo === "foto" ? "Foto" : "Render"} ${String(img.n).padStart(2, "0")} · ${cam.id}`;
    const pin = crearPin(titulo, ojo.setY(ojo.y - 0.1), () => abrirImagen(img.id));
    scene.add(pin);
    pins.set(img, pin);
  }

  /* ============================== Estilos y corte ============================== */
  /** Pone a una capa los colores y líneas de una mirada (la opacidad la lleva `opacidad`) */
  function pintarMirada(L: CapaVisor, mirada: Mirada) {
    const look = LOOK[mirada];
    L.mirada = mirada;
    for (const p of L.parts) {
      p.mesh.material.color.set(look.fill(p.rol));
      p.edges.material = L.lineas[look.edge(p.rol)];
      p.tapaInterior?.material.color.set(look.cap(p.rol));
    }
    L.sec.material = L.lineas[look.sec];
    L.cap?.material.color.set(look.cap("muro"));
    opacidad(L, L.op);
  }

  const transparencia = (m: THREE.Material, o: number) => {
    const t = o < 0.999;
    if (m.transparent !== t) {
      m.transparent = t;
      m.needsUpdate = true;
    }
    m.opacity = Math.min(1, o);
  };

  /** Opacidad de la capa entera: 1 = la de su mirada; las tapas de corte solo con la capa opaca */
  function opacidad(L: CapaVisor, f: number) {
    L.op = f;
    if (!L.mirada) return;
    const look = LOOK[L.mirada];
    const o = look.opacity * f;
    for (const p of L.parts) {
      transparencia(p.mesh.material, o);
      p.mesh.material.depthWrite = o >= 0.999;
      p.mesh.castShadow = look.shadow && f > 0.5;
      if (p.tapaInterior) transparencia(p.tapaInterior.material, f);
      transparencia(L.lineas[look.edge(p.rol)], f);
    }
    transparencia(L.lineas[look.sec], f);
    tapas(L);
  }

  function tapas(L: CapaVisor) {
    const on = state.cut < SIN_CORTE;
    const capOn = on && L.group.visible && L.op >= 0.999;
    if (L.cap) L.cap.visible = capOn;
    if (L.stencil) L.stencil.visible = capOn;
    // La cara interior solo tiene sentido con la capa opaca: en una translúcida (derribos) se vería a través de todo
    const opaca = capOn && (L.mirada ? LOOK[L.mirada].opacity : 1) >= 0.999;
    for (const p of L.parts) if (p.tapaInterior) p.tapaInterior.visible = opaca;
  }

  /** El plano de la capa corta a la altura del corte medida desde la propia capa, aunque esté subida */
  const ajustarPlano = (L: CapaVisor) => { L.plano.constant = state.cut < SIN_CORTE ? state.cut + L.group.position.y : 1000; };

  /* ---------- Transiciones entre estados ---------- */
  interface Animacion {
    t0: number;
    dur: number;
    y: [number, number];
    op: [number, number];
    curva: (k: number) => number;
    colores: { color: THREE.Color; de: THREE.Color; a: THREE.Color }[];
    fin?: () => void;
  }
  const animaciones = new Map<CapaVisor, Animacion>();
  const entrar = (k: number) => 1 - Math.pow(1 - k, 3);
  const salir = (k: number) => k * k * k;
  const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  function animar(L: CapaVisor, a: Omit<Animacion, "t0" | "colores"> & { retardo?: number; colores?: Animacion["colores"] }) {
    const anim: Animacion = { ...a, t0: performance.now() + (a.retardo ?? 0), colores: a.colores ?? [] };
    animaciones.set(L, anim);
    pasoAnimacion(L, anim, 0);
  }

  function pasoAnimacion(L: CapaVisor, a: Animacion, k: number) {
    const e = a.curva(k);
    L.group.position.y = THREE.MathUtils.lerp(a.y[0], a.y[1], e);
    ajustarPlano(L);
    for (const c of a.colores) c.color.lerpColors(c.de, c.a, e);
    opacidad(L, THREE.MathUtils.lerp(a.op[0], a.op[1], e));
  }

  function tickAnimaciones(now: number) {
    for (const [L, a] of animaciones) {
      if (now < a.t0) continue;
      const k = Math.min(1, (now - a.t0) / a.dur);
      pasoAnimacion(L, a, k);
      if (k >= 1) {
        animaciones.delete(L);
        a.fin?.();
      }
    }
  }

  /**
   * Aplica el estado a cada capa. Con `transicion`, lo que sale sube y se
   * desvanece, lo que entra baja a su sitio y lo que cambia de mirada funde
   * sus colores; sin ella (carga, movimiento reducido) todo es inmediato.
   */
  function applyMode(transicion: boolean) {
    const style = MODE_STYLE[state.mode];
    const mover = transicion && !reduceMotion;
    for (const L of capasMontadas()) {
      const siguiente = style[L.name];
      const estaba = L.visible && L.mirada !== null;
      const enCurso = animaciones.get(L);
      animaciones.delete(L);
      L.visible = !!siguiente;
      if (siguiente && !estaba) {
        // Entra desde arriba (o desde donde iba, si estaba saliendo)
        pintarMirada(L, siguiente);
        L.group.visible = true;
        if (mover) {
          const y0 = enCurso ? L.group.position.y : ALTO, op0 = enCurso ? L.op : 0;
          animar(L, { y: [y0, 0], op: [op0, 1], dur: 750, retardo: enCurso ? 0 : 260, curva: entrar });
        } else {
          L.group.position.y = 0;
          opacidad(L, 1);
        }
      } else if (siguiente && estaba) {
        // Sigue: funde colores y opacidad de una mirada a la otra
        const antes = LOOK[L.mirada ?? siguiente];
        const de = L.parts.map((p) => p.mesh.material.color.clone());
        const opAntes = L.op * antes.opacity;
        pintarMirada(L, siguiente);
        if (mover) {
          const colores = L.parts.map((p, i) => ({ color: p.mesh.material.color, de: de[i], a: p.mesh.material.color.clone() }));
          animar(L, { y: [L.group.position.y, 0], op: [opAntes / LOOK[siguiente].opacity, 1], dur: 520, curva: suave, colores });
        } else {
          L.group.position.y = 0;
          opacidad(L, 1);
        }
      } else if (!siguiente && estaba) {
        // Sale: sube y se desvanece
        if (mover) {
          animar(L, { y: [L.group.position.y, ALTO], op: [L.op, 0], dur: 560, curva: salir, fin: () => { L.group.visible = false; tapas(L); } });
        } else {
          L.group.visible = false;
        }
      } else {
        L.group.visible = false;
      }
      ajustarPlano(L);
      tapas(L);
    }
    setCut(state.cut);
  }

  function rebuildSections() {
    const on = state.cut < SIN_CORTE;
    for (const L of capasMontadas()) {
      if (!on || !L.group.visible || !L.all) { L.sec.visible = false; continue; }
      const segs = sectionSegments(L.all.attributes.position.array, L.all.index?.array ?? null, state.cut + 1e-4, state.cut + 0.004);
      if (segs.length < 6) { L.sec.visible = false; continue; }
      const g = new LineSegmentsGeometry().setPositions(segs);
      L.sec.geometry.dispose();
      L.sec.geometry = g;
      L.sec.computeLineDistances();
      L.sec.visible = true;
    }
  }

  function setCut(v: number) {
    v = THREE.MathUtils.clamp(v, CORTE_MIN, CORTE_MAX);
    state.cut = v;
    for (const L of capasMontadas()) {
      ajustarPlano(L);
      if (L.cap) L.cap.position.y = v;
      tapas(L);
    }
    rebuildSections();
    const ly = Math.min(v, H) + 0.35;
    for (const o of objetos.values()) o.label.position.y = ly;
    redibujar();
    emit("corte", v);
  }

  /* ============================== Cámara ============================== */
  const encuadre = new Encuadre(camera);
  /** Campo de visión: la cámara se aleja tanto como se estrecha, y con ella los límites de zoom y el plano cercano */
  function setFov(fov: number) {
    const f = factorFov(fov);
    camera.fov = fov;
    camera.near = 0.1 * f;
    controls.minDistance = 1.2 * f;
    controls.maxDistance = Math.max(60, radio * 8) * f;
    encuadre.proyectar();
  }
  const vuelos = new Vuelos(camera, controls, setCut, () => state.cut, setFov, reduceMotion);

  function layout() {
    const W = contenedor.clientWidth, Hh = contenedor.clientHeight;
    if (!W || !Hh) return;
    renderer.setSize(W, Hh, false);
    labelRenderer.setSize(W, Hh);
    materiales.resolucion(W, Hh);
    encuadre.aplicar(W, Hh, margenes());
    redibujar();
  }
  // En axonométrica la esfera envolvente se queda holgada: con un 85 % la vivienda llena el hueco sin tocar los bordes.
  // En un lienzo estrecho (móvil) la planta se ve en diagonal y necesita la esfera entera.
  const overview = () => vistaGeneral(CENTER, radio * (contenedor.clientWidth < 640 ? 1.05 : 0.85), encuadre);

  /* ============================== Selección ============================== */
  const estanciasAhora = () => estancias[faseDe(state.mode)];

  function updatePins() {
    const fase = faseDe(state.mode);
    for (const [img, pin] of pins) pin.visible = !!state.sel && img.estado === fase && img.estancia === state.sel.id && !state.media;
    redibujar();
  }

  function selectRoom(r: EstanciaVisor | null, fly: boolean) {
    state.sel = r;
    for (const [q, o] of objetos) {
      const on = q === r;
      o.fill.visible = on;
      o.line.visible = on;
      o.el.classList.toggle("on", on);
    }
    updatePins();
    emit("estancia", r);
    if (fly && r) vuelos.volar(vistaEstancia(r, encuadre, controls));
  }

  function seleccionar(id: string | null, opts: { volar?: boolean } = {}) {
    if (state.destruido) return;
    const r = id === null ? null : (estanciasAhora().find((e) => e.id === id) ?? null);
    selectRoom(r, opts.volar ?? true);
  }

  /* ============================== Estados ============================== */
  function setEstado(mode: Modo) {
    if (state.destruido || mode === state.mode) return;
    const prevPhase = faseDe(state.mode), prev = state.sel;
    state.mode = mode;
    const phase = faseDe(mode);
    if (state.media) cerrarImagen();
    applyMode(true);
    for (const [e, o] of objetos) o.label.visible = state.listo && e.fase === phase;
    let next = prev, aviso: string | null = null;
    if (prev && phase !== prevPhase) {
      ({ estancia: next, aviso } = reasignarEstancia(prev, estancias[phase], phase, { x: controls.target.x, y: -controls.target.z }));
    }
    selectRoom(next, false);
    if (aviso) emit("aviso", aviso);
    emit("estado", mode);
  }

  /* ============================== Imágenes ============================== */
  function abrirImagen(id: string) {
    if (state.destruido || state.media || vuelos.activo) return;
    const img = imagenes.find((i) => i.id === id);
    if (!img) return;
    state.media = img;
    updatePins();
    const cam = camaraDe(img);
    if (!cam) {
      state.returnView = null;
      emit("imagen", img);
      return;
    }
    state.returnView = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov, cut: state.cut };
    vuelos.volar(
      { pos: aThree(cam.ojo), target: aThree(cam.mira), fov: FOV_PERSP },
      { dur: 1100, cut: CORTE_MAX, onDone: () => { if (state.media === img) emit("imagen", img); } },
    );
  }

  function cerrarImagen() {
    if (!state.media) return;
    state.media = null;
    updatePins();
    emit("imagen", null);
    const rv = state.returnView;
    state.returnView = null;
    if (rv) vuelos.volar({ pos: rv.pos, target: rv.target, fov: rv.fov }, { dur: 900, cut: rv.cut });
  }

  /* ============================== Toque sobre la maqueta ============================== */
  const raycaster = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let pd: { x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => { pd = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    if (!pd) return;
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y, quick = performance.now() - pd.t < 450;
    pd = null;
    if (dx * dx + dy * dy > 36 || !quick || vuelos.activo || state.media || !state.listo) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const r = estanciasAhora().find((q) => pip(q.contorno, hit.x, -hit.z));
    if (r) selectRoom(r, true);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  /* ============================== Bucle y carga ============================== */
  function tick(now: number) {
    // Lo que se mueve en este fotograma, antes de avanzarlo (el último paso de un vuelo o de una transición también se dibuja)
    const enMarcha = vuelos.activo || animaciones.size > 0;
    vuelos.tick(now);
    tickAnimaciones(now);
    const movida = controls.update(); // true mientras el usuario mueve la cámara o dura la inercia
    if (!sucio && !enMarcha && !movida) return;
    sucio = false;
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  layout();
  const ro = new ResizeObserver(() => layout());
  ro.observe(contenedor);
  vuelos.volar(overview(), { dur: 0 });

  const draco = new DRACOLoader();
  draco.setDecoderPath(opciones.draco ?? "/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const progreso: Record<Capa, [number, number]> = { conservado: [0, 0], demolido: [0, 0], nuevo: [0, 0] };
  const avisarProgreso = () => {
    const [c, t] = Object.values(progreso).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
    if (t > 0) emit("progreso", Math.min(1, c / t));
  };

  Promise.all(
    CAPAS.map((capa) => {
      // Al principio de la obra solo hay conservado: las capas que no llegan quedan vacías
      const url = opciones.modelos[capa];
      if (!url) return Promise.resolve<GeometriaPorRol>({});
      return cargarCapa(loader, url, cotaBase, (cargado, total) => {
        progreso[capa] = [cargado, total];
        avisarProgreso();
      });
    }),
  )
    .then((cargadas) => {
      if (state.destruido) {
        for (const g of cargadas) for (const geo of Object.values(g)) geo?.dispose();
        return;
      }
      const lado = Math.max(80, radio * 6);
      const centroTapa = new THREE.Vector2(CENTER.x, -CENTER.y);
      let suelo = Infinity;
      CAPAS.forEach((capa, i) => {
        const L = montarCapa(capa, cargadas[i], 1 + i, materiales, state.cut, centroTapa, lado);
        scene.add(L.group);
        layers[capa] = L;
        for (const p of L.parts) {
          p.mesh.geometry.computeBoundingBox();
          suelo = Math.min(suelo, p.mesh.geometry.boundingBox?.min.y ?? 0);
        }
      });
      if (Number.isFinite(suelo)) sombraSuelo.position.y = suelo - 0.005;
      state.listo = true;
      applyMode(false);
      for (const [e, o] of objetos) o.label.visible = e.fase === faseDe(state.mode);
      layout();
      vuelos.volar(overview(), { dur: 0 });
      renderer.setAnimationLoop(tick);
      emit("listo", undefined);
    })
    .catch((err: unknown) => {
      if (state.destruido) return;
      emit("error", err instanceof Error ? err : new Error(String(err)));
    });

  /* ============================== API ============================== */
  return {
    estancias,
    tieneCamara: (id) => {
      const img = imagenes.find((i) => i.id === id);
      return !!img && camaraDe(img) !== null;
    },
    setEstado,
    seleccionar,
    abrirImagen,
    cerrarImagen,
    setCorte: (m) => { if (!state.destruido) setCut(m); },
    vistaGeneral: () => {
      if (state.destruido) return;
      if (state.media) cerrarImagen();
      else vuelos.volar(overview());
    },
    relayout: () => { if (!state.destruido) layout(); },
    on(evento, fn) {
      let set = oyentes.get(evento);
      if (!set) oyentes.set(evento, (set = new Set()));
      set.add(fn as (v: never) => void);
      return () => { set.delete(fn as (v: never) => void); };
    },
    destroy() {
      if (state.destruido) return;
      state.destruido = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      oyentes.clear();
      const geometrias = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof LineSegments2 || o instanceof Line2) {
          geometrias.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
        }
      });
      for (const L of capasMontadas()) if (L.all) geometrias.add(L.all);
      for (const g of geometrias) g.dispose();
      for (const m of mats) m.dispose();
      materiales.dispose();
      draco.dispose();
      sun.shadow.map?.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
}
