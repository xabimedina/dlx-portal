#!/usr/bin/env node
/**
 * Datos de prueba del módulo «Presupuestos» de dlx-admin.
 *
 * Siembra configuración de empresa, proveedores y una base de precios con
 * partidas en los 16 capítulos estándar, para poder recorrer el módulo entero
 * (catálogo → presupuesto → emisión → PDF → pedidos a proveedor) antes de tener
 * el backup real de ObraCost.
 *
 * Uso (desde dlx-portal-main, que es donde viven las credenciales del Admin SDK):
 *
 *   node --env-file=.env.local scripts/seed-presupuestos-demo.mjs
 *   node --env-file=.env.local scripts/seed-presupuestos-demo.mjs --clean
 *
 * TODO lo que escribe lleva ids con prefijo `seed-`, así que `--clean` lo quita
 * sin tocar nada más: si algún día conviven con datos reales, no se mezclan.
 *
 * ⚠️ Escribe con el Admin SDK, que se salta las reglas de seguridad. Es datos
 * de prueba en el proyecto real: por eso no borra nada que no haya puesto él.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const COL_CONFIG = "presupuestos_config";
const COL_SUPPLIERS = "presupuestos_suppliers";
const COL_CATALOG = "presupuestos_catalog";
const DOC_COMPANY = "company";

const CLEAN = process.argv.includes("--clean");

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error(
      "Falta FIREBASE_SERVICE_ACCOUNT_KEY. Ejecuta con --env-file=.env.local desde dlx-portal-main.",
    );
    process.exit(1);
  }
  const parsed = JSON.parse(raw);
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

initializeApp({ credential: cert(serviceAccount()) });
const db = getFirestore();

/* ── Empresa ───────────────────────────────────────────────────────────────── */

const company = {
  name: "Despeja la X",
  taxId: "B-98765432",
  address: "Carrer de Sant Vicent Màrtir, 120",
  city: "46007 Valencia",
  phone: "+34 963 000 000",
  email: "hola@despejalax.com",
  // Fracciones 0–1, como manda la convención 2 del módulo.
  defaultVat: 0.21,
  defaultManagementRate: 0.04,
  defaultValidityDays: 30,
  paymentTerms:
    "40 % a la firma, 40 % al inicio de instalaciones y 20 % a la entrega de la obra.",
  quoteFooter:
    "Presupuesto sujeto a medición final y a la disponibilidad de materiales. No incluye licencias ni tasas municipales salvo indicación expresa.",
};

/* ── Proveedores ───────────────────────────────────────────────────────────── */

const suppliers = [
  {
    id: "seed-obra-general",
    name: "Obra general",
    contact: "Equipo propio",
    email: "obra@despejalax.com",
    phone: "+34 600 100 100",
    defaultDiscount: 0.2,
    surcharge: 0,
    color: "#50514f",
    notes: "Mano de obra propia y subcontratas habituales de albañilería.",
  },
  {
    id: "seed-stolanic",
    name: "Stolanic Baños",
    contact: "Marta Ferrer",
    email: "pedidos@stolanic.example",
    phone: "+34 963 111 111",
    defaultDiscount: 0.35,
    surcharge: 0.02,
    color: "#2563eb",
    notes: "Sanitarios y griferías. El 2 % de recargo es el porte.",
  },
  {
    id: "seed-cocinas-levante",
    name: "Cocinas Levante",
    contact: "Jordi Peris",
    email: "comercial@cocinaslevante.example",
    phone: "+34 963 222 222",
    defaultDiscount: 0.4,
    surcharge: 0,
    color: "#16a34a",
    notes: "Mobiliario, encimeras y electrodomésticos.",
  },
  {
    id: "seed-clima-turia",
    name: "Clima Turia",
    contact: "Nuria Blasco",
    email: "info@climaturia.example",
    phone: "+34 963 333 333",
    defaultDiscount: 0.28,
    surcharge: 0.03,
    color: "#ea580c",
    notes: "Climatización, calefacción y ventilación.",
  },
];

/* ── Base de precios ───────────────────────────────────────────────────────── */

/**
 * `listPrice` es la tarifa del proveedor (antes de descuento) y `salePrice` lo
 * que se le cobra al cliente ANTES de la gestión: la gestión la añade el
 * cálculo dentro del precio, no se teclea aquí.
 */
const item = (n, code, category, name, unit, listPrice, salePrice, supplierId, extra = {}) => ({
  id: `seed-item-${String(n).padStart(3, "0")}`,
  code,
  category,
  name,
  description: extra.description ?? "",
  unit,
  listPrice,
  salePrice,
  supplierId,
  discountOverride: extra.discountOverride ?? null,
  surchargeOverride: extra.surchargeOverride ?? null,
  active: extra.active ?? true,
});

const G = "seed-obra-general";
const S = "seed-stolanic";
const K = "seed-cocinas-levante";
const C = "seed-clima-turia";

const catalog = [
  item(1, "PRE-01", "C01 TRABAJOS PREVIOS", "Demolición de tabiquería existente", "m2", 12.5, 24, G, {
    description: "Incluye carga manual a contenedor y limpieza de la zona.",
  }),
  item(2, "PRE-02", "C01 TRABAJOS PREVIOS", "Retirada de aparatos sanitarios", "ud", 28, 55, G),
  item(3, "PRE-03", "C01 TRABAJOS PREVIOS", "Protección de suelos y mobiliario", "m2", 4.2, 8.5, G),

  item(10, "ALB-01", "C02 ALBAÑILERÍA", "Tabique de pladur 13+46+13 con aislamiento", "m2", 26, 52, G, {
    description: "Placa estándar a dos caras, lana mineral de 45 mm y montantes de 46 mm.",
  }),
  item(11, "ALB-02", "C02 ALBAÑILERÍA", "Recibido de cercos y premarcos", "ud", 34, 68, G),
  item(12, "ALB-03", "C02 ALBAÑILERÍA", "Regularización de suelo con mortero autonivelante", "m2", 14.8, 29, G),

  item(20, "REV-01", "C03 REVESTIMIENTOS Y FALSOS TECHOS", "Alicatado de porcelánico gran formato", "m2", 31, 62, G),
  item(21, "REV-02", "C03 REVESTIMIENTOS Y FALSOS TECHOS", "Falso techo continuo de pladur", "m2", 22.5, 45, G),
  item(22, "REV-03", "C03 REVESTIMIENTOS Y FALSOS TECHOS", "Pintura plástica lisa, dos manos", "m2", 6.4, 13, G),

  item(30, "FON-01", "C04 INSTALACIÓN DE FONTANERÍA", "Instalación completa de baño", "ud", 640, 1280, S),
  item(31, "FON-02", "C04 INSTALACIÓN DE FONTANERÍA", "Punto de agua fría y caliente", "ud", 78, 155, S),

  item(40, "ELE-01", "C05 INSTALACIÓN DE ELECTRICIDAD", "Punto de luz o toma de corriente", "ud", 42, 84, G),
  item(41, "ELE-02", "C05 INSTALACIÓN DE ELECTRICIDAD", "Cuadro eléctrico con certificado de instalación", "ud", 480, 950, G, {
    description: "Incluye boletín y tramitación con la distribuidora.",
  }),

  item(50, "CLI-01", "C06 INSTALACIÓN DE CLIMATIZACIÓN", "Conductos y rejillas por estancia", "ud", 310, 620, C),
  item(51, "CLI-02", "C06 INSTALACIÓN DE CLIMATIZACIÓN", "Equipo interior de conductos 5.000 frig.", "ud", 1450, 2600, C, {
    // Este proveedor tiene un 28 % general, pero esta gama va al 32 %.
    discountOverride: 0.32,
  }),

  item(60, "CAL-01", "C07 INSTALACIÓN DE CALEFACCIÓN", "Radiador de aluminio, montaje incluido", "ud", 185, 360, C),

  item(70, "CEX-01", "C08 CARPINTERÍA EXTERIOR", "Ventana de aluminio RPT con vidrio bajo emisivo", "m2", 260, 495, G),

  item(80, "CMA-01", "C09 CARPINTERÍA DE MADERA", "Puerta de paso lacada con herrajes", "ud", 195, 385, G),
  item(81, "CMA-02", "C09 CARPINTERÍA DE MADERA", "Frente de armario empotrado con interior", "ml", 430, 860, K),

  item(90, "BAN-01", "C10 BAÑO, SANITARIOS Y GRIFERÍAS", "Plato de ducha de resina a medida", "ud", 340, 620, S),
  item(91, "BAN-02", "C10 BAÑO, SANITARIOS Y GRIFERÍAS", "Inodoro suspendido con cisterna empotrada", "ud", 520, 940, S),
  item(92, "BAN-03", "C10 BAÑO, SANITARIOS Y GRIFERÍAS", "Mampara de ducha fija de 8 mm", "ud", 395, 720, S, {
    // Porte especial por dimensión: sube el recargo del proveedor.
    surchargeOverride: 0.06,
  }),

  item(100, "COC-01", "C11 COCINA · MOBILIARIO", "Muebles altos y bajos, acabado laminado", "ml", 520, 980, K, {
    description: "Herrajes con cierre amortiguado y zócalo de aluminio.",
  }),
  item(101, "COC-02", "C11 COCINA · ENCIMERA", "Encimera de cuarzo compacto de 20 mm", "ml", 340, 640, K),
  item(102, "COC-03", "C11 COCINA · MONTAJE", "Montaje y ajuste de cocina completa", "PA", 480, 950, K),

  item(110, "ELX-01", "C12 ELECTRODOMÉSTICOS", "Placa de inducción de tres zonas", "ud", 410, 760, K),
  item(111, "ELX-02", "C12 ELECTRODOMÉSTICOS", "Horno multifunción pirolítico", "ud", 445, 820, K),

  item(120, "RES-01", "C13 GESTIÓN DE RESIDUOS", "Contenedor de escombros con retirada", "ud", 180, 340, G),

  item(130, "LIM-01", "C14 LIMPIEZA", "Limpieza de fin de obra", "PA", 320, 620, G),

  item(140, "LIC-01", "C15 TRAMITACIÓN DE LICENCIA", "Proyecto técnico y licencia de obra", "PA", 950, 1850, G),

  item(150, "ADI-01", "C16 ADICIONALES", "Ayudas de albañilería a instalaciones", "h", 22, 42, G),
  item(151, "ADI-02", "C16 ADICIONALES", "Partida antigua sin uso (archivada)", "ud", 100, 200, G, {
    // Para poder probar el filtro «Ver archivadas» del catálogo.
    active: false,
  }),
];

/* ── Ejecución ─────────────────────────────────────────────────────────────── */

async function removeSeed() {
  let removed = 0;
  const batch = db.batch();
  for (const supplier of suppliers) {
    batch.delete(db.collection(COL_SUPPLIERS).doc(supplier.id));
    removed += 1;
  }
  for (const entry of catalog) {
    batch.delete(db.collection(COL_CATALOG).doc(entry.id));
    removed += 1;
  }
  await batch.commit();
  console.log(`Retirados ${removed} documentos de prueba (proveedores y partidas).`);
  console.log(
    "La configuración de empresa NO se borra: si la has retocado, es tuya.",
  );
}

async function writeSeed() {
  const batch = db.batch();
  batch.set(db.collection(COL_CONFIG).doc(DOC_COMPANY), company);
  for (const supplier of suppliers) {
    batch.set(db.collection(COL_SUPPLIERS).doc(supplier.id), supplier);
  }
  for (const entry of catalog) {
    batch.set(db.collection(COL_CATALOG).doc(entry.id), entry);
  }
  await batch.commit();

  const chapters = new Set(catalog.map((entry) => entry.category.slice(0, 3)));
  console.log("Sembrado:");
  console.log(`  configuración de empresa      1`);
  console.log(`  proveedores                   ${suppliers.length}`);
  console.log(
    `  partidas                     ${catalog.length}  (${catalog.filter((i) => i.active).length} activas, en ${chapters.size} capítulos)`,
  );
  console.log("\nTodo lleva ids `seed-`; para quitarlo: --clean");
}

await (CLEAN ? removeSeed() : writeSeed());
process.exit(0);
