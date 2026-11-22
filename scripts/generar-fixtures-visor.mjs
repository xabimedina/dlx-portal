#!/usr/bin/env node
/**
 * Genera las fixtures del visor 3D (módulo «Maqueta 3D») a partir del piso de
 * ejemplo de la demo: `conservado.glb`, `demolido.glb`, `nuevo.glb` y
 * `modelo_web.json`. Son el modelo del seed y de los tests del banco E2E (los
 * modelos reales de las obras no van a git).
 *
 * Escribe en dlx-e2e/fixtures/model3d/ (solo ficheros locales, nada contra
 * Firebase). Uso (desde dlx-portal-main):
 *
 *   node scripts/generar-fixtures-visor.mjs
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PISO_EJEMPLO = path.resolve(here, "piso-ejemplo.ts");
const MODELO_WEB = path.resolve(here, "../../visor-3d/datos/modelo_web.ejemplo.json");
const DESTINOS = [path.resolve(here, "../../dlx-e2e/fixtures/model3d")];

// GLTFExporter monta el GLB con FileReader, que en Node no existe: basta leer el Blob.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

// Node ≥ 22.18 ejecuta .ts directamente (borrado de tipos); piso-ejemplo.ts solo importa three.
const { exportarFixtures } = await import(pathToFileURL(PISO_EJEMPLO).href);
const capas = await exportarFixtures();

for (const destino of DESTINOS) {
  await mkdir(destino, { recursive: true });
  for (const [capa, glb] of Object.entries(capas)) {
    await writeFile(path.join(destino, `${capa}.glb`), new Uint8Array(glb));
  }
  await copyFile(MODELO_WEB, path.join(destino, "modelo_web.json"));
  console.log(`Fixtures escritas en ${path.relative(path.resolve(here, "../.."), destino)}`);
}
for (const [capa, glb] of Object.entries(capas)) console.log(`  ${capa}.glb  ${(glb.byteLength / 1024).toFixed(1)} KB`);
