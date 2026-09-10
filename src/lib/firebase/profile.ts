import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./config";

export interface Profile {
  id: string;
  full_name: string;
  /** Email de la sesión, normalizado a minúsculas: es la credencial con la
   *  que se compara portal_projects.authorized_emails. */
  email: string;
  role: "admin" | "client";
  /** Si Firebase garantiza que el email pertenece al usuario. El acceso por
   *  email link siempre lo deja en true; una cuenta de contraseña creada con
   *  el email de otra persona, no. TODA autorización de cliente lo exige. */
  email_verified: boolean;
  created_at: string;
}

/**
 * Obtiene el perfil del usuario autenticado verificando la cookie de sesión
 * con el Admin SDK de Firebase. El rol sale SOLO de los custom claims
 * (claims-only): el staff lleva role='admin'; cualquier otra sesión es un
 * cliente, cuya autorización real se resuelve después por email contra
 * authorized_emails.
 */
export async function getUserProfile(): Promise<Profile | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;

    // Importación diferida para que el Admin SDK no entre en bundles del cliente
    const { adminAuth } = await import("./admin");

    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    const email = (decoded.email || "").toLowerCase();

    return {
      id: decoded.uid,
      full_name: (decoded.name as string | undefined) || email.split("@")[0] || "Cliente",
      email,
      role: decoded.role === "admin" ? "admin" : "client",
      email_verified: decoded.email_verified === true,
      created_at: new Date(decoded.auth_time * 1000).toISOString(),
    };
  } catch (error) {
    console.error("Error verificando la sesión de Firebase:", error);
    return null;
  }
}
