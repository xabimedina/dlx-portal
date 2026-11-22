import "server-only";
import type { Bucket } from "@google-cloud/storage";

/**
 * URL de lectura temporal para un fichero de Storage.
 *
 * Producción: URL firmada con el Admin SDK (getSignedUrl).
 *
 * Solo E2E: cuando el Admin SDK apunta al emulador de Storage
 * (FIREBASE_STORAGE_EMULATOR_HOST), una URL firmada apuntaría a
 * storage.googleapis.com y no al emulador. En ese caso se fija un token de
 * descarga en la metadata (el emulador lo respeta) y se devuelve la URL
 * pública del emulador con ese token.
 */
const E2E_TOKEN = "e2e";

export async function getStorageReadUrl(
  bucket: Bucket,
  path: string,
  expiresAtMs: number,
): Promise<string> {
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (emulatorHost) {
    const file = bucket.file(path);
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: E2E_TOKEN } });
    const host = emulatorHost.startsWith("http") ? emulatorHost : `http://${emulatorHost}`;
    return `${host}/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${E2E_TOKEN}`;
  }
  const [url] = await bucket.file(path).getSignedUrl({ action: "read", expires: expiresAtMs });
  return url;
}
