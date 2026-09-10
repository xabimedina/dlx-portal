"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./config";

/**
 * Crea la cookie de sesión a partir del ID token que el navegador obtiene tras
 * iniciar sesión con Firebase Auth. La cookie se verifica luego en el servidor
 * (ver getUserProfile en ./profile). Dura 5 días.
 */
export async function establishSession(idToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { adminAuth } = await import("./admin");
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 días en ms
    const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return { ok: true };
  } catch (error: any) {
    console.error("Error creando la cookie de sesión de Firebase:", error);
    return { ok: false, error: "No se pudo establecer la sesión." };
  }
}

/**
 * Cierra la sesión: borra la cookie. (El logout del SDK de cliente se hace
 * aparte en el botón de cerrar sesión.)
 */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
