import "server-only";
import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Admin SDK de Firebase para el SERVIDOR (verificación de sesión, lectura/escritura
 * privilegiada de Firestore, generación de URLs firmadas de Storage).
 *
 * Credenciales (dos formatos admitidos, SECRETOS: nunca en el código):
 *  - FIREBASE_SERVICE_ACCOUNT_KEY: el JSON completo de la cuenta de servicio
 *    (Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada).
 *  - PRIVATE_KEY + CLIENT_EMAIL: el formato que ya usa dlx-web, por si quieres
 *    reutilizar exactamente las mismas variables de entorno en el hosting.
 */
let adminApp: App | null = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    // Alternativa: mismas variables que usa dlx-web (PRIVATE_KEY + CLIENT_EMAIL),
    // para poder reutilizar la configuración de despliegue ya existente.
    const privateKey = process.env.PRIVATE_KEY;
    const clientEmail = process.env.CLIENT_EMAIL;
    if (privateKey && clientEmail) {
      return {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        clientEmail,
      };
    }
    throw new Error(
      "Faltan credenciales del Admin SDK. Define FIREBASE_SERVICE_ACCOUNT_KEY (JSON completo) o bien PRIVATE_KEY + CLIENT_EMAIL (como en dlx-web)."
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Algunos hosts escapan los saltos de línea de la clave privada
    return JSON.parse(raw.replace(/\\n/g, "\n"));
  }
}

export function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length) {
      adminApp = getApp();
    } else {
      const sa = getServiceAccount();
      adminApp = initializeApp({
        credential: cert(sa),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    }
  }
  return adminApp;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function adminBucket() {
  return getStorage(getAdminApp()).bucket();
}
