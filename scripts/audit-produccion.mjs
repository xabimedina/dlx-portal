#!/usr/bin/env node
/**
 * Auditoría de producción (SOLO LECTURA) del proyecto Firebase `despejalapp`
 * para los módulos Obras, Presupuestos, Comparador y Parámetros de dlx-admin.
 *
 * No escribe nada en Firestore, Storage ni Auth. Produce un informe en consola
 * y un JSON en `scripts/out/` que sirve de línea base para comparar antes y
 * después de cualquier operación (reset, recorrido E2E…).
 *
 * Uso (desde dlx-portal-main):
 *
 *   node --env-file=.env.local scripts/audit-produccion.mjs
 *   node --env-file=.env.local scripts/audit-produccion.mjs --sin-sondas   # sin SDK cliente
 *   node --env-file=.env.local scripts/audit-produccion.mjs --comparar scripts/out/audit-<fecha>.json
 *
 * Qué comprueba:
 *   1. Inventario de las colecciones de los tres módulos (con subcolecciones).
 *   2. Línea base de NO regresión: conteo + ids de users, results, mail,
 *      projects, web, blog, portal_users (que este trabajo no debe tocar).
 *   3. Marcadores de datos de prueba (ids `seed-`/`E2E-`, nombres «test/demo/prueba»).
 *   4. Conformidad de esquema con las convenciones de dlx-admin.
 *   5. Reglas PUBLICADAS de Firestore y Storage frente a los ficheros canónicos.
 *   6. Índice del collection group `decisions.id` (lo usa el portal).
 *   7. Paridad de DEFAULT_CALCULATOR_PARAMS entre admin y calculadora.
 *   8. Sondas anónimas con el SDK cliente: lo privado se deniega, lo público se lee.
 *
 * Con `--comparar <json>` además contrasta la línea base actual con la de un
 * informe anterior y sale con código 2 si algo de la línea base desapareció.
 * Código de salida 1 si hay errores (reglas, índice, sondas); 0 si todo bien.
 *
 * Probarlo SIN producción: con los emuladores de dlx-e2e arrancados, las
 * variables FIRESTORE_EMULATOR_HOST y FIREBASE_STORAGE_EMULATOR_HOST (las dos)
 * y la cuenta de servicio falsa del E2E en FIREBASE_SERVICE_ACCOUNT_KEY. En ese
 * modo se omiten las reglas publicadas, el índice y las sondas (5, 6 y 8), que
 * solo tienen sentido contra el proyecto real.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";

const PROJECT = "despejalapp";
const BUCKET = `${PROJECT}.firebasestorage.app`;
const here = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(here, "..", "..");
const RULES_FIRESTORE = path.join(WORKSPACE, "dlx-calculator-main", "firestore.rules");
const RULES_STORAGE = path.join(WORKSPACE, "dlx-calculator-main", "storage.rules");
const INDEXES_FILE = path.join(WORKSPACE, "dlx-calculator-main", "firestore.indexes.json");
const ADMIN_PARAMS = path.join(WORKSPACE, "dlx-admin-main", "src", "server", "services", "calculator-params.ts");
const PRODUCT_FAMILIES_FILE = path.join(WORKSPACE, "dlx-admin-main", "src", "lib", "comparador", "families.ts");
/* Fotos de los productos del Comparador. */
const PRODUCTS_PREFIX = "comparador/products/";
const CALC_CONSTANTS = path.join(WORKSPACE, "dlx-calculator-main", "src", "pages", "form", "calculation", "utils", "constants.ts");
const OUT_DIR = path.join(here, "out");

const args = process.argv.slice(2);
const SIN_SONDAS = args.includes("--sin-sondas");
const compareAt = args.indexOf("--comparar");
const COMPARE_WITH = compareAt >= 0 ? args[compareAt + 1] : null;

/* Colecciones de los módulos (objeto de este trabajo). */
const MODULE_COLLECTIONS = {
  obras: ["portal_clients", "portal_projects"],
  obrasSub: ["phases", "decisions", "meetings", "documents", "weeklyUpdates", "photos", "requests"],
  presupuestos: [
    "presupuestos_config",
    "presupuestos_suppliers",
    "presupuestos_catalog",
    "presupuestos_quotes",
    "presupuestos_revit_mappings",
    "presupuestos_revit",
  ],
  comparador: ["comparador_products"],
};
/* Colecciones que este trabajo NO debe tocar: solo se cuentan y se listan ids. */
const BASELINE_COLLECTIONS = ["users", "results", "mail", "projects", "web", "blog", "portal_users"];

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
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

/* ── Emuladores (solo para probar este script) ─────────────────────────────────
 * Igual que en reset-modulos.mjs: las DOS variables o ninguna. */
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
const googleAuth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const apiClient = await googleAuth.getClient();

/** Petición de lectura a la API JSON de Storage: la real o la del emulador. */
async function storageGet(url, params) {
  if (!ON_EMULATORS) return apiClient.request({ url, params });
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, String(value));
  const response = await fetch(target, { headers: { Authorization: "Bearer owner" } });
  if (!response.ok) throw new Error(`GET ${target} → ${response.status} ${await response.text()}`);
  return { data: await response.json() };
}

/**
 * Storage por la API JSON, no por `@google-cloud/storage`: esa librería arrastra
 * una google-auth-library antigua (node-fetch) que en Node 24 falla al pedir el
 * token con «Premature close». El cliente de arriba es el moderno y funciona.
 */
async function storageList(prefix, { delimiter } = {}) {
  const names = [];
  const prefixes = new Set();
  let pageToken;
  do {
    const params = { prefix, fields: "items(name,size),prefixes,nextPageToken", maxResults: 1000 };
    if (delimiter) params.delimiter = delimiter;
    if (pageToken) params.pageToken = pageToken;
    const { data } = await storageGet(`${STORAGE_API}/b/${BUCKET}/o`, params);
    for (const item of data.items ?? []) names.push(item.name);
    for (const p of data.prefixes ?? []) prefixes.add(p);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { names, prefixes: [...prefixes] };
}

/* ── Informe ───────────────────────────────────────────────────────────────── */

const report = {
  generatedAt: new Date().toISOString(),
  project: PROJECT,
  onEmulators: ON_EMULATORS,
  inventory: {},
  baseline: {},
  storage: {},
  testMarkers: [],
  schema: [],
  rules: {},
  index: {},
  paramsParity: {},
  probes: [],
  findings: [], // { level: "error" | "warn" | "info", area, message }
};

function finding(level, area, message) {
  report.findings.push({ level, area, message });
  const tag = level === "error" ? "✗" : level === "warn" ? "!" : "·";
  console.log(`  ${tag} [${area}] ${message}`);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 70 - title.length))}`);
}

/* ── 1. Inventario ─────────────────────────────────────────────────────────── */

async function countCollection(ref) {
  const snap = await ref.count().get();
  return snap.data().count;
}

async function listIds(ref) {
  const snap = await ref.select().get();
  return snap.docs.map((d) => d.id).sort();
}

section("1. Inventario de los módulos");
for (const col of [...MODULE_COLLECTIONS.obras, ...MODULE_COLLECTIONS.presupuestos, ...MODULE_COLLECTIONS.comparador]) {
  const ids = await listIds(db.collection(col));
  report.inventory[col] = { count: ids.length, ids };
  console.log(`  ${col.padEnd(32)} ${String(ids.length).padStart(5)} docs`);
}

// Subcolecciones de cada obra.
const projectSub = {};
for (const pid of report.inventory.portal_projects.ids) {
  projectSub[pid] = {};
  for (const sub of MODULE_COLLECTIONS.obrasSub) {
    projectSub[pid][sub] = await countCollection(db.collection("portal_projects").doc(pid).collection(sub));
  }
}
report.inventory.portal_projects.subcollections = projectSub;
const subTotals = {};
for (const sub of MODULE_COLLECTIONS.obrasSub) {
  subTotals[sub] = Object.values(projectSub).reduce((acc, p) => acc + p[sub], 0);
}
console.log(`  portal_projects/*/… ${JSON.stringify(subTotals)}`);

// Catálogo Revit (subcolección items).
const revitItems = await countCollection(db.collection("presupuestos_revit").doc("catalog").collection("items"));
report.inventory["presupuestos_revit/catalog/items"] = { count: revitItems };
console.log(`  ${"presupuestos_revit/catalog/items".padEnd(32)} ${String(revitItems).padStart(5)} docs`);

// config/calculator
const calcSnap = await db.collection("config").doc("calculator").get();
report.inventory["config/calculator"] = { exists: calcSnap.exists };
console.log(`  ${"config/calculator".padEnd(32)} ${calcSnap.exists ? "existe" : "NO existe"}`);
if (!calcSnap.exists) finding("warn", "parametros", "config/calculator no existe: la calculadora usa los defaults de código hasta inicializarlo.");

/* ── 2. Línea base de no regresión ─────────────────────────────────────────── */

section("2. Línea base (colecciones que NO se tocan)");
for (const col of BASELINE_COLLECTIONS) {
  const ids = await listIds(db.collection(col));
  report.baseline[col] = { count: ids.length, ids };
  console.log(`  ${col.padEnd(32)} ${String(ids.length).padStart(5)} docs`);
}

/* ── Storage ───────────────────────────────────────────────────────────────── */

section("Storage");
const { prefixes } = await storageList("", { delimiter: "/" });
report.storage.topLevelPrefixes = prefixes;
console.log(`  carpetas raíz del bucket: ${prefixes.join(", ") || "(ninguna)"}`);
const portalFiles = (await storageList("portal/projects/")).names;
report.storage.portalProjects = { count: portalFiles.length, names: portalFiles };
console.log(`  ${"portal/projects/**".padEnd(32)} ${portalFiles.length} ficheros`);
const productFiles = (await storageList(PRODUCTS_PREFIX)).names;
report.storage.comparadorProducts = { count: productFiles.length, names: productFiles };
console.log(`  ${`${PRODUCTS_PREFIX}**`.padEnd(32)} ${productFiles.length} ficheros (fotos de producto)`);
for (const prefix of ["projects/images/", "projects/portrait/", "blog/images/"]) {
  const { names } = await storageList(prefix);
  report.storage[prefix] = { count: names.length };
  console.log(`  ${prefix.padEnd(32)} ${names.length} ficheros (línea base)`);
}

/* ── 3. Marcadores de datos de prueba ──────────────────────────────────────── */

section("3. Marcadores de datos de prueba");
const TEST_RE = /\b(test|demo|prueba|e2e|seed)\b/i;
for (const col of [...MODULE_COLLECTIONS.obras, ...MODULE_COLLECTIONS.presupuestos, ...MODULE_COLLECTIONS.comparador]) {
  const snap = await db.collection(col).get();
  for (const d of snap.docs) {
    const data = d.data();
    const haystack = [d.id, data.name, data.full_name, data.email, data.title, data.client?.name, data.number]
      .filter(Boolean)
      .join(" | ");
    if (d.id.startsWith("seed-") || d.id.startsWith("E2E-") || TEST_RE.test(haystack)) {
      report.testMarkers.push({ collection: col, id: d.id, label: haystack });
    }
  }
}
if (report.testMarkers.length === 0) console.log("  (ninguno)");
for (const m of report.testMarkers) console.log(`  ${m.collection}/${m.id}  ←  ${m.label}`);

/* ── 4. Conformidad de esquema ─────────────────────────────────────────────── */

section("4. Conformidad de esquema");
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function walkTimestamps(value, pathParts, out) {
  if (value instanceof Timestamp) {
    out.push(pathParts.join("."));
    return;
  }
  if (Array.isArray(value)) value.forEach((v, i) => walkTimestamps(v, [...pathParts, String(i)], out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkTimestamps(v, [...pathParts, k], out);
  }
}

function schemaIssue(col, id, message) {
  report.schema.push({ collection: col, id, message });
}

// portal_*: snake_case, id duplicado, fechas como string, sin Timestamp.
for (const col of MODULE_COLLECTIONS.obras) {
  const snap = await db.collection(col).get();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.id !== d.id) schemaIssue(col, d.id, `campo id (${data.id}) ≠ id del documento`);
    const ts = [];
    walkTimestamps(data, [], ts);
    if (ts.length) schemaIssue(col, d.id, `Timestamp en ${ts.join(", ")} (el modelo usa strings ISO)`);
    if (typeof data.created_at !== "string" || !ISO_RE.test(data.created_at)) {
      schemaIssue(col, d.id, `created_at no es ISO string: ${JSON.stringify(data.created_at)}`);
    }
    if (col === "portal_clients" && typeof data.email === "string" && data.email !== data.email.toLowerCase()) {
      schemaIssue(col, d.id, `email no normalizado a minúsculas: ${data.email}`);
    }
    if (col === "portal_projects") {
      if (!Array.isArray(data.authorized_emails)) schemaIssue(col, d.id, "authorized_emails ausente o no es array");
      for (const f of ["start_date", "estimated_end_date"]) {
        if (data[f] != null && (typeof data[f] !== "string" || !YMD_RE.test(data[f]))) {
          schemaIssue(col, d.id, `${f} no es YYYY-MM-DD: ${JSON.stringify(data[f])}`);
        }
      }
      if (data.quote && data.quote.id) {
        const q = await db.collection("presupuestos_quotes").doc(data.quote.id).get();
        if (!q.exists) schemaIssue(col, d.id, `quote.id ${data.quote.id} no existe en presupuestos_quotes`);
        else if (q.data().projectId !== d.id) schemaIssue(col, d.id, `presupuestos_quotes/${data.quote.id}.projectId (${q.data().projectId}) no apunta a esta obra`);
      }
      for (const sub of MODULE_COLLECTIONS.obrasSub) {
        const subSnap = await d.ref.collection(sub).get();
        for (const s of subSnap.docs) {
          const sd = s.data();
          if (sd.id !== s.id) schemaIssue(`${col}/${d.id}/${sub}`, s.id, `campo id (${sd.id}) ≠ id del documento`);
          if (sd.project_id !== d.id) schemaIssue(`${col}/${d.id}/${sub}`, s.id, `project_id (${sd.project_id}) ≠ obra`);
          const sts = [];
          walkTimestamps(sd, [], sts);
          if (sts.length) schemaIssue(`${col}/${d.id}/${sub}`, s.id, `Timestamp en ${sts.join(", ")}`);
        }
      }
    }
  }
}

// presupuestos_*: camelCase, fracciones 0–1, fechas string, sin Timestamp, sin derivados.
const DERIVED = ["unitCost", "revenue", "cost", "profit", "margin", "netRevenue", "vatAmount", "total"];
const RATE_FIELDS = ["vatRate", "managementRate", "taxesRate", "supplierDiscount", "surcharge", "defaultVat", "defaultManagementRate", "discount", "discountOverride", "surchargeOverride", "vatRateOverride", "generalDiscount", "costAdjustment"];
function checkRates(col, id, obj, prefix = "") {
  for (const f of RATE_FIELDS) {
    const v = obj?.[f];
    if (typeof v === "number" && (v < 0 || v > 1)) schemaIssue(col, id, `${prefix}${f}=${v} fuera de 0–1 (las tasas son fracciones)`);
  }
}
for (const col of MODULE_COLLECTIONS.presupuestos) {
  const snap = await db.collection(col).get();
  for (const d of snap.docs) {
    const data = d.data();
    const ts = [];
    walkTimestamps(data, [], ts);
    if (ts.length) schemaIssue(col, d.id, `Timestamp en ${ts.join(", ")} (el módulo usa strings)`);
    const snake = Object.keys(data).filter((k) => k.includes("_"));
    if (snake.length && col !== "presupuestos_config") schemaIssue(col, d.id, `claves snake_case: ${snake.join(", ")}`);
    checkRates(col, d.id, data);
    if (col === "presupuestos_quotes") {
      if (data.id !== d.id) schemaIssue(col, d.id, `campo id (${data.id}) ≠ id del documento`);
      if (!YMD_RE.test(String(data.createdAt))) schemaIssue(col, d.id, `createdAt no es YYYY-MM-DD: ${data.createdAt}`);
      if (data.validUntil != null && !YMD_RE.test(String(data.validUntil))) schemaIssue(col, d.id, `validUntil no es YYYY-MM-DD: ${data.validUntil}`);
      if (data.updatedAt != null && !ISO_RE.test(String(data.updatedAt))) schemaIssue(col, d.id, `updatedAt no es ISO: ${data.updatedAt}`);
      if ("commercialDiscount" in data) schemaIssue(col, d.id, "campo obsoleto commercialDiscount (el estudio ya no hace descuentos)");
      for (const f of DERIVED) if (f in data) schemaIssue(col, d.id, `derivado persistido: ${f}`);
      if (!Array.isArray(data.lines)) schemaIssue(col, d.id, "lines no es array");
      else data.lines.forEach((l, i) => {
        checkRates(col, d.id, l, `lines[${i}].`);
        for (const f of DERIVED) if (f in l) schemaIssue(col, d.id, `lines[${i}] derivado persistido: ${f}`);
      });
      if (data.projectId) {
        const p = await db.collection("portal_projects").doc(data.projectId).get();
        if (!p.exists) schemaIssue(col, d.id, `projectId ${data.projectId} no existe en portal_projects`);
        else if (p.data().quote?.id !== d.id) schemaIssue(col, d.id, `portal_projects/${data.projectId}.quote.id no apunta a este presupuesto`);
      }
    }
  }
}

// Contadores ≥ mayor secuencia por año.
const quotesSnap = await db.collection("presupuestos_quotes").select("number").get();
const highest = {};
for (const d of quotesSnap.docs) {
  const m = /^P-(\d{4})-(\d+)$/.exec(String(d.data().number ?? ""));
  if (!m) { schemaIssue("presupuestos_quotes", d.id, `number con formato inesperado: ${d.data().number}`); continue; }
  highest[m[1]] = Math.max(highest[m[1]] ?? 0, Number(m[2]));
}
const countersSnap = await db.collection("presupuestos_config").doc("counters").get();
const counters = countersSnap.exists ? countersSnap.data() : {};
for (const [year, seq] of Object.entries(highest)) {
  if ((counters[year] ?? 0) < seq) schemaIssue("presupuestos_config", "counters", `contador ${year}=${counters[year] ?? "∅"} < mayor número emitido ${seq}`);
}
report.inventory.counters = { stored: counters, highestByYear: highest };

// comparador_products: la forma que escribe saveProduct del admin. Mismas
// convenciones que Presupuestos (camelCase, fracciones 0–1, sin Timestamp) y
// además: familia conocida, importes válidos, proveedor que existe, código
// único, características completas y fotos que existen bajo su carpeta. Las
// familias se leen del propio admin (families.ts no tiene imports a propósito
// para poder cargarse desde aquí).
let productFamilies = null;
try {
  const familiesModule = await import(pathToFileURL(PRODUCT_FAMILIES_FILE).href);
  productFamilies = new Set(familiesModule.PRODUCT_FAMILIES.map((family) => family.id));
} catch (error) {
  finding("warn", "esquema", `No se pudieron cargar las familias de producto: ${error?.message || error}`);
}
const productFileSet = new Set(productFiles);
const supplierIds = new Set((await db.collection("presupuestos_suppliers").select().get()).docs.map((d) => d.id));
const PRODUCT_KEYS = new Set([
  "id", "code", "family", "name", "brand", "model", "unit", "specs", "clientNote", "installation",
  "images", "salePrice", "vatRateOverride", "listPrice", "supplierId", "discountOverride", "active", "updatedAt",
]);

function checkProduct(id, product) {
  const issue = (message) => schemaIssue("comparador_products", id, message);
  if (product.id !== id) issue(`campo id (${product.id}) ≠ id del documento`);
  if (productFamilies && !productFamilies.has(product.family)) issue(`familia desconocida «${product.family}»`);
  for (const f of ["code", "name", "brand", "model", "unit", "clientNote", "supplierId"]) {
    if (typeof product[f] !== "string") issue(`${f} no es texto`);
  }
  if (!String(product.code ?? "").trim()) issue("sin código");
  for (const f of ["salePrice", "listPrice"]) {
    if (typeof product[f] !== "number" || !Number.isFinite(product[f]) || product[f] < 0) {
      issue(`${f}=${JSON.stringify(product[f])} no es un importe válido`);
    }
  }
  if (product.supplierId && !supplierIds.has(product.supplierId)) {
    issue(`supplierId ${product.supplierId} no existe en presupuestos_suppliers`);
  }
  if (typeof product.active !== "boolean") issue("active no es booleano");
  if (!ISO_RE.test(String(product.updatedAt))) issue(`updatedAt no es ISO: ${JSON.stringify(product.updatedAt)}`);
  if (![null, "included", "excluded"].includes(product.installation)) {
    issue(`installation=${JSON.stringify(product.installation)} (solo included, excluded o null)`);
  }
  if (!Array.isArray(product.specs)) issue("specs no es una lista");
  else product.specs.forEach((spec, i) => {
    if (typeof spec?.label !== "string" || typeof spec?.value !== "string" || !spec.label.trim() || !spec.value.trim()) {
      issue(`specs[${i}] incompleta`);
    }
  });
  const folder = `${PRODUCTS_PREFIX}${id}/`;
  if (!Array.isArray(product.images)) issue("images no es una lista");
  else product.images.forEach((image, i) => {
    if (typeof image?.id !== "string" || !image.id) issue(`images[${i}] sin id`);
    for (const f of ["path", "thumbPath"]) {
      const value = image?.[f];
      if (f === "thumbPath" && !value) continue; // sin miniatura se usa la foto grande
      if (typeof value !== "string" || !value.startsWith(folder)) issue(`images[${i}].${f} fuera de ${folder}`);
      else if (!productFileSet.has(value)) issue(`images[${i}].${f} apunta a un fichero que no está en Storage: ${value}`);
    }
    for (const f of ["width", "height"]) if (typeof image?.[f] !== "number") issue(`images[${i}].${f} no es un número`);
    if (!ISO_RE.test(String(image?.uploadedAt))) issue(`images[${i}].uploadedAt no es ISO: ${JSON.stringify(image?.uploadedAt)}`);
    for (const f of ["url", "thumbUrl"]) {
      if (image?.[f] !== undefined && typeof image[f] !== "string") issue(`images[${i}].${f} no es texto`);
    }
  });
  // El producto se enseña al cliente: un campo que sobre puede ser un dato interno colado.
  const extra = Object.keys(product).filter((k) => !PRODUCT_KEYS.has(k));
  if (extra.length) issue(`campos que no son del producto: ${extra.join(", ")}`);
}

const productsSnap = await db.collection("comparador_products").get();
const productCodes = new Map();
for (const d of productsSnap.docs) {
  const data = d.data();
  const ts = [];
  walkTimestamps(data, [], ts);
  if (ts.length) schemaIssue("comparador_products", d.id, `Timestamp en ${ts.join(", ")} (el módulo usa strings)`);
  const snake = Object.keys(data).filter((k) => k.includes("_"));
  if (snake.length) schemaIssue("comparador_products", d.id, `claves snake_case: ${snake.join(", ")}`);
  checkRates("comparador_products", d.id, data);
  checkProduct(d.id, data);
  const code = String(data.code ?? "").trim();
  if (code) productCodes.set(code, [...(productCodes.get(code) ?? []), d.id]);
}
for (const [code, ids] of productCodes) {
  if (ids.length > 1) schemaIssue("comparador_products", ids.join(", "), `código repetido: ${code}`);
}
report.inventory.comparadorProducts = {
  count: productsSnap.size,
  active: productsSnap.docs.filter((d) => d.data().active !== false).length,
};
console.log(`  productos del comparador: ${productsSnap.size} (${report.inventory.comparadorProducts.active} activos)`);

// config/calculator: forma completa.
if (calcSnap.exists) {
  const data = calcSnap.data();
  const REQUIRED = ["reformCosts", "stylesModifierMap", "improvementModifiers", "improvementModifiersPartial", "surfaceImprovements", "surfaceImprovementsPartial", "roomSurfaceMultipliers", "zoneMultipliers", "zoneFallbacks", "bathroomKitchenDefaults", "ivaRate"];
  const missing = REQUIRED.filter((k) => !(k in data));
  if (missing.length) schemaIssue("config", "calculator", `faltan claves (la calculadora las sustituirá por defaults): ${missing.join(", ")}`);
  if (!(data.updated_at instanceof Timestamp)) schemaIssue("config", "calculator", "updated_at no es Timestamp");
  if (typeof data.ivaRate === "number" && (data.ivaRate < 1 || data.ivaRate > 2)) schemaIssue("config", "calculator", `ivaRate=${data.ivaRate} (aquí es multiplicador, p. ej. 1.21)`);
}

if (report.schema.length === 0) console.log("  sin incidencias");
for (const s of report.schema) finding("warn", "esquema", `${s.collection}/${s.id}: ${s.message}`);

/* ── 5. Reglas publicadas vs repo ──────────────────────────────────────────── */

section("5. Reglas publicadas frente a los ficheros canónicos");
async function publishedRules(releaseId) {
  const url = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/${releaseId}`;
  const { data: rel } = await apiClient.request({ url });
  const { data: ruleset } = await apiClient.request({ url: `https://firebaserules.googleapis.com/v1/${rel.rulesetName}` });
  return { rulesetName: rel.rulesetName, updateTime: rel.updateTime, content: ruleset.source.files.map((f) => f.content).join("\n") };
}
const normalize = (s) => s.replace(/\r\n/g, "\n").trimEnd();
if (ON_EMULATORS) console.log("  omitido en emuladores (las reglas publicadas solo existen en el proyecto real)");
for (const [label, releaseId, file] of ON_EMULATORS ? [] : [
  ["firestore", "cloud.firestore", RULES_FIRESTORE],
  ["storage", `firebase.storage/${BUCKET}`, RULES_STORAGE],
]) {
  try {
    const live = await publishedRules(releaseId);
    const repo = readFileSync(file, "utf8");
    const same = normalize(live.content) === normalize(repo);
    report.rules[label] = { rulesetName: live.rulesetName, updateTime: live.updateTime, matchesRepo: same };
    console.log(`  ${label.padEnd(10)} ruleset ${live.rulesetName.split("/").pop()}  (${live.updateTime})  ${same ? "= repo" : "≠ REPO"}`);
    if (!same) finding("error", "reglas", `Las reglas de ${label} publicadas NO coinciden con ${path.relative(WORKSPACE, file)}.`);
  } catch (error) {
    report.rules[label] = { error: String(error?.message || error) };
    finding("error", "reglas", `No se pudo leer la release de ${label}: ${error?.message || error}`);
  }
}

/* ── 6. Índice decisions.id ────────────────────────────────────────────────── */

section("6. Índice collection group decisions.id");
if (ON_EMULATORS) {
  console.log("  omitido en emuladores");
} else try {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups/decisions/fields/id`;
  const { data: field } = await apiClient.request({ url });
  const indexes = field.indexConfig?.indexes ?? [];
  const hasGroupIndex = indexes.some((i) => i.queryScope === "COLLECTION_GROUP" && i.fields?.some((f) => f.fieldPath === "id" && f.order === "ASCENDING"));
  const expected = JSON.parse(readFileSync(INDEXES_FILE, "utf8"));
  const expectsIt = expected.fieldOverrides?.some((o) => o.collectionGroup === "decisions" && o.fieldPath === "id");
  report.index = { hasGroupIndex, expectedInRepo: !!expectsIt, indexes };
  console.log(`  repo espera override: ${expectsIt ? "sí" : "no"}; publicado con COLLECTION_GROUP asc: ${hasGroupIndex ? "sí" : "NO"}`);
  if (expectsIt && !hasGroupIndex) finding("error", "indices", "Falta el índice de collection group decisions.id: el portal no podrá abrir decisiones por id.");
} catch (error) {
  report.index = { error: String(error?.message || error) };
  finding("error", "indices", `No se pudo consultar el campo decisions.id: ${error?.message || error}`);
}

/* ── 7. Paridad de defaults admin ↔ calculadora ────────────────────────────── */

section("7. Paridad de DEFAULT_CALCULATOR_PARAMS (admin ↔ calculadora)");
function extractAdminDefaults() {
  // El servicio del admin importa la config de Firebase de Vite (import.meta.env),
  // así que no se puede importar en Node: se extrae el literal del fuente.
  const src = readFileSync(ADMIN_PARAMS, "utf8");
  const start = src.indexOf("export const DEFAULT_CALCULATOR_PARAMS");
  const open = src.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  const literal = src.slice(open, end + 1);
  return new Function(`return (${literal});`)();
}
try {
  const adminDefaults = extractAdminDefaults();
  const calcModule = await import(pathToFileURL(CALC_CONSTANTS).href);
  const calcDefaults = calcModule.DEFAULT_CALCULATOR_PARAMS;
  const diffs = [];
  const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const a = new Map(flat(adminDefaults));
  const c = new Map(flat(calcDefaults));
  for (const [k, v] of a) if (!c.has(k)) diffs.push(`${k}: solo en admin (${v})`); else if (c.get(k) !== v) diffs.push(`${k}: admin=${v} calculadora=${c.get(k)}`);
  for (const [k, v] of c) if (!a.has(k)) diffs.push(`${k}: solo en calculadora (${v})`);
  report.paramsParity = { equal: diffs.length === 0, diffs, adminDefaults };
  if (diffs.length === 0) console.log("  idénticos");
  for (const d of diffs) finding("warn", "parametros", `Defaults divergentes: ${d}`);
} catch (error) {
  report.paramsParity = { error: String(error?.message || error) };
  finding("warn", "parametros", `No se pudo comparar los defaults: ${error?.message || error}`);
}

/* ── 8. Sondas anónimas (SDK cliente, sin token) ───────────────────────────── */

section("8. Sondas anónimas de reglas (SDK cliente sin autenticar)");
if (SIN_SONDAS || ON_EMULATORS) {
  console.log(ON_EMULATORS ? "  omitidas en emuladores" : "  omitidas (--sin-sondas)");
} else {
  const { initializeApp: initClient, deleteApp } = await import("firebase/app");
  const { getFirestore: getClientDb, collection, getDocs, doc: clientDoc, getDoc: clientGetDoc, query, limit, terminate } = await import("firebase/firestore");
  const { getStorage: getClientStorage, ref: storageRef, listAll } = await import("firebase/storage");
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!cfg.apiKey || cfg.projectId !== PROJECT) {
    finding("warn", "sondas", `Config pública ausente o de otro proyecto (${cfg.projectId}); sondas omitidas.`);
  } else {
    const app = initClient(cfg, "audit-probe");
    const cdb = getClientDb(app);
    const cst = getClientStorage(app);
    const probe = async (label, expectDenied, fn) => {
      let outcome;
      try {
        await fn();
        outcome = "permitido";
      } catch (error) {
        outcome = /permission|unauthorized|403|denied/i.test(String(error?.code || error?.message)) ? "denegado" : `error: ${error?.code || error?.message}`;
      }
      const ok = expectDenied ? outcome === "denegado" : outcome === "permitido";
      report.probes.push({ label, expected: expectDenied ? "denegado" : "permitido", outcome, ok });
      console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(42)} esperado ${expectDenied ? "denegado" : "permitido"} → ${outcome}`);
      if (!ok) finding("error", "sondas", `${label}: esperado ${expectDenied ? "denegado" : "permitido"}, obtenido ${outcome}`);
    };
    const listCol = (name) => () => getDocs(query(collection(cdb, name), limit(1)));
    await probe("list presupuestos_catalog", true, listCol("presupuestos_catalog"));
    await probe("list presupuestos_quotes", true, listCol("presupuestos_quotes"));
    await probe("list comparador_products", true, listCol("comparador_products"));
    await probe("list portal_projects", true, listCol("portal_projects"));
    await probe("list portal_clients", true, listCol("portal_clients"));
    await probe("list users (leads)", true, listCol("users"));
    await probe("list mail", true, listCol("mail"));
    await probe("get config/calculator", false, () => clientGetDoc(clientDoc(cdb, "config", "calculator")));
    await probe("list projects (portfolio público)", false, listCol("projects"));
    await probe("list web (textos públicos)", false, listCol("web"));
    await probe("storage list portal/projects/", true, () => listAll(storageRef(cst, "portal/projects")));
    await probe("storage list comparador/products/", true, () => listAll(storageRef(cst, "comparador/products")));
    await probe("storage list raíz del bucket", true, () => listAll(storageRef(cst, "/")));
    await terminate(cdb);
    await deleteApp(app);
  }
}

/* ── Comparación con una línea base anterior ───────────────────────────────── */

let baselineChanged = false;
if (COMPARE_WITH) {
  section(`Comparación de línea base con ${COMPARE_WITH}`);
  const previous = JSON.parse(readFileSync(COMPARE_WITH, "utf8"));
  for (const col of BASELINE_COLLECTIONS) {
    const before = previous.baseline?.[col];
    const now = report.baseline[col];
    if (!before) { console.log(`  ${col}: sin datos previos`); continue; }
    const missing = before.ids.filter((id) => !now.ids.includes(id));
    const added = now.ids.filter((id) => !before.ids.includes(id));
    const verdict = missing.length ? "FALTAN DOCUMENTOS" : added.length ? `+${added.length} nuevos (crecimiento legítimo)` : "idéntico";
    console.log(`  ${col.padEnd(20)} antes ${String(before.count).padStart(5)}  ahora ${String(now.count).padStart(5)}  ${verdict}`);
    // `mail` y `users` pueden crecer legítimamente (la calculadora pública sigue viva);
    // un aumento no es regresión, pero una desaparición sí.
    if (missing.length) {
      baselineChanged = true;
      finding("error", "regresion", `${col}: desaparecidos ${missing.length} (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""})`);
    }
  }
  for (const prefix of ["projects/images/", "projects/portrait/", "blog/images/"]) {
    const before = previous.storage?.[prefix]?.count;
    const now = report.storage[prefix].count;
    if (before != null && before !== now) { baselineChanged = true; finding("error", "regresion", `Storage ${prefix}: antes ${before}, ahora ${now}`); }
  }
}

/* ── Salida ────────────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true });
const stamp = report.generatedAt.replace(/[:.]/g, "-");
// Los informes de una prueba en emuladores no se pueden confundir con los reales.
const outFile = path.join(OUT_DIR, `audit-${ON_EMULATORS ? "emuladores-" : ""}${stamp}.json`);
writeFileSync(outFile, JSON.stringify(report, null, 2));

section("Resumen");
const errors = report.findings.filter((f) => f.level === "error").length;
const warns = report.findings.filter((f) => f.level === "warn").length;
console.log(`  ${errors} errores, ${warns} avisos. Informe: ${path.relative(process.cwd(), outFile)}`);
// exitCode en lugar de process.exit(): con el canal gRPC abierto, salir a la
// brava dispara una aserción de libuv en Windows.
process.exitCode = baselineChanged ? 2 : errors > 0 ? 1 : 0;
await db.terminate();
