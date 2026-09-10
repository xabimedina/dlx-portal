import { STORAGE_ROOT } from "./config";

/**
 * Extrae el projectId de una ruta de Storage del portal. Solo se admite el
 * formato canónico portal/projects/{projectId}/...: así el archivo que se
 * firma queda garantizado dentro de la carpeta del proyecto cuya propiedad
 * se valida después (sin rutas arbitrarias fuera del árbol del portal).
 *
 * Módulo puro (sin server-only) para poder probarlo con vitest; lo consume
 * la server action de descargas firmadas.
 */
export function extractProjectIdFromPath(path: string): string | null {
  const prefix = `${STORAGE_ROOT}/`;
  if (!path.startsWith(prefix)) return null;
  const projectId = path.slice(prefix.length).split("/")[0];
  return projectId || null;
}
