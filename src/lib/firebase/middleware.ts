import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./config";

/**
 * Proxy de protección de rutas (gating de sesión).
 *
 * Aquí solo se comprueba la PRESENCIA de la cookie de sesión (gating de
 * invitado). La verificación criptográfica real y el control de rol se hacen
 * en cada página de servidor mediante getUserProfile() (Admin SDK).
 *
 * Nota: en Next 16 el proxy corre en Node.js por defecto, así que el Admin
 * SDK SÍ podría usarse aquí; se mantiene la verificación por página como
 * única fuente de verdad y este nivel como cortafuegos barato por petición.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isDashboardRoute = path.startsWith("/dashboard");
  const isLegacyAdminRoute = path.startsWith("/admin");
  const isLoginRoute = path === "/login";

  // El rol se verifica a nivel de página con el Admin SDK.
  const isAuthenticated = !!request.cookies.get(SESSION_COOKIE)?.value;

  // 1. La consola de administración vive en DLX Admin (módulo Obras); la
  //    antigua ruta /admin del portal redirige al dashboard de cliente.
  if (isLegacyAdminRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 2. Invitado intentando entrar a zona privada → login
  if (!isAuthenticated && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // 3. Ya autenticado yendo a /login → dashboard
  if (isAuthenticated && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
