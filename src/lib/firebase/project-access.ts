import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getUserProfile, type Profile } from "./profile";
import { getProjectForAccess } from "./db";
import type { PortalProject } from "@/types/portal";

/** Resultado del control de acceso común a las subpáginas de proyecto. */
export type ProjectPageAccess =
  | { mode: "real"; profile: Profile; project: PortalProject }
  | { mode: "denied"; profile: Profile };

/**
 * Boilerplate compartido del layout y las subpáginas de
 * /dashboard/projects/[projectId]/*: resuelve el perfil (redirige a /login si
 * no hay sesión) y verifica la propiedad del proyecto en Firestore. Cada
 * página conserva solo su carga de datos específica. Envuelto en React
 * cache() para que el layout y la página de la misma petición compartan una
 * única verificación (una lectura menos de Firestore por vista).
 */
export const getProjectPageAccess = cache(async function getProjectPageAccess(
  projectId: string
): Promise<ProjectPageAccess> {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  const project = await getProjectForAccess(projectId, profile);
  if (!project) return { mode: "denied", profile };
  return { mode: "real", profile, project };
});
