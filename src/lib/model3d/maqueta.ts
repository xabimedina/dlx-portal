/**
 * De los documentos de la maqueta (ya firmados) a lo que pinta el visor.
 * Puro: sin Firebase ni three (los tipos del visor se importan solo como tipos).
 */
import type { ImagenVisor } from "@/lib/visor3d/visor";
import type { PortalModel3dImagen, PortalModel3dVersion } from "@/types/portal";
import { formatDateEs } from "@/lib/format-date-es";

export function imagenesParaVisor(
  imagenes: ReadonlyArray<PortalModel3dImagen & { url: string; thumb_url: string }>,
): ImagenVisor[] {
  return imagenes.map((i) => ({
    id: i.id,
    estado: i.estado,
    estancia: i.estancia_id,
    camara: i.camara_id,
    tipo: i.tipo,
    n: i.orden,
    titulo: i.titulo,
    url: i.url,
    thumbUrl: i.thumb_url,
  }));
}

/**
 * Lo que lee el cliente bajo «Tu maqueta». La maqueta está desde el inicio de
 * la obra y se va actualizando: le importa cuándo se actualizó, no el número
 * de versión (que es cosa del estudio).
 */
export function etiquetaVersion(v: Pick<PortalModel3dVersion, "published_at" | "created_at">): string {
  const fecha = formatDateEs(diaEnMadrid(v.published_at ?? v.created_at));
  return fecha ? `Actualizada el ${fecha}` : "";
}

/**
 * «YYYY-MM-DD» del instante en la hora de España: publicar a las 00:30 del día
 * 11 es el 11, aunque en UTC aún sea el 10. Se calcula en el servidor y viaja
 * como texto, así que no hay desajuste de hidratación.
 */
function diaEnMadrid(iso: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;
  // en-CA da el formato «YYYY-MM-DD»
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
}
