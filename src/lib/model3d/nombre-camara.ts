/**
 * Asignación de fotos y renders por nombre de archivo = nombre de la cámara
 * de Revit: `WEB_<estancia>_<nn>.jpg` rellena estancia y cámara al subir.
 *
 * COPIA IDÉNTICA en dlx-admin-main/src/lib/model3d/ y dlx-portal-main/src/lib/model3d/
 * (con su test): cambiar las dos a la vez.
 */

export interface NombreCamara {
  /** Id de estancia (WEB_ID), en minúsculas */
  estancia: string;
  n: number;
  /** «WEB_<estancia>_<nn>» con el número tal cual venía */
  camaraId: string;
  /** Algo que conviene revisar (sufijo de copia, espacios…) o null */
  aviso: string | null;
}

// WEB + separador + estancia + separador + número + sufijo opcional que empieza
// por espacio, «(» o «-» («WEB_salon_01 (2)», «WEB_salon_01 - copia»).
const PATRON = /^web[_\s]+(.+)[_\s]+(\d{1,3})((?:[\s(-].*)?)$/i;
const EXTENSION = /\.[a-z0-9]{2,5}$/i;

export function parseNombreCamara(fichero: string): NombreCamara | null {
  const base = fichero.trim().replace(EXTENSION, "").trim();
  const m = PATRON.exec(base);
  if (!m) return null;
  const estancia = m[1].trim().toLowerCase().replace(/\s+/g, "-");
  if (!estancia || /^[_\s-]+$/.test(estancia)) return null;
  const numero = m[2];
  const sufijo = m[3].trim();
  const camaraId = `WEB_${estancia}_${numero}`;
  const aviso = sufijo
    ? `El nombre lleva «${sufijo.replace(/^-\s*/, "")}» detrás del número: se asigna a ${camaraId}.`
    : m[1].trim() !== m[1].trim().replace(/\s+/g, "")
      ? `El nombre lleva espacios: se asigna a ${camaraId}.`
      : null;
  return { estancia, n: Number(numero), camaraId, aviso };
}

/**
 * La cámara de la versión a la que corresponde un nombre ya leído: por id sin
 * distinguir mayúsculas y, si no, por estancia y número («_1» = «_01»).
 */
export function buscarCamara<T extends { id: string }>(nombre: NombreCamara, camaras: readonly T[]): T | null {
  const id = nombre.camaraId.toLowerCase();
  const exacta = camaras.find((c) => c.id.toLowerCase() === id);
  if (exacta) return exacta;
  return (
    camaras.find((c) => {
      const otra = parseNombreCamara(c.id);
      return otra !== null && otra.estancia === nombre.estancia && otra.n === nombre.n;
    }) ?? null
  );
}
