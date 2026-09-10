#!/usr/bin/env node
/**
 * Asigna (o quita) el custom claim de rol a una cuenta de Firebase Auth del
 * proyecto compartido DLX. Las reglas de seguridad y la puerta de acceso de
 * dlx-admin exigen role=='admin' en las cuentas de staff.
 *
 * Uso (desde dlx-portal-main, que ya tiene las credenciales en .env.local):
 *   node --env-file=.env.local scripts/set-admin-claim.mjs correo@dominio.com admin
 *   node --env-file=.env.local scripts/set-admin-claim.mjs correo@dominio.com client
 *   node --env-file=.env.local scripts/set-admin-claim.mjs correo@dominio.com none
 *
 * Tras cambiar el claim, el usuario debe cerrar sesión y volver a entrar
 * (o esperar ~1 h a que caduque su token) para que el cambio tenga efecto.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, role = "admin"] = process.argv.slice(2);
const VALID_ROLES = ["admin", "client", "none"];

if (!email || !email.includes("@") || !VALID_ROLES.includes(role)) {
  console.error("Uso: node --env-file=.env.local scripts/set-admin-claim.mjs <email> [admin|client|none]");
  process.exit(1);
}

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = JSON.parse(raw.replace(/\\n/g, "\n"));
    }
    // Si el pegado escapó dos veces los saltos de línea, la clave llega con
    // "\n" literales y OpenSSL la rechaza; una clave correcta nunca los tiene.
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
    "Faltan credenciales del Admin SDK: define FIREBASE_SERVICE_ACCOUNT_KEY o PRIVATE_KEY + CLIENT_EMAIL (ver .env.example)."
  );
  process.exit(1);
}

const app = initializeApp({ credential: cert(serviceAccount()) });
const auth = getAuth(app);

const user = await auth.getUserByEmail(email.trim().toLowerCase());
const claims = { ...user.customClaims };
if (role === "none") {
  delete claims.role;
} else {
  claims.role = role;
}
await auth.setCustomUserClaims(user.uid, claims);

console.log(`Listo: ${email} (uid ${user.uid}) → claims ${JSON.stringify(claims)}`);
console.log("Recuerda: el usuario debe cerrar sesión y volver a entrar para que el token recoja el cambio.");
