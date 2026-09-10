/**
 * Extrae solo el gremio / tipo de industrial de la lista de asistentes de un
 * parte, ocultando los nombres propios al cliente. Así, si la persona cambia
 * a lo largo de la obra, no hay que actualizar nada de cara al cliente.
 * Entrada: "Xabi Medina · estudio, Juan Ramos · fontanería"
 * Salida:  ["Estudio", "Fontanería"]
 */
export function gremiosDeAsistentes(attendees?: string | null): string[] {
  if (!attendees) return [];
  const roles = attendees
    .split(",")
    .map((a) => {
      const parts = a.split("·");
      return (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
    })
    .filter(Boolean)
    .map((r) => r.charAt(0).toUpperCase() + r.slice(1));
  return Array.from(new Set(roles));
}
