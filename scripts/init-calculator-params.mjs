#!/usr/bin/env node
/**
 * Inicializa (o reescribe) el documento `config/calculator` que consume la
 * calculadora pública y que edita el módulo «Parámetros» de dlx-admin.
 *
 * Escribe SIEMPRE el objeto completo + `updated_at` (Timestamp): la calculadora
 * sustituye por defaults cualquier mapa ausente y respeta los mapas vacíos, así
 * que una escritura parcial cambiaría silenciosamente los precios.
 *
 * Los valores salen de DEFAULT_CALCULATOR_PARAMS de la calculadora
 * (dlx-calculator-main/src/pages/form/calculation/utils/constants.ts), que la
 * auditoría comprueba que coincide con la copia del admin.
 *
 * Uso (desde dlx-portal-main):
 *
 *   node --env-file=.env.local scripts/init-calculator-params.mjs          # solo si no existe
 *   node --env-file=.env.local scripts/init-calculator-params.mjs --force  # sobreescribe
 *
 * Equivalente en la UI: /parametros → «Inicializar con los valores actuales».
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const here = path.dirname(fileURLToPath(import.meta.url));
const CALC_CONSTANTS = path.resolve(here, "../../dlx-calculator-main/src/pages/form/calculation/utils/constants.ts");
const FORCE = process.argv.includes("--force");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.error("Falta FIREBASE_SERVICE_ACCOUNT_KEY. Ejecuta con --env-file=.env.local desde dlx-portal-main.");
  process.exit(1);
}
const credentials = JSON.parse(raw);
if (typeof credentials.private_key === "string") credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
initializeApp({ credential: cert(credentials) });
const db = getFirestore();

// Node ≥ 22.18 ejecuta .ts directamente (borrado de tipos); constants.ts solo
// importa tipos, así que carga sin problemas.
const { DEFAULT_CALCULATOR_PARAMS } = await import(pathToFileURL(CALC_CONSTANTS).href);

const ref = db.collection("config").doc("calculator");
const snap = await ref.get();
if (snap.exists && !FORCE) {
  console.log("config/calculator ya existe; no se toca (usa --force para sobreescribir con los defaults).");
  console.log(`  updated_at: ${snap.data().updated_at?.toDate?.().toISOString() ?? "∅"}`);
} else {
  await ref.set({ ...structuredClone(DEFAULT_CALCULATOR_PARAMS), updated_at: Timestamp.now() });
  console.log(`config/calculator ${snap.exists ? "sobreescrito" : "creado"} con los defaults de la calculadora (${Object.keys(DEFAULT_CALCULATOR_PARAMS.zoneMultipliers).length} CPs).`);
}
await db.terminate();
