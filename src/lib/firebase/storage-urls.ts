import "server-only";

/**
 * Resolución de URLs de fotos para el portal.
 *
 * El módulo Obras (dlx-admin) guarda en los documentos de `photos` RUTAS de
 * Storage (`portal/projects/{id}/photos/...`), no URLs. El portal renderiza
 * `image_url`/`thumbnail_url` directamente en <img>, así que antes de pasar
 * las fotos a los componentes hay que firmar esas rutas con el Admin SDK.
 *
 * Las URLs firmadas caducan (1 h): suficiente para una sesión de lectura, y el
 * componente PhotoImage ya muestra "recarga la página" cuando un enlace vence.
 */

const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hora

/** ¿Es una ruta de Storage (y no una URL http(s) ni un asset local de demo)? */
function isStoragePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/^https?:\/\//i.test(value) &&
    !value.startsWith("/")
  );
}

/** Campos mínimos que necesita la firma (estructural, vale PortalPhoto o any). */
interface SignablePhoto {
  id?: string;
  storage_path?: string | null;
  image_url?: string | null;
  thumbnail_storage_path?: string | null;
  thumbnail_url?: string | null;
}

/**
 * Devuelve las fotos con `image_url` y `thumbnail_url` convertidas en URLs
 * firmadas. Si una foto no se puede firmar, se deja tal cual (PhotoImage
 * mostrará su estado de error) y se continúa con el resto.
 */
export async function withSignedPhotoUrls<T extends SignablePhoto>(photos: T[]): Promise<T[]> {
  if (photos.length === 0) return photos;

  const { adminBucket } = await import("./admin");
  const { getStorageReadUrl } = await import("./storage-read-url");
  const bucket = adminBucket();
  const expires = Date.now() + SIGNED_URL_TTL_MS;

  const sign = (path: string): Promise<string> => getStorageReadUrl(bucket, path, expires);

  return Promise.all(
    photos.map(async (photo) => {
      const imagePath = isStoragePath(photo.storage_path)
        ? photo.storage_path
        : isStoragePath(photo.image_url)
          ? photo.image_url
          : null;
      const thumbnailPath = isStoragePath(photo.thumbnail_storage_path)
        ? photo.thumbnail_storage_path
        : isStoragePath(photo.thumbnail_url)
          ? photo.thumbnail_url
          : null;

      if (!imagePath && !thumbnailPath) return photo;

      try {
        const [imageUrl, thumbnailUrl] = await Promise.all([
          imagePath ? sign(imagePath) : null,
          thumbnailPath ? sign(thumbnailPath) : null,
        ]);
        return {
          ...photo,
          image_url: imageUrl ?? photo.image_url,
          thumbnail_url: thumbnailUrl ?? photo.thumbnail_url,
        };
      } catch (error) {
        console.error(`Error firmando las URLs de la foto ${photo.id}:`, error);
        return photo;
      }
    })
  );
}

/** Rutas de una versión de la maqueta 3D que hay que firmar */
interface SignableModel3dVersion {
  conservado_path: string;
  /** null al principio de la obra (solo estado actual) */
  demolido_path: string | null;
  nuevo_path: string | null;
}

/** Lo mínimo de una imagen de la maqueta para firmarla */
interface SignableModel3dImage {
  id: string;
  storage_path: string;
  thumbnail_storage_path: string;
}

/**
 * Firma (1 h) las tres capas GLB de la versión publicada y la imagen y la
 * miniatura de cada foto o render. El modelo_web.json no se firma: lo lee y
 * valida el servidor. Sin capas no hay maqueta (se lanza el error); una imagen
 * que no se pueda firmar se omite y se continúa.
 */
export async function withSignedModel3dUrls<T extends SignableModel3dImage>(
  version: SignableModel3dVersion,
  images: T[],
): Promise<{
  modelos: { conservado: string; demolido?: string; nuevo?: string };
  imagenes: Array<T & { url: string; thumb_url: string }>;
}> {
  const { adminBucket } = await import("./admin");
  const { getStorageReadUrl } = await import("./storage-read-url");
  const bucket = adminBucket();
  const expires = Date.now() + SIGNED_URL_TTL_MS;
  const sign = (path: string): Promise<string> => getStorageReadUrl(bucket, path, expires);

  const [conservado, demolido, nuevo] = await Promise.all([
    sign(version.conservado_path),
    version.demolido_path ? sign(version.demolido_path) : null,
    version.nuevo_path ? sign(version.nuevo_path) : null,
  ]);
  type Firmada = T & { url: string; thumb_url: string };
  // En su orden; las que no se pueden firmar quedan en null y se omiten
  const firmadas: Array<Firmada | null> = images.map(() => null);
  await Promise.all(
    images.map(async (image, i) => {
      try {
        const [url, thumb_url] = await Promise.all([sign(image.storage_path), sign(image.thumbnail_storage_path)]);
        firmadas[i] = { ...image, url, thumb_url };
      } catch (error) {
        console.error(`Error firmando la imagen ${image.id} de la maqueta:`, error);
      }
    }),
  );
  return {
    modelos: { conservado, ...(demolido ? { demolido } : {}), ...(nuevo ? { nuevo } : {}) },
    imagenes: firmadas.filter((i): i is Firmada => i !== null),
  };
}
