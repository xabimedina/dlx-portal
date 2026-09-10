/**
 * Configuración pública del cliente Firebase (segura para el navegador).
 * Estos valores NO son secretos; el blindaje real lo dan las Security Rules.
 * El portal opera SIEMPRE contra el proyecto real (el antiguo modo demo con
 * datos simulados se eliminó cuando el entorno de pruebas pasó a Firestore).
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

/** Nombre de la cookie de sesión (compatible con Firebase Hosting / Vercel). */
export const SESSION_COOKIE = "__session";

/**
 * Colecciones de Firestore del portal, con prefijo `portal_` para convivir en
 * el MISMO proyecto Firebase que el resto del ecosistema DLX sin chocar con
 * las colecciones ya existentes: `projects` (portfolio de dlx-web/dlx-admin),
 * `users` y `results` (calculadora), `blog` (dlx-blog) y `web` (textos).
 */
export const COL_USERS = "portal_users";
export const COL_CLIENTS = "portal_clients";
export const COL_PROJECTS = "portal_projects";

/**
 * Raíz de Storage del portal. dlx-admin sube las imágenes del portfolio a
 * `projects/images/...`, así que el portal usa su propio prefijo `portal/`.
 */
export const STORAGE_ROOT = "portal/projects";

/** Buckets/carpetas lógicas dentro de Firebase Storage. */
export const STORAGE_DOCS = "project-documents";
export const STORAGE_IMAGES = "project-images";
