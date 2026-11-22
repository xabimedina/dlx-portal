/**
 * Encuadre y vuelos de cámara, portados de la demo: la cámara se centra en el
 * área que no tapan los paneles superpuestos (view offset), y las vistas de
 * estancia y general calculan la distancia para que quepan en ese hueco.
 *
 * La vista general es axonométrica de hecho: perspectiva con un campo de
 * visión muy estrecho desde lejos (sin la deformación de la perspectiva,
 * aspecto de lámina). Al entrar en una estancia o en una foto el campo se
 * abre a 42° y el vuelo pasa de una a otra sin cortes.
 */
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Campo de visión vertical de la vista general (casi paralela) y de las vistas interiores */
export const FOV_AXO = 9;
export const FOV_PERSP = 42;

export interface Vista {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** Campo de visión al llegar; si falta, se mantiene el actual */
  fov?: number;
}

/** Píxeles del lienzo que tapan paneles superpuestos (panel de estancias y carril de corte en escritorio) */
export interface Margenes {
  izquierda: number;
  arriba: number;
  abajo: number;
  derecha?: number;
}

/** Cuánto más lejos va la cámara con un campo `fov` que con el de perspectiva para ver lo mismo */
export const factorFov = (fov: number) =>
  Math.tan(THREE.MathUtils.degToRad(FOV_PERSP / 2)) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

export class Encuadre {
  private W = 1;
  private H = 1;
  private m: Margenes = { izquierda: 0, arriba: 0, abajo: 0 };

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Nuevo tamaño de lienzo o de paneles */
  aplicar(W: number, H: number, m: Margenes) {
    this.W = W;
    this.H = H;
    this.m = m;
    this.proyectar();
  }

  /**
   * Recalcula la proyección con el campo de visión actual: el centro óptico
   * se lleva al centro del hueco libre ampliando el encuadre completo por el
   * lado del panel más ancho (como la demo, que solo tenía panel a la
   * izquierda y barra arriba).
   */
  proyectar() {
    const { W, H, m } = this;
    const dx = m.izquierda - (m.derecha ?? 0), dy = m.arriba - m.abajo;
    const fullW = W + Math.abs(dx), fullH = H + Math.abs(dy);
    this.camera.aspect = fullW / fullH;
    this.camera.setViewOffset(fullW, fullH, dx < 0 ? -dx : 0, dy < 0 ? -dy : 0, W, H);
    this.camera.updateProjectionMatrix();
  }

  /** Distancia para que una esfera de radio R quepa en el área libre con ese campo de visión */
  fitDist(R: number, fov = this.camera.fov) {
    const { W, H, m } = this;
    const fullH = H + Math.abs(m.arriba - m.abajo);
    const t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const tv = (t * Math.max(1, H - m.arriba - m.abajo)) / fullH;
    const th = (t * Math.max(1, W - m.izquierda - (m.derecha ?? 0))) / fullH;
    return (R / Math.min(tv, th)) * 1.04;
  }
}

/** Vista de una estancia, ya en perspectiva: 43° de elevación manteniendo el acimut actual */
export function vistaEstancia(e: { cx: number; cy: number; w: number; d: number }, encuadre: Encuadre, controls: OrbitControls): Vista {
  const R = (Math.hypot(e.w, e.d) / 2) * 1.25 + 0.6;
  const dist = THREE.MathUtils.clamp(encuadre.fitDist(R, FOV_PERSP), 4.5, 30);
  const target = new THREE.Vector3(e.cx, 0.45, -e.cy);
  const pos = new THREE.Vector3().setFromSphericalCoords(dist, THREE.MathUtils.degToRad(43), controls.getAzimuthalAngle()).add(target);
  return { pos, target, fov: FOV_PERSP };
}

/** Vista general axonométrica: centro de la vivienda, 54° de elevación, acimut de 38° */
export function vistaGeneral(centro: { x: number; y: number }, radio: number, encuadre: Encuadre): Vista {
  const dist = Math.max(8 * factorFov(FOV_AXO), encuadre.fitDist(radio, FOV_AXO));
  const target = new THREE.Vector3(centro.x, 0.45, -centro.y);
  const pos = new THREE.Vector3().setFromSphericalCoords(dist, THREE.MathUtils.degToRad(54), THREE.MathUtils.degToRad(38)).add(target);
  return { pos, target, fov: FOV_AXO };
}

interface Vuelo {
  t0: number;
  dur: number;
  from: Vista & { cut: number; fov: number };
  to: Vista & { cut: number; fov: number };
  animCut: boolean;
  onDone?: () => void;
}

/**
 * Vuelos con ease-in-out; el corte y el campo de visión pueden animarse a la
 * vez. Al cambiar el campo, la distancia a la mirada se interpola en la misma
 * proporción, así lo que se mira no salta de tamaño a mitad de vuelo.
 */
export class Vuelos {
  private vuelo: Vuelo | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly setCorte: (m: number) => void,
    private readonly corte: () => number,
    private readonly setFov: (fov: number) => void,
    private readonly reduceMotion: boolean,
  ) {}

  get activo() {
    return this.vuelo !== null;
  }

  volar(vista: Vista, opts: { dur?: number; cut?: number; onDone?: () => void } = {}) {
    const dur = this.reduceMotion ? 0 : (opts.dur ?? 1000);
    const to = { pos: vista.pos.clone(), target: vista.target.clone(), cut: opts.cut ?? this.corte(), fov: vista.fov ?? this.camera.fov };
    if (dur === 0) {
      this.vuelo = null;
      this.setFov(to.fov);
      this.camera.position.copy(to.pos);
      this.controls.target.copy(to.target);
      if (opts.cut != null) this.setCorte(to.cut);
      this.controls.enabled = true;
      this.controls.update();
      opts.onDone?.();
      return;
    }
    this.vuelo = {
      t0: performance.now(),
      dur,
      from: { pos: this.camera.position.clone(), target: this.controls.target.clone(), cut: this.corte(), fov: this.camera.fov },
      to,
      animCut: opts.cut != null,
      onDone: opts.onDone,
    };
    this.controls.enabled = false;
  }

  /** Avanza el vuelo en curso; se llama en cada fotograma */
  tick(now: number) {
    const f = this.vuelo;
    if (!f) return;
    const k = Math.min(1, (now - f.t0) / f.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const target = new THREE.Vector3().lerpVectors(f.from.target, f.to.target, e);
    if (f.from.fov !== f.to.fov) {
      // El campo se interpola en «tamaño aparente» (1/tan) y la cámara se coloca a la distancia que le corresponde
      const factor = THREE.MathUtils.lerp(factorFov(f.from.fov), factorFov(f.to.fov), e);
      const fovDeg = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV_PERSP / 2)) / factor));
      this.setFov(fovDeg);
      const dFrom = f.from.pos.distanceTo(f.from.target) / factorFov(f.from.fov);
      const dTo = f.to.pos.distanceTo(f.to.target) / factorFov(f.to.fov);
      const dir = new THREE.Vector3().lerpVectors(
        f.from.pos.clone().sub(f.from.target).normalize(),
        f.to.pos.clone().sub(f.to.target).normalize(),
        e,
      ).normalize();
      this.camera.position.copy(target).addScaledVector(dir, THREE.MathUtils.lerp(dFrom, dTo, e) * factorFov(fovDeg));
    } else {
      this.camera.position.lerpVectors(f.from.pos, f.to.pos, e);
    }
    this.controls.target.copy(target);
    if (f.animCut) this.setCorte(THREE.MathUtils.lerp(f.from.cut, f.to.cut, e));
    if (k >= 1) {
      this.vuelo = null;
      this.camera.position.copy(f.to.pos);
      this.controls.target.copy(f.to.target);
      this.setFov(f.to.fov);
      this.controls.enabled = true;
      f.onDone?.();
    }
  }
}
