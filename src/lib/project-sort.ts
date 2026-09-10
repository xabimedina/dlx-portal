/**
 * Orden de presentación de los proyectos de un cliente en su dashboard:
 * primero los activos, y dentro de cada grupo los más recientes.
 * Módulo puro para poder probarlo con vitest.
 */
export function sortClientProjects<T extends { status?: string; created_at?: string }>(
  projects: T[]
): T[] {
  return [...projects].sort((a, b) => {
    const activeA = a.status === "Activo" ? 0 : 1;
    const activeB = b.status === "Activo" ? 0 : 1;
    if (activeA !== activeB) return activeA - activeB;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}
