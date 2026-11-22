/** Nombre de la cookie con la versión vista de una pieza (compartido por servidor y cliente). */
export function novedadCookie(id: string): string {
  return `dlx-visto-${id.replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;
}
