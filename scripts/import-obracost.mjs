#!/usr/bin/env node
/**
 * Migración de ObraCost → módulo «Presupuestos» de dlx-admin.
 *
 * Entrada: el backup JSON que ObraCost exporta desde Configuración → Copias de
 * seguridad. Su raíz es el estado completo de la app:
 *
 *   { version, company, suppliers, importMappings, revitCatalog, catalog, quotes }
 *
 * Uso (desde dlx-portal-main, que es donde viven las credenciales del Admin SDK):
 *
 *   node --env-file=.env.local scripts/import-obracost.mjs <backup.json>
 *   node --env-file=.env.local scripts/import-obracost.mjs <backup.json> --dry-run
 *   node --env-file=.env.local scripts/import-obracost.mjs <backup.json> --prune
 *
 * `--dry-run` no escribe nada: valida el backup, enseña los avisos y los conteos
 * que quedarían. Conviene pasarlo SIEMPRE antes de la migración de verdad.
 *
 * `--prune` borra además los documentos que ya están en Firestore y NO vienen en
 * el backup. Sin él la migración solo añade y actualiza, así que un backup
 * incompleto dejaría documentos huérfanos (el informe final los delata: el
 * conteo de destino saldría mayor que el de origen).
 *
 * ── Cómo se conserva la fidelidad ──────────────────────────────────────────
 * - **Los ids se respetan**, incluidos los slugs del seed (`obra-general`,
 *   `stolanic`…): las líneas de los presupuestos apuntan a ellos por `itemId` y
 *   `supplierId`, y renumerarlos rompería presupuestos ya emitidos.
 * - Las categorías pasan por `normalizeBudgetCategory` del dominio ya portado:
 *   los datos guardados mezclan el formato viejo y el nuevo porque el `saveItem`
 *   de ObraCost no normalizaba al guardar.
 * - Las fechas de negocio (`createdAt`, `validUntil`) se quedan como strings
 *   `YYYY-MM-DD`. **No** se convierten a `Timestamp`: son fechas del documento,
 *   no instantes, y un Timestamp las desplazaría por zona horaria.
 * - `accessDifficulty` puede venir como booleano `true` en datos viejos; se
 *   guarda siempre como `"yes"`/`"no"`.
 * - Ningún campo se escribe como `undefined`: Firestore rechazaría el documento
 *   entero. Los opcionales (`catalogCode`, `importSource`, `importMetadata`) o
 *   están con valor o no están.
 *
 * Es idempotente: cada documento se escribe con `set` (sin merge) sobre un id
 * fijo, así que repetir la ejecución deja exactamente el mismo resultado.
 *
 * El dominio NO se reimplementa aquí: se importa el porte de dlx-admin
 * (`src/lib/presupuestos/*.ts`), que es el mismo código que usa la app y el que
 * cubren los tests. Node ≥ 22.18 lee esos `.ts` directamente.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/* ── Colecciones (mismas constantes que `src/server/services/presupuestos.ts`) ── */

const COL_CONFIG = "presupuestos_config";
const COL_SUPPLIERS = "presupuestos_suppliers";
const COL_CATALOG = "presupuestos_catalog";
const COL_QUOTES = "presupuestos_quotes";
const COL_MAPPINGS = "presupuestos_revit_mappings";
const COL_REVIT = "presupuestos_revit";
const DOC_COMPANY = "company";
const DOC_COUNTERS = "counters";
const DOC_REVIT_CATALOG = "catalog";
const SUB_REVIT_ITEMS = "items";

/** Tope de escrituras por lote; el de Firestore son 500. */
const BATCH_LIMIT = 400;

const QUOTE_STATUSES = new Set(["draft", "sent", "accepted", "rejected"]);

/* ── Argumentos ────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [backupPath] = args.filter((arg) => !arg.startsWith("--"));
const DRY_RUN = flags.has("--dry-run");
const PRUNE = flags.has("--prune");

for (const flag of flags) {
  if (!["--dry-run", "--prune"].includes(flag)) {
    console.error(`Opción desconocida: ${flag}`);
    process.exit(1);
  }
}

if (!backupPath) {
  console.error(
    [
      "Uso: node --env-file=.env.local scripts/import-obracost.mjs <backup.json> [--dry-run] [--prune]",
      "",
      "El backup se exporta desde ObraCost en Configuración → Copias de seguridad.",
    ].join("\n"),
  );
  process.exit(1);
}

/* ── Dominio portado (el mismo que usa dlx-admin) ──────────────────────────── */

const ADMIN_LIB = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "dlx-admin-main",
  "src",
  "lib",
  "presupuestos",
);

async function loadDomain() {
  const load = (file) =>
    import(pathToFileURL(path.join(ADMIN_LIB, file)).href);
  try {
    const [structure, calculations, revit] = await Promise.all([
      load("standard-structure.ts"),
      load("calculations.ts"),
      load("revit-import.ts"),
    ]);
    return {
      normalizeBudgetCategory: structure.normalizeBudgetCategory,
      highestSequenceByYear: calculations.highestSequenceByYear,
      parseQuoteNumber: calculations.parseQuoteNumber,
      normalizeRevitCode: revit.normalizeRevitCode,
    };
  } catch (error) {
    console.error(
      [
        "No se ha podido cargar el dominio de dlx-admin desde:",
        `  ${ADMIN_LIB}`,
        "",
        "Se importan los .ts directamente, así que hace falta Node ≥ 22.18 (borrado",
        `de tipos nativo). Node actual: ${process.version}.`,
        "",
        String(error?.message || error),
      ].join("\n"),
    );
    process.exit(1);
  }
}

const {
  normalizeBudgetCategory,
  highestSequenceByYear,
  parseQuoteNumber,
  normalizeRevitCode,
} = await loadDomain();

/* ── Credenciales ──────────────────────────────────────────────────────────── */

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = JSON.parse(raw.replace(/\\n/g, "\n"));
    }
    // Un pegado que escapó dos veces los saltos de línea deja "\n" literales y
    // OpenSSL rechaza la clave; una clave correcta nunca los tiene.
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  }
  const privateKey = process.env.PRIVATE_KEY;
  const clientEmail = process.env.CLIENT_EMAIL;
  if (privateKey && clientEmail) {
    return {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      privateKey: privateKey.replace(/\\n/g, "\n"),
      clientEmail,
    };
  }
  console.error(
    "Faltan credenciales del Admin SDK: define FIREBASE_SERVICE_ACCOUNT_KEY o PRIVATE_KEY + CLIENT_EMAIL en .env.local.",
  );
  process.exit(1);
}

/* ── Saneado ───────────────────────────────────────────────────────────────── */

const warnings = [];
const warn = (message) => warnings.push(message);

const str = (value, fallback = "") =>
  value === null || value === undefined ? fallback : String(value).trim();

/**
 * Número del backup, con aviso cuando no se puede leer.
 *
 * Devolver el fallback en silencio era la forma más discreta de cambiar el
 * total de un presupuesto migrado: una cantidad que llegase como texto en
 * formato español («1.234,56») o un campo corrupto entraban como 0 y ni el
 * --dry-run lo delataba, porque los conteos de documentos cuadraban igual.
 *
 * Antes de rendirse se intenta leerlo como número español, que es de donde
 * vienen estos datos; si se recupera así, también se avisa: puede ser correcto,
 * pero merece una mirada.
 */
const num = (value, fallback = 0, context = "") => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;

  const spanish = parseSpanishNumber(value);
  const where = context ? `${context}: ` : "";
  if (spanish !== null) {
    warn(
      `${where}«${value}» no es un número JSON; se ha leído en formato español como ${spanish}. Compruébalo.`,
    );
    return spanish;
  }
  warn(`${where}«${value}» no es un número; se migra como ${fallback}.`);
  return fallback;
};

/**
 * Lee un número escrito en formato español («1.234,56» → 1234.56).
 *
 * Copia deliberada de `lib/presupuestos/revit-import.ts` del admin: este script
 * es un .mjs suelto que corre con el Admin SDK y no comparte build con la app.
 * Rechaza igual el formato mixto inglés «1,234.56», que leído a la española
 * daría el valor dividido por mil.
 */
function parseSpanishNumber(value) {
  const text = String(value ?? "").replace(/[\s  ]/gu, "");
  if (!text || !/^[+-]?[\d.,]+$/u.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot > lastComma) return null;

  let normalized;
  if (text.includes(",")) {
    normalized = text.replace(/\./gu, "").replace(",", ".");
    if (normalized.includes(",")) return null;
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/u.test(text)) {
    normalized = text.replace(/\./gu, "");
  } else {
    normalized = text;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `null` significa «usa el valor del proveedor»; se persiste explícito. */
const overrideOrNull = (value) =>
  value === null || value === undefined || value === "" ? null : num(value);

const intList = (value) =>
  Array.isArray(value)
    ? value.map(Number).filter((entry) => Number.isFinite(entry))
    : [];

/**
 * Fecha de negocio `YYYY-MM-DD`. Si llega un ISO completo se recorta; si no hay
 * forma de leerla se deja vacía y se avisa (mejor un hueco visible que una fecha
 * inventada en un documento que va al cliente).
 */
function businessDate(value, context) {
  const text = str(value);
  if (!text) return "";
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  warn(`${context}: la fecha «${text}» no tiene formato YYYY-MM-DD; se deja vacía.`);
  return "";
}

/** Los datos antiguos guardaban `true`; a partir de aquí solo `"yes"`/`"no"`. */
const accessDifficulty = (value) =>
  value === true || value === "yes" ? "yes" : "no";

/* ── Mapeo ─────────────────────────────────────────────────────────────────── */

function mapCompany(company) {
  const source = company || {};
  return {
    name: str(source.name),
    taxId: str(source.taxId),
    address: str(source.address),
    city: str(source.city),
    phone: str(source.phone),
    email: str(source.email),
    defaultVat: num(source.defaultVat, 0.21),
    defaultManagementRate: num(source.defaultManagementRate, 0.04),
    defaultValidityDays: num(source.defaultValidityDays, 30),
    // Multilínea: `str` recorta los extremos pero respeta los saltos de dentro.
    paymentTerms: str(source.paymentTerms),
    quoteFooter: str(source.quoteFooter),
  };
}

function mapSupplier(supplier) {
  const where = `Proveedor ${supplier.name || supplier.id}`;
  return {
    id: str(supplier.id),
    name: str(supplier.name),
    contact: str(supplier.contact),
    email: str(supplier.email),
    phone: str(supplier.phone),
    defaultDiscount: num(supplier.defaultDiscount, 0, where),
    surcharge: num(supplier.surcharge, 0, where),
    color: str(supplier.color) || "#50514f",
    notes: str(supplier.notes),
  };
}

function mapCatalogItem(item) {
  const where = `Partida ${item.code || item.id}`;
  return {
    id: str(item.id),
    code: str(item.code),
    category: normalizeBudgetCategory(item.category),
    name: str(item.name),
    description: str(item.description),
    unit: str(item.unit),
    listPrice: num(item.listPrice, 0, where),
    salePrice: num(item.salePrice, 0, where),
    supplierId: str(item.supplierId),
    discountOverride: overrideOrNull(item.discountOverride),
    surchargeOverride: overrideOrNull(item.surchargeOverride),
    active: item.active !== false,
  };
}

function mapImportSource(source) {
  const mapped = {
    type: "revit-xlsx",
    fileName: str(source.fileName),
    code: str(source.code),
    sourceRows: intList(source.sourceRows),
  };
  const measurementRows = intList(source.sourceMeasurementRows);
  if (measurementRows.length) mapped.sourceMeasurementRows = measurementRows;
  return mapped;
}

function mapImportMetadata(metadata) {
  return {
    type: "revit-xlsx",
    fileName: str(metadata.fileName),
    importedAt: str(metadata.importedAt),
    sourceItemRows: num(metadata.sourceItemRows),
    importedLines: num(metadata.importedLines),
  };
}

function mapQuoteLine(line, index, quote, catalogById) {
  const item = catalogById.get(str(line.itemId));
  if (line.itemId && !item) {
    warn(
      `Presupuesto ${quote.number || quote.id}: la línea «${str(line.name) || str(line.code)}» apunta a la partida ${line.itemId}, que no está en el backup.`,
    );
  }

  // Contexto de los avisos: sin él, un «no es un número» en un backup con
  // cientos de líneas no dice en cuál hay que mirar.
  const where = `Presupuesto ${quote.number || quote.id}, línea «${
    str(line.name) || str(line.code) || index + 1
  }»`;

  const mapped = {
    id: str(line.id) || `line-${str(quote.id)}-${index + 1}`,
    itemId: str(line.itemId),
    code: str(line.code ?? item?.code),
    name: str(line.name ?? item?.name),
    category: normalizeBudgetCategory(line.category || item?.category),
    // `??` y no `||`: solo se rellena lo que FALTA. Una descripción vacía a
    // propósito es un snapshot de cuando se añadió la línea, y pisarla con la
    // del catálogo de hoy cambiaría un presupuesto ya emitido.
    description: str(line.description ?? item?.description),
    unit: str(line.unit ?? item?.unit),
    supplierId: str(line.supplierId ?? item?.supplierId),
    quantity: num(line.quantity, 0, `${where} (cantidad)`),
    catalogPrice: num(line.catalogPrice ?? item?.listPrice, 0, `${where} (tarifa)`),
    unitSalePrice: num(
      line.unitSalePrice ?? item?.salePrice,
      0,
      `${where} (precio de venta)`,
    ),
    supplierDiscount: num(line.supplierDiscount, 0, `${where} (descuento)`),
    surcharge: num(line.surcharge, 0, `${where} (recargo)`),
  };

  const catalogCode = str(line.catalogCode);
  if (catalogCode) mapped.catalogCode = catalogCode;
  if (line.importSource) mapped.importSource = mapImportSource(line.importSource);
  return mapped;
}

function mapQuote(quote, catalogById) {
  const status = str(quote.status);
  if (status && !QUOTE_STATUSES.has(status)) {
    warn(
      `Presupuesto ${quote.number || quote.id}: estado «${status}» desconocido; se guarda como borrador.`,
    );
  }

  const client = quote.client || {};
  const where = `Presupuesto ${quote.number || quote.id}`;
  const mapped = {
    id: str(quote.id),
    number: str(quote.number),
    title: str(quote.title),
    status: QUOTE_STATUSES.has(status) ? status : "draft",
    createdAt: businessDate(
      quote.createdAt,
      `Presupuesto ${quote.number || quote.id} (fecha de emisión)`,
    ),
    validUntil: businessDate(
      quote.validUntil,
      `Presupuesto ${quote.number || quote.id} (validez)`,
    ),
    client: {
      name: str(client.name),
      taxId: str(client.taxId),
      email: str(client.email),
      phone: str(client.phone),
      address: str(client.address),
    },
    vatRate: num(quote.vatRate, 0, `${where} (IVA)`),
    // Sin `commercialDiscount`: el estudio ya no hace descuentos comerciales, el
    // cálculo no lo lee y la auditoría lo marca como campo obsoleto.
    managementRate: num(quote.managementRate, 0, `${where} (gestión)`),
    accessDifficulty: accessDifficulty(quote.accessDifficulty),
    accessDifficultyAmount: num(quote.accessDifficultyAmount, 0, `${where} (dificultad de acceso)`),
    notes: str(quote.notes),
    lines: (quote.lines || []).map((line, index) =>
      mapQuoteLine(line, index, quote, catalogById),
    ),
  };

  if (quote.importMetadata) {
    mapped.importMetadata = mapImportMetadata(quote.importMetadata);
  }
  return mapped;
}

function mapRevitItem(item) {
  return {
    id: str(item.id) || str(item.code),
    row: num(item.row),
    code: normalizeRevitCode(item.code),
    nature: str(item.nature),
    unit: str(item.unit),
    name: str(item.name),
    quantity: num(item.quantity),
    chapterCode: str(item.chapterCode),
    chapterName: str(item.chapterName),
    occurrenceCount: num(item.occurrenceCount, 1),
    sourceRows: intList(item.sourceRows),
    conflict: Boolean(item.conflict),
    conflictReason: str(item.conflictReason),
  };
}

/** Mismo criterio que `docIdForRevitItem` del servicio: `/` no vale en un id. */
const revitItemDocId = (item) => String(item.id || item.code).replace(/\//g, "-");

/* ── Escritura por lotes ───────────────────────────────────────────────────── */

class Batcher {
  constructor(db) {
    this.db = db;
    this.batch = db.batch();
    this.pending = 0;
    this.writes = 0;
    this.deletes = 0;
  }

  async #maybeFlush() {
    if (this.pending < BATCH_LIMIT) return;
    await this.flush();
  }

  async set(ref, data) {
    if (DRY_RUN) {
      this.writes += 1;
      return;
    }
    this.batch.set(ref, data);
    this.pending += 1;
    this.writes += 1;
    await this.#maybeFlush();
  }

  async delete(ref) {
    // Los borrados se cuentan TAMBIÉN en simulación: si no, un --dry-run que
    // fuese a retirar medio catálogo maestro se leía exactamente igual que uno
    // que no borra nada, y el dry-run es justo la red de seguridad de esto.
    this.deletes += 1;
    if (DRY_RUN) return;
    this.batch.delete(ref);
    this.pending += 1;
    await this.#maybeFlush();
  }

  async flush() {
    if (DRY_RUN || this.pending === 0) return;
    await this.batch.commit();
    this.batch = this.db.batch();
    this.pending = 0;
  }
}

/* ── Migración ─────────────────────────────────────────────────────────────── */

function readBackup(file) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    console.error(`No existe el archivo: ${resolved}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    console.error(`El archivo no es un JSON válido: ${error.message}`);
    process.exit(1);
  }

  // La misma comprobación que hace ObraCost al restaurar una copia.
  if (
    !parsed ||
    !Array.isArray(parsed.catalog) ||
    !Array.isArray(parsed.suppliers) ||
    !Array.isArray(parsed.quotes)
  ) {
    console.error(
      "El archivo no tiene el formato de una copia de ObraCost (faltan catalog, suppliers o quotes).",
    );
    process.exit(1);
  }

  return { backup: parsed, resolved };
}

/** Documentos que ya están en la colección y no vienen en el backup. */
async function collectStale(collectionRef, keptIds) {
  const snap = await collectionRef.get();
  return snap.docs.filter((doc) => !keptIds.has(doc.id)).map((doc) => doc.ref);
}

async function main() {
  const { backup, resolved } = readBackup(backupPath);
  const db = getFirestore(initializeApp({ credential: cert(serviceAccount()) }));
  const batcher = new Batcher(db);

  console.log(`Backup: ${resolved}`);
  console.log(`Versión del backup: ${backup.version ?? "(sin versión)"}`);
  console.log(
    DRY_RUN
      ? "Modo SIMULACIÓN: no se va a escribir nada.\n"
      : `Escribiendo en Firestore${PRUNE ? " (con --prune: se borrará lo que no venga en el backup)" : ""}.\n`,
  );

  const source = {};
  const written = {};

  // 1 · Configuración de la empresa.
  await batcher.set(db.collection(COL_CONFIG).doc(DOC_COMPANY), mapCompany(backup.company));
  source.company = backup.company ? 1 : 0;
  written.company = 1;

  // 2 · Proveedores.
  const suppliers = backup.suppliers.map(mapSupplier).filter((supplier) => {
    if (supplier.id) return true;
    warn(`Proveedor «${supplier.name}» sin id: no se migra.`);
    return false;
  });
  for (const supplier of suppliers) {
    await batcher.set(db.collection(COL_SUPPLIERS).doc(supplier.id), supplier);
  }
  source.suppliers = backup.suppliers.length;
  written.suppliers = suppliers.length;

  // 3 · Catálogo de partidas.
  const catalog = backup.catalog.map(mapCatalogItem).filter((item) => {
    if (item.id) return true;
    warn(`Partida «${item.code} ${item.name}» sin id: no se migra.`);
    return false;
  });
  const supplierIds = new Set(suppliers.map((supplier) => supplier.id));
  for (const item of catalog) {
    if (item.supplierId && !supplierIds.has(item.supplierId)) {
      warn(
        `Partida ${item.code}: su proveedor ${item.supplierId} no está en el backup.`,
      );
    }
    await batcher.set(db.collection(COL_CATALOG).doc(item.id), item);
  }
  source.catalog = backup.catalog.length;
  written.catalog = catalog.length;

  // 4 · Presupuestos.
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const quotes = backup.quotes
    .map((quote) => mapQuote(quote, catalogById))
    .filter((quote) => {
      if (quote.id) return true;
      warn(`Presupuesto «${quote.number || quote.title}» sin id: no se migra.`);
      return false;
    });
  for (const quote of quotes) {
    await batcher.set(db.collection(COL_QUOTES).doc(quote.id), quote);
  }
  source.quotes = backup.quotes.length;
  written.quotes = quotes.length;

  // 5 · Equivalencias Revit (objeto código → equivalencia, no array).
  const importMappings = backup.importMappings || {};
  const mappingEntries = Object.entries(importMappings)
    .map(([code, mapping]) => ({
      code: normalizeRevitCode(code),
      itemId: str(mapping?.itemId),
      sourceName: str(mapping?.sourceName),
      sourceUnit: str(mapping?.sourceUnit),
      updatedAt: str(mapping?.updatedAt) || new Date().toISOString(),
    }))
    .filter((mapping) => {
      if (!mapping.code || !mapping.itemId) {
        warn(`Equivalencia «${mapping.code}» sin código o sin partida: no se migra.`);
        return false;
      }
      if (!catalogById.has(mapping.itemId)) {
        warn(
          `Equivalencia ${mapping.code}: apunta a la partida ${mapping.itemId}, que no está en el backup.`,
        );
      }
      return true;
    });
  for (const { code, ...mapping } of mappingEntries) {
    await batcher.set(db.collection(COL_MAPPINGS).doc(code), mapping);
  }
  source.mappings = Object.keys(importMappings).length;
  written.mappings = mappingEntries.length;

  // 6 · Catálogo maestro Revit (documento + subcolección `items`).
  //
  // ⚠️ Esta sección se SALTA si el backup no trae catálogo Revit. Antes se
  // ejecutaba siempre: sin `revitCatalog`, `keptRevitIds` quedaba vacío,
  // `collectStale` devolvía TODOS los conceptos ya cargados y se borraban,
  // además de sobrescribir el documento raíz con fileName "" y stats {}. Es
  // decir: migrar con un backup antiguo (readBackup solo exige catalog,
  // suppliers y quotes) hacía desaparecer en silencio un catálogo maestro
  // cargado desde la UI de /revit — justo lo contrario de lo que promete la
  // cabecera de este script («sin --prune la migración solo añade y actualiza»).
  const revitCatalog = backup.revitCatalog || {};
  const backupHasRevitCatalog =
    Array.isArray(revitCatalog.items) && revitCatalog.items.length > 0;
  const revitCatalogRef = db.collection(COL_REVIT).doc(DOC_REVIT_CATALOG);
  const revitItemsRef = revitCatalogRef.collection(SUB_REVIT_ITEMS);

  if (!backupHasRevitCatalog) {
    warn(
      "El backup no trae catálogo maestro Revit: se deja intacto el que haya en Firestore. Si querías vaciarlo, hazlo desde la pantalla de Revit.",
    );
    source.revitItems = 0;
    written.revitItems = 0;
  } else {
    const revitItems = revitCatalog.items.map(mapRevitItem).filter((item) => {
      if (item.id || item.code) return true;
      warn("Concepto Revit sin id ni código: no se migra.");
      return false;
    });

    // El catálogo maestro es un snapshot: recargarlo SUSTITUYE. Lo que ya no
    // está en el backup se retira aunque no se haya pedido `--prune`.
    const keptRevitIds = new Set(revitItems.map(revitItemDocId));
    const staleRevitRefs = await collectStale(revitItemsRef, keptRevitIds);
    if (staleRevitRefs.length > 0) {
      warn(
        `Catálogo maestro Revit: ${staleRevitRefs.length} conceptos que ya no vienen en el backup se van a retirar.`,
      );
    }
    // Primero se escribe y luego se borra, igual que en el servicio del admin:
    // si cae la red a mitad, sobran conceptos viejos en vez de faltar los
    // nuevos, y el estado intermedio no engaña.
    for (const item of revitItems) {
      await batcher.set(revitItemsRef.doc(revitItemDocId(item)), item);
    }
    for (const ref of staleRevitRefs) await batcher.delete(ref);
    await batcher.set(revitCatalogRef, {
      fileName: str(revitCatalog.fileName),
      updatedAt: str(revitCatalog.updatedAt),
      stats: { ...(revitCatalog.stats || {}) },
    });
    source.revitItems = revitCatalog.items.length;
    written.revitItems = revitItems.length;
  }

  // 7 · Contador de numeración.
  const computed = highestSequenceByYear(quotes.map((quote) => quote.number));
  for (const quote of quotes) {
    if (quote.number && !parseQuoteNumber(quote.number)) {
      warn(
        `Presupuesto ${quote.id}: el número «${quote.number}» no sigue el formato P-YYYY-NNN y no cuenta para el contador.`,
      );
    }
  }
  const countersRef = db.collection(COL_CONFIG).doc(DOC_COUNTERS);
  const existingCounters = (await countersRef.get()).data() || {};
  const counters = { ...existingCounters };
  for (const [year, sequence] of Object.entries(computed)) {
    // Nunca se baja un contador: repartir un número ya emitido sería peor que
    // dejar un hueco en la numeración.
    counters[year] = Math.max(num(existingCounters[year]), sequence);
  }
  await batcher.set(countersRef, counters);

  await batcher.flush();

  /* ── Informe ─────────────────────────────────────────────────────────────── */

  const destination = DRY_RUN
    ? null
    : {
        suppliers: (await db.collection(COL_SUPPLIERS).get()).size,
        catalog: (await db.collection(COL_CATALOG).get()).size,
        quotes: (await db.collection(COL_QUOTES).get()).size,
        mappings: (await db.collection(COL_MAPPINGS).get()).size,
        revitItems: (await revitItemsRef.get()).size,
      };

  // `--prune` se aplica al final, cuando ya se sabe qué se ha escrito.
  if (PRUNE && !DRY_RUN) {
    const pruner = new Batcher(db);
    const targets = [
      [db.collection(COL_SUPPLIERS), new Set(suppliers.map((s) => s.id))],
      [db.collection(COL_CATALOG), new Set(catalog.map((i) => i.id))],
      [db.collection(COL_QUOTES), new Set(quotes.map((q) => q.id))],
      [db.collection(COL_MAPPINGS), new Set(mappingEntries.map((m) => m.code))],
    ];
    let pruned = 0;
    for (const [collectionRef, keptIds] of targets) {
      const stale = await collectStale(collectionRef, keptIds);
      for (const ref of stale) await pruner.delete(ref);
      pruned += stale.length;
    }
    await pruner.flush();
    console.log(`Purgados ${pruned} documentos que no venían en el backup.\n`);
    batcher.deletes += pruner.deletes;
    if (destination) {
      destination.suppliers = (await db.collection(COL_SUPPLIERS).get()).size;
      destination.catalog = (await db.collection(COL_CATALOG).get()).size;
      destination.quotes = (await db.collection(COL_QUOTES).get()).size;
      destination.mappings = (await db.collection(COL_MAPPINGS).get()).size;
    }
  }

  const rows = [
    ["presupuestos_config/company", source.company, written.company, DRY_RUN ? "" : 1],
    ["presupuestos_suppliers", source.suppliers, written.suppliers, destination?.suppliers],
    ["presupuestos_catalog", source.catalog, written.catalog, destination?.catalog],
    ["presupuestos_quotes", source.quotes, written.quotes, destination?.quotes],
    ["presupuestos_revit_mappings", source.mappings, written.mappings, destination?.mappings],
    ["presupuestos_revit/catalog/items", source.revitItems, written.revitItems, destination?.revitItems],
  ];

  const pad = (value, width) => String(value ?? "—").padStart(width);
  console.log("Colección                            origen  escritos  destino");
  for (const [name, from, wrote, to] of rows) {
    console.log(`${name.padEnd(35)}${pad(from, 6)}${pad(wrote, 10)}${pad(to, 9)}`);
  }

  const lines = quotes.reduce((total, quote) => total + quote.lines.length, 0);
  console.log(`\nLíneas de presupuesto migradas: ${lines}`);
  // Los borrados se enseñan siempre, también en simulación: es el número que
  // hay que mirar antes de dar el paso sin --dry-run.
  console.log(
    `Documentos que se ${DRY_RUN ? "borrarían" : "han borrado"}: ${batcher.deletes}`,
  );
  console.log(
    `Contador de numeración: ${Object.entries(counters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, sequence]) => `${year}: ${sequence}`)
      .join(", ") || "(sin presupuestos numerados)"}`,
  );

  if (warnings.length) {
    console.log(`\n${warnings.length} aviso(s):`);
    for (const message of warnings) console.log(`  · ${message}`);
  } else {
    console.log("\nSin avisos.");
  }

  const mismatches = rows.filter(
    ([, from, wrote, to]) => to !== undefined && to !== null && (to !== wrote || wrote !== from),
  );
  if (!DRY_RUN && mismatches.length) {
    console.log(
      "\n⚠️  Hay conteos que no cuadran (origen ≠ escritos ≠ destino). Si el destino es mayor,",
      "quedan documentos de una migración anterior: vuelve a ejecutar con --prune.",
    );
  }

  console.log(
    DRY_RUN
      ? "\nSimulación terminada: no se ha escrito nada."
      : "\nMigración terminada.",
  );
  process.exit(0);
}

await main();
