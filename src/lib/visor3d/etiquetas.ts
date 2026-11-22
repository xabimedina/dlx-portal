/**
 * Estancias en la escena: relleno y contorno de selección sobre el suelo y la
 * etiqueta (píldora oscura) que se puede tocar. Portado de la demo; los estilos
 * de `.m3d-lbl` y `.m3d-pin` están en el CSS del componente del visor.
 */
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import type { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { EstanciaModelo, FaseModelo } from "@/lib/model3d/validar-modelo-web";
import { polyStats } from "./geometria";
import { C } from "./materiales";

export interface EstanciaVisor extends EstanciaModelo {
  fase: FaseModelo;
  /** m² a mostrar: los de Revit si vienen, si no los del contorno */
  area: number;
  cx: number;
  cy: number;
  w: number;
  d: number;
}

export interface ObjetosEstancia {
  fill: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  line: Line2;
  label: CSS2DObject;
  el: HTMLButtonElement;
}

export function estanciaVisor(e: EstanciaModelo, fase: FaseModelo): EstanciaVisor {
  const s = polyStats(e.contorno);
  return { ...e, fase, area: e.area_m2 ?? s.area, cx: s.cx, cy: s.cy, w: s.w, d: s.d };
}

export function crearObjetosEstancia(e: EstanciaVisor, lineaSel: LineMaterial, alTocar: () => void): ObjetosEstancia {
  const shape = new THREE.Shape(e.contorno.map(([x, y]) => new THREE.Vector2(x, y)));
  const fill = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: C.saffron, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.012;
  fill.visible = false;
  fill.renderOrder = 20;

  const pts: number[] = [];
  for (const [x, y] of [...e.contorno, e.contorno[0]]) pts.push(x, 0.016, -y);
  const line = new Line2(new LineGeometry().setPositions(pts), lineaSel);
  line.computeLineDistances();
  line.visible = false;
  line.renderOrder = 21;

  const el = document.createElement("button");
  el.type = "button";
  el.className = "m3d-lbl";
  el.textContent = e.nombre;
  el.addEventListener("click", (ev) => {
    ev.stopPropagation();
    alTocar();
  });
  const label = new CSS2DObject(el);
  const [lx, ly] = e.etiqueta ?? [e.cx, e.cy];
  label.position.set(lx, 1.75, -ly);
  return { fill, line, label, el };
}

const CAM_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v10H4z"/><circle cx="12" cy="13" r="3"/></svg>';

/** Pin en el ojo de la cámara desde la que se tomó una imagen */
export function crearPin(titulo: string, posicion: THREE.Vector3, alTocar: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "m3d-pin";
  el.title = titulo;
  el.setAttribute("aria-label", titulo);
  el.innerHTML = CAM_SVG;
  el.addEventListener("click", (ev) => {
    ev.stopPropagation();
    alTocar();
  });
  const pin = new CSS2DObject(el);
  pin.position.copy(posicion);
  pin.visible = false;
  return pin;
}
