import "server-only";
import type { ImagenVisor } from "@/lib/visor3d/visor";
import { validarModeloWeb, type ModeloWeb } from "@/lib/model3d/validar-modelo-web";
import { etiquetaVersion, imagenesParaVisor } from "@/lib/model3d/maqueta";
import { getModel3dImages, getModel3dPublished } from "./db";
import { withSignedModel3dUrls } from "./storage-urls";

/** Lo que necesita la sección «Tu maqueta» del cliente (serializable) */
export interface MaquetaPublicada {
  etiqueta: string;
  datos: ModeloWeb;
  /** Al principio de la obra solo hay conservado */
  modelos: { conservado: string; demolido?: string; nuevo?: string };
  imagenes: ImagenVisor[];
}

/**
 * La maqueta publicada de una obra, lista para el visor: el modelo_web.json se
 * lee y valida aquí (Admin SDK), y las capas y las imágenes van firmadas.
 * Sin versión publicada, o con un JSON que no valida, devuelve null y la
 * página sigue como si no hubiera maqueta (el error queda en el log).
 * El acceso a la obra lo comprueba la página antes de llamar.
 */
export async function cargarMaquetaPublicada(projectId: string): Promise<MaquetaPublicada | null> {
  const version = await getModel3dPublished(projectId);
  if (!version) return null;

  const { adminBucket } = await import("./admin");
  const [imagenes, [contenido]] = await Promise.all([
    getModel3dImages(projectId),
    adminBucket().file(version.modelo_web_path).download(),
  ]);
  let json: unknown;
  try {
    json = JSON.parse(contenido.toString("utf8"));
  } catch {
    console.error(`Maqueta ${projectId}/${version.id}: modelo_web.json no es JSON`);
    return null;
  }
  const validacion = validarModeloWeb(json);
  if (!validacion.modelo) {
    console.error(`Maqueta ${projectId}/${version.id}: modelo_web.json no valida`, validacion.errores);
    return null;
  }

  const firmado = await withSignedModel3dUrls(version, imagenes);
  return {
    etiqueta: etiquetaVersion(version),
    datos: validacion.modelo,
    modelos: firmado.modelos,
    imagenes: imagenesParaVisor(firmado.imagenes),
  };
}
