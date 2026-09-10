/**
 * Publica las reglas de Firestore (o, con --storage, las de Storage) en el
 * proyecto `despejalapp` SIN firebase CLI.
 *
 * En este equipo no hay firebase CLI ni login interactivo, así que se habla
 * directamente con la API de Firebase Rules usando la cuenta de servicio del
 * Admin SDK que ya vive en `dlx-portal-main/.env.local`.
 *
 * Uso (desde dlx-portal-main):
 *
 *   # 1. Validar la sintaxis sin tocar nada de lo que está en vivo:
 *   node --env-file=.env.local scripts/publish-firestore-rules.mjs
 *   node --env-file=.env.local scripts/publish-firestore-rules.mjs --storage
 *
 *   # 2. Publicar de verdad (solo cuando el paso 1 haya salido bien):
 *   node --env-file=.env.local scripts/publish-firestore-rules.mjs --publish
 *   node --env-file=.env.local scripts/publish-firestore-rules.mjs --storage --publish
 *
 *   # Volver a un ruleset anterior, si algo sale mal:
 *   node --env-file=.env.local scripts/publish-firestore-rules.mjs [--storage] --rollback <rulesetId>
 *
 * Los ficheros canónicos son `dlx-calculator-main/firestore.rules` y
 * `dlx-calculator-main/storage.rules` (los únicos que se despliegan en todo el
 * ecosistema); se puede pasar otra ruta como primer argumento.
 *
 * Rulesets de referencia (Firestore):
 *   637f309b-fe49-420c-aabd-9fa3542d199f  publicado el 2026-07-26 (antes de DATA-5)
 *   ac96aad1-acee-455c-8633-edd199728cdd  el anterior, con las reglas abiertas
 * Rulesets de referencia (Storage):
 *   3be3192a-be8a-4492-bebc-1a8f15ecb7dc  publicado el 2026-07-26
 *   fd91ae26-ad2b-4a29-b2ef-394c42eef2a9  el anterior, con las reglas abiertas
 *
 * ⚠️ La API responde 404 con PUT sobre la release: tiene que ser PATCH y con el
 * cuerpo envuelto en `{ release: { ... } }`. El id de la release de Storage
 * lleva una barra (`firebase.storage/<bucket>`) y va tal cual en la URL.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const PROJECT = "despejalapp";
const BUCKET = `${PROJECT}.firebasestorage.app`;

const args = process.argv.slice(2);
const STORAGE = args.includes("--storage");
const publish = args.includes("--publish");
const rollbackAt = args.indexOf("--rollback");
const rollbackId = rollbackAt >= 0 ? args[rollbackAt + 1] : null;

const RELEASE_ID = STORAGE ? `firebase.storage/${BUCKET}` : "cloud.firestore";
const RELEASE = `projects/${PROJECT}/releases/${RELEASE_ID}`;
const FILE_NAME = STORAGE ? "storage.rules" : "firestore.rules";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RULES = path.resolve(here, "../../dlx-calculator-main", FILE_NAME);
const rulesPath = args.find((arg) => !arg.startsWith("--") && arg !== rollbackId)
  ?? DEFAULT_RULES;

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error(
    "Falta FIREBASE_SERVICE_ACCOUNT_KEY. Ejecuta con --env-file=.env.local desde dlx-portal-main.",
  );
  process.exit(1);
}

const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();

/** Apunta la release a un ruleset ya existente. */
async function release(rulesetName) {
  const { data } = await client.request({
    url: `https://firebaserules.googleapis.com/v1/${RELEASE}`,
    method: "PATCH",
    data: { release: { name: RELEASE, rulesetName } },
  });
  console.log(`Publicado en ${RELEASE_ID}:`, data.rulesetName);
}

if (rollbackId) {
  await release(`projects/${PROJECT}/rulesets/${rollbackId}`);
  process.exit(0);
}

// Crear el ruleset ya valida la sintaxis en el servidor, y no cambia nada de lo
// que está en vivo hasta que se apunta la release.
const { data: created } = await client.request({
  url: `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
  method: "POST",
  data: {
    source: {
      files: [{ name: FILE_NAME, content: readFileSync(rulesPath, "utf8") }],
    },
  },
});

console.log(`Ruleset creado y validado desde ${rulesPath}:`);
console.log(" ", created.name);

if (!publish) {
  console.log("\nNo se ha publicado (falta --publish). Nada ha cambiado en vivo.");
  process.exit(0);
}

await release(created.name);
