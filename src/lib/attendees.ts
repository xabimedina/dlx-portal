/**
 * Extrae solo el gremio / tipo de industrial de la lista de asistentes de un
 * parte, ocultando los nombres propios al cliente. Así, si la persona cambia
 * a lo largo de la obra, no hay que actualizar nada de cara al cliente.
 *
 * Acepta los dos formatos que se usan al escribir el parte:
 *  - «Nombre · gremio» separados por comas:
 *      "Xabi Medina · estudio, Juan Ramos · fontanería" → ["Estudio", "Fontanería"]
 *  - solo gremios separados por «·» (lo que sugiere el campo del panel):
 *      "Fontanería · Electricidad" → ["Fontanería", "Electricidad"]
 * Un nombre propio suelto («Juan Ramos») no se enseña.
 */

// Palabras de enlace que pueden ir en minúscula dentro de un nombre propio
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "van", "von"]);

/** ¿Parece un nombre de persona? Dos o más palabras, todas con mayúscula inicial salvo los enlaces. */
function pareceNombre(texto: string): boolean {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length < 2) return false;
  return palabras.every((p) => CONECTORES.has(p.toLowerCase()) || /^\p{Lu}/u.test(p));
}

const capitalizar = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

export function gremiosDeAsistentes(attendees?: string | null): string[] {
  if (!attendees) return [];
  const roles = attendees.split(",").flatMap((entrada) => {
    const partes = entrada.split("·").map((p) => p.trim()).filter(Boolean);
    if (partes.length === 0) return [];
    if (partes.length === 1) return pareceNombre(partes[0]) ? [] : [partes[0]];
    // «Nombre · gremio»: la primera parte es una persona y el resto, su gremio
    if (pareceNombre(partes[0])) return partes.slice(1).filter((p) => !pareceNombre(p));
    // «Gremio · gremio»: todas son gremios
    return partes.filter((p) => !pareceNombre(p));
  });
  return Array.from(new Set(roles.map(capitalizar)));
}
