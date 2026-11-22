#!/usr/bin/env node
/**
 * Reset de los módulos Obras, Presupuestos y Comparador en el proyecto REAL
 * `despejalapp`.
 *
 * Borra, y solo puede borrar, lo que está en la LISTA BLANCA de abajo:
 *   - presupuestos_config, presupuestos_suppliers, presupuestos_catalog,
 *     presupuestos_quotes, presupuestos_revit_mappings, presupuestos_revit (recursivo)
 *   - portal_projects (recursivo: phases, decisions, meetings, documents,
 *     weeklyUpdates, photos, requests), portal_clients
 *   - comparador_products (los productos del Comparador)
 *   - Storage: ficheros bajo portal/projects/ y bajo comparador/products/
 *     (las fotos de los productos del Comparador)
 *
 * NUNCA toca users, results, mail, projects, web, blog, portal_users,
 * config/calculator ni las cuentas de Auth: ninguna referencia a esas rutas
 * existe en este fichero, así que no hay forma de que las alcance.
 *
 * Uso (desde dlx-portal-main):
 *
 *   # 1. Simulación (por defecto): lista lo que borraría y no toca nada.
 *   node --env-file=.env.local scripts/reset-modulos.mjs
 *
 *   # 2. Borrado real: exige los DOS flags.
 *   node --env-file=.env.local scripts/reset-modulos.mjs --apply --confirmo-borrar-despejalapp
 *
 *   # Reset completo conservando la configuración de empresa (presupuestos_config/company):
 *   node --env-file=.env.local scripts/reset-modulos.mjs --conservar-empresa [--apply --confirmo-borrar-despejalapp]
 *
 *   # Solo los datos de prueba del recorrido E2E (prefijo «E2E-» en nombre/título):
 *   node --env-file=.env.local scripts/reset-modulos.mjs --solo-e2e [--apply --confirmo-borrar-despejalapp]
 *
 *   # Comprobar al final que la línea base de una auditoría previa sigue intacta:
 *   node --env-file=.env.local scripts/reset-modulos.mjs --apply --confirmo-borrar-despejalapp \
 *        --linea-base scripts/out/audit-<fecha>.json
 *
 * Antes de borrar guarda un volcado JSON completo de los documentos afectados
 * en scripts/out/backup-reset-<fecha>.json. Después vuelve a contar y falla
 * (exit 2) si queda algo del objetivo o si falta algo de la línea base.
 *
 * Probarlo SIN producción: con los emuladores de dlx-e2e arrancados, las
 * variables FIRESTORE_EMULATOR_HOST y FIREBASE_STORAGE_EMULATOR_HOST (las dos)
 * y la cuenta de servicio falsa del E2E en FIREBASE_SERVICE_ACCOUNT_KEY, en vez
 * de --env-file=.env.local. Ver ON_EMULATORS más abajo.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";

const PROJECT = "despejalapp";
const BUCKET = `${PROJECT}.firebasestorage.app`;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(here, "out");
const BATCH_LIMIT = 400;

/* ── Lista blanca: lo ÚNICO que este script puede borrar ───────────────────── */

const PLAIN_COLLECTIONS = [
  "presupuestos_config",
  "presupuestos_suppliers",
  "presupuestos_catalog",
  "presupuestos_quotes",
  "presupuestos_revit_mappings",
  "portal_clients",
  "comparador_products",
];
const RECURSIVE_COLLECTIONS = ["presupuestos_revit", "portal_projects"];
const PORTAL_PREFIX = "portal/projects/";
const PRODUCTS_PREFIX = "comparador/products/";
const STORAGE_PREFIXES = [PORTAL_PREFIX, PRODUCTS_PREFIX];
/* Colecciones de la línea base (se leen para comprobar que siguen intactas). */
const BASELINE_COLLECTIONS = ["users", "results", "mail", "projects", "web", "blog", "portal_users"];

/* ── Flags ─────────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CONFIRMED = args.includes("--confirmo-borrar-despejalapp");
const SOLO_E2E = args.includes("--solo-e2e");
const CONSERVAR_EMPRESA = args.includes("--conservar-empresa");
const baseAt = args.indexOf("--linea-base");
const BASELINE_FILE = baseAt >= 0 ? args[baseAt + 1] : null;
const E2E_PREFIX = "E2E-";

const known = new Set(["--apply", "--confirmo-borrar-despejalapp", "--solo-e2e", "--conservar-empresa", "--linea-base", BASELINE_FILE]);
const unknown = args.filter((a) => !known.has(a));
if (unknown.length) {
  console.error(`Flags desconocidos: ${unknown.join(" ")}`);
  process.exit(1);
}
if (APPLY && !CONFIRMED) {
  console.error("Para borrar de verdad hacen falta los dos flags: --apply --confirmo-borrar-despejalapp");
  process.exit(1);
}
const DRY_RUN = !APPLY;

/* ── Credenciales ──────────────────────────────────────────────────────────── */

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error("Falta FIREBASE_SERVICE_ACCOUNT_KEY. Ejecuta con --env-file=.env.local desde dlx-portal-main.");
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = JSON.parse(raw.replace(/\\n/g, "\n"));
  }
  if (typeof parsed.private_key === "string") parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

/* ── Emuladores (solo para probar este script) ─────────────────────────────────
 * Con FIRESTORE_EMULATOR_HOST el Admin SDK ya habla con el emulador de
 * Firestore; Storage aquí va por la API JSON y hay que redirigirlo a mano. Se
 * exigen las DOS variables: medio script contra producción y medio contra el
 * emulador sería peor que no poder probarlo. */
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const STORAGE_EMULATOR = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (Boolean(FIRESTORE_EMULATOR) !== Boolean(STORAGE_EMULATOR)) {
  console.error("Para los emuladores hacen falta FIRESTORE_EMULATOR_HOST y FIREBASE_STORAGE_EMULATOR_HOST, las dos.");
  process.exit(1);
}
const ON_EMULATORS = Boolean(FIRESTORE_EMULATOR);
const STORAGE_API = ON_EMULATORS
  ? `http://${STORAGE_EMULATOR}/storage/v1`
  : "https://storage.googleapis.com/storage/v1";

const credentials = serviceAccount();
initializeApp({ credential: cert(credentials) });
const db = getFirestore();
const apiClient = await new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();

/** Petición a la API JSON de Storage: la real con el cliente autenticado, o el emulador. */
async function storageRequest({ url, method = "GET", params = {} }) {
  if (!ON_EMULATORS) return apiClient.request({ url, method, params });
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  const response = await fetch(target, { method, headers: { Authorization: "Bearer owner" } });
  if (!response.ok) throw new Error(`${method} ${target} → ${response.status} ${await response.text()}`);
  const text = await response.text();
  return { data: text ? JSON.parse(text) : {} };
}

/* Storage por la API JSON (ver nota en audit-produccion.mjs: la librería de
 * Storage del Admin SDK no funciona en Node 24). */
async function storageList(prefix) {
  const names = [];
  let pageToken;
  do {
    const params = { prefix, fields: "items(name),nextPageToken", maxResults: 1000 };
    if (pageToken) params.pageToken = pageToken;
    const { data } = await storageRequest({ url: `${STORAGE_API}/b/${BUCKET}/o`, params });
    for (const item of data.items ?? []) names.push(item.name);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return names;
}
async function storageDelete(name) {
  await storageRequest({
    url: `${STORAGE_API}/b/${BUCKET}/o/${encodeURIComponent(name)}`,
    method: "DELETE",
  });
}

/* ── Selección de objetivos ────────────────────────────────────────────────── */

function isE2E(data) {
  const label = data?.name ?? data?.full_name ?? data?.title ?? "";
  return typeof label === "string" && label.startsWith(E2E_PREFIX);
}

async function dumpRecursive(ref) {
  // Devuelve el documento con sus subcolecciones anidadas (para el volcado).
  const snap = await ref.get();
  const out = { id: ref.id, path: ref.path, data: snap.exists ? snap.data() : null, subcollections: {} };
  for (const sub of await ref.listCollections()) {
    const docs = await sub.listDocuments();
    out.subcollections[sub.id] = [];
    for (const d of docs) out.subcollections[sub.id].push(await dumpRecursive(d));
  }
  return out;
}

const targets = { plain: {}, recursive: {}, storage: [] };
let totalDocs = 0;

console.log(`\n${DRY_RUN ? "SIMULACIÓN" : "BORRADO REAL"} · proyecto ${PROJECT}${ON_EMULATORS ? " (EMULADORES LOCALES)" : ""} · modo ${SOLO_E2E ? `solo E2E (prefijo «${E2E_PREFIX}»)` : "completo"}\n`);

for (const col of PLAIN_COLLECTIONS) {
  if (SOLO_E2E && (col === "presupuestos_config" || col === "presupuestos_revit_mappings")) continue;
  const snap = await db.collection(col).get();
  const docs = snap.docs.filter((d) => {
    if (SOLO_E2E && !isE2E(d.data())) return false;
    // La ficha de empresa es del usuario, no dato de prueba: se conserva si se pide.
    if (CONSERVAR_EMPRESA && col === "presupuestos_config" && d.id === "company") return false;
    return true;
  });
  targets.plain[col] = docs.map((d) => ({ id: d.id, data: d.data() }));
  totalDocs += docs.length;
  console.log(`  ${col.padEnd(30)} ${String(docs.length).padStart(5)} docs${SOLO_E2E ? ` (de ${snap.size})` : ""}`);
}

const e2eProjectIds = [];
for (const col of RECURSIVE_COLLECTIONS) {
  if (SOLO_E2E && col === "presupuestos_revit") continue;
  const refs = await db.collection(col).listDocuments();
  targets.recursive[col] = [];
  for (const ref of refs) {
    const dump = await dumpRecursive(ref);
    if (SOLO_E2E && !isE2E(dump.data)) continue;
    targets.recursive[col].push(dump);
    if (col === "portal_projects") e2eProjectIds.push(ref.id);
    const subCount = Object.values(dump.subcollections).reduce((a, arr) => a + arr.length, 0);
    totalDocs += 1 + subCount;
    console.log(`  ${`${col}/${ref.id}`.padEnd(30)} 1 doc + ${subCount} en subcolecciones  ←  ${dump.data?.name ?? dump.data?.title ?? ""}`);
  }
  if (targets.recursive[col].length === 0) console.log(`  ${col.padEnd(30)}     0 docs`);
}

// Con --solo-e2e, solo los ficheros de las obras y de los productos E2E: las
// fotos de producto viven en comparador/products/{idDeProducto}/.
const e2eProductIds = (targets.plain.comparador_products ?? []).map((d) => d.id);
const ownersByPrefix = { [PORTAL_PREFIX]: e2eProjectIds, [PRODUCTS_PREFIX]: e2eProductIds };
for (const prefix of STORAGE_PREFIXES) {
  const all = await storageList(prefix);
  const selected = SOLO_E2E
    ? all.filter((n) => ownersByPrefix[prefix].some((id) => n.startsWith(`${prefix}${id}/`)))
    : all;
  targets.storage.push(...selected);
  console.log(`  ${`Storage ${prefix}**`.padEnd(30)} ${String(selected.length).padStart(5)} ficheros${SOLO_E2E ? ` (de ${all.length})` : ""}`);
}

console.log(`\n  Total: ${totalDocs} documentos y ${targets.storage.length} ficheros.`);

/* ── Línea base antes de tocar nada ────────────────────────────────────────── */

async function baselineSnapshot() {
  const out = {};
  for (const col of BASELINE_COLLECTIONS) {
    const snap = await db.collection(col).select().get();
    out[col] = snap.docs.map((d) => d.id).sort();
  }
  return out;
}
const baselineBefore = BASELINE_FILE
  ? Object.fromEntries(Object.entries(JSON.parse(readFileSync(BASELINE_FILE, "utf8")).baseline).map(([k, v]) => [k, v.ids]))
  : await baselineSnapshot();

if (DRY_RUN) {
  console.log("\nSimulación: no se ha borrado nada. Para ejecutar: --apply --confirmo-borrar-despejalapp");
  await db.terminate();
  process.exit(0);
}

/* ── Volcado previo ────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(OUT_DIR, `backup-reset-${stamp}.json`);
writeFileSync(backupFile, JSON.stringify({ project: PROJECT, at: stamp, soloE2E: SOLO_E2E, targets }, null, 2));
console.log(`\nVolcado previo guardado en ${path.relative(process.cwd(), backupFile)}`);

/* ── Borrado ───────────────────────────────────────────────────────────────── */

let batch = db.batch();
let pending = 0;
async function batchDelete(ref) {
  batch.delete(ref);
  pending += 1;
  if (pending >= BATCH_LIMIT) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}

for (const [col, docs] of Object.entries(targets.plain)) {
  for (const { id } of docs) await batchDelete(db.collection(col).doc(id));
}
if (pending > 0) await batch.commit();

for (const [col, dumps] of Object.entries(targets.recursive)) {
  for (const dump of dumps) await db.recursiveDelete(db.collection(col).doc(dump.id));
}

let deletedFiles = 0;
for (const name of targets.storage) {
  await storageDelete(name);
  deletedFiles += 1;
}
console.log(`Borrados ${totalDocs} documentos y ${deletedFiles} ficheros.`);

/* ── Verificación posterior ────────────────────────────────────────────────── */

console.log("\nVerificación:");
let failed = false;
if (!SOLO_E2E) {
  for (const col of [...PLAIN_COLLECTIONS, ...RECURSIVE_COLLECTIONS]) {
    const n = (await db.collection(col).count().get()).data().count;
    const expected = CONSERVAR_EMPRESA && col === "presupuestos_config" ? 1 : 0;
    console.log(`  ${col.padEnd(30)} ${n === expected ? (expected ? "solo company" : "vacía") : `QUEDAN ${n}`}`);
    if (n !== expected) failed = true;
  }
  for (const prefix of STORAGE_PREFIXES) {
    const left = await storageList(prefix);
    console.log(`  ${`Storage ${prefix}**`.padEnd(30)} ${left.length === 0 ? "vacío" : `QUEDAN ${left.length}`}`);
    if (left.length) failed = true;
  }
}
const baselineAfter = await baselineSnapshot();
for (const col of BASELINE_COLLECTIONS) {
  const before = baselineBefore[col] ?? [];
  const after = baselineAfter[col];
  const missing = before.filter((id) => !after.includes(id));
  console.log(`  ${col.padEnd(30)} ${missing.length === 0 ? `intacta (${after.length})` : `FALTAN ${missing.length}: ${missing.slice(0, 5).join(", ")}`}`);
  if (missing.length) failed = true;
}

process.exitCode = failed ? 2 : 0;
console.log(failed ? "\n✗ La verificación posterior ha fallado: revisa arriba." : "\n✓ Reset completado y verificado.");
await db.terminate();
