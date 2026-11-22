import Link from "next/link";
import { Box } from "lucide-react";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { cargarMaquetaPublicada } from "@/lib/firebase/model3d";
import { MaquetaPagina } from "./maqueta-pagina";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

/** Página propia de la maqueta 3D (Xabier, 2026-10-29: a pantalla completa y con acceso en la navegación). */
export default async function ClientProjectMaquetaPage({ params }: PageProps) {
  const { projectId } = await params;

  const pageAccess = await getProjectPageAccess(projectId);
  if (pageAccess.mode === "denied") {
    return (
      <AccessRestricted
        message={
          pageAccess.profile.role === "client"
            ? "No tienes autorización para acceder a la maqueta de este proyecto de obra."
            : "No se ha encontrado el proyecto seleccionado."
        }
      />
    );
  }

  const maqueta = await cargarMaquetaPublicada(projectId).catch((err) => {
    console.error("Error cargando la maqueta 3D:", err);
    return null;
  });

  if (!maqueta) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Box className="h-6 w-6 text-zinc-400" aria-hidden />
        <h1 className="display-portal text-zinc-900 dark:text-white">Tu maqueta</h1>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no hay una maqueta de tu vivienda. Aparecerá aquí en cuanto el estudio la suba.
        </p>
        <Link href={`/dashboard/projects/${projectId}`} className="text-xs font-medium text-zinc-700 underline underline-offset-4 dark:text-zinc-300">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return <MaquetaPagina maqueta={maqueta} />;
}
