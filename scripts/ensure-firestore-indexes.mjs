#!/usr/bin/env node
/**
 * Aplica `dlx-calculator-main/firestore.indexes.json` al proyecto `despejalapp`
 * SIN firebase CLI, por la API de administración de Firestore.
 *
 *   - `fieldOverrides`: PATCH de la configuración de índices del campo
 *     (collectionGroups/{cg}/fields/{campo}). La lista que se envía SUSTITUYE
 *     a la que hubiera, igual que hace la CLI.
 *   - `indexes` (compuestos): se crean si no existe uno con los mismos campos.
 *
 * Uso (desde dlx-portal-main):
 *
 *   node --env-file=.env.local scripts/ensure-firestore-indexes.mjs            # muestra diferencias
 *   node --env-file=.env.local scripts/ensure-firestore-indexes.mjs --apply    # las aplica
 *
 * Crear un índice de campo tarda unos minutos en quedar READY; el script lo
 * pide y termina. Vuelve a ejecutar la auditoría para confirmarlo.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const PROJECT = "despejalapp";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;
const here = path.dirname(fileURLToPath(import.meta.url));
const INDEXES_FILE = path.resolve(here, "../../dlx-calculator-main/firestore.indexes.json");
const APPLY = process.argv.includes("--apply");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.error("Falta FIREBASE_SERVICE_ACCOUNT_KEY. Ejecuta con --env-file=.env.local desde dlx-portal-main.");
  process.exit(1);
}
const client = await new GoogleAuth({
  credentials: JSON.parse(raw),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
}).getClient();

const spec = JSON.parse(readFileSync(INDEXES_FILE, "utf8"));
let changes = 0;

/* ── Overrides de campo ────────────────────────────────────────────────────── */

const sameIndex = (a, b) =>
  a.queryScope === b.queryScope
  && JSON.stringify(a.fields ?? []) === JSON.stringify(b.fields ?? []);

for (const override of spec.fieldOverrides ?? []) {
  const name = `${BASE}/collectionGroups/${override.collectionGroup}/fields/${override.fieldPath}`;
  const { data: field } = await client.request({ url: name });
  const live = field.indexConfig?.indexes ?? [];
  // En el fichero cada índice de campo se expresa como {queryScope, order|arrayConfig};
  // la API lo devuelve como {queryScope, fields:[{fieldPath, order|arrayConfig}]}.
  const wanted = override.indexes.map((i) => ({
    queryScope: i.queryScope,
    fields: [{ fieldPath: override.fieldPath, ...(i.order ? { order: i.order } : { arrayConfig: i.arrayConfig }) }],
  }));
  const missing = wanted.filter((w) => !live.some((l) => sameIndex(l, w)));
  const extra = live.filter((l) => !wanted.some((w) => sameIndex(l, w)));
  console.log(`${override.collectionGroup}.${override.fieldPath}: publicados ${live.length}, deseados ${wanted.length}, faltan ${missing.length}, sobran ${extra.length}`);
  for (const m of missing) console.log(`  + ${m.queryScope} ${JSON.stringify(m.fields[0])}`);
  for (const e of extra) console.log(`  - ${e.queryScope} ${JSON.stringify(e.fields[0])}`);
  if (missing.length === 0 && extra.length === 0) continue;
  changes += 1;
  if (!APPLY) continue;
  await client.request({
    url: `${name}?updateMask=indexConfig`,
    method: "PATCH",
    data: { name: field.name, indexConfig: { indexes: wanted } },
  });
  console.log("  → aplicado (la creación de índices tarda unos minutos).");
}

/* ── Índices compuestos ────────────────────────────────────────────────────── */

for (const index of spec.indexes ?? []) {
  const listUrl = `${BASE}/collectionGroups/${index.collectionGroup}/indexes`;
  const { data } = await client.request({ url: listUrl });
  const exists = (data.indexes ?? []).some(
    (i) => i.queryScope === index.queryScope && JSON.stringify(i.fields) === JSON.stringify(index.fields),
  );
  console.log(`compuesto ${index.collectionGroup} ${JSON.stringify(index.fields)}: ${exists ? "existe" : "FALTA"}`);
  if (exists) continue;
  changes += 1;
  if (!APPLY) continue;
  await client.request({ url: listUrl, method: "POST", data: { queryScope: index.queryScope, fields: index.fields } });
  console.log("  → creación solicitada.");
}

if (changes === 0) console.log("\nTodo en orden: los índices publicados coinciden con el fichero.");
else if (!APPLY) console.log(`\n${changes} diferencia(s). Ejecuta con --apply para aplicarlas.`);
