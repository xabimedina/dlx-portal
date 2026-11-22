import React from "react";
import { getPhases, getWeeklyUpdates, getPhotos } from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { getDeliveryLine } from "@/lib/status-headline";
import { esNovedad } from "@/lib/novedad";
import { AccessRestricted } from "@/components/access-restricted";
import { MarcarVisto } from "@/components/novedad";
import type { PortalPhase, PortalPhoto, PortalWeeklyUpdate } from "@/types/portal";
import { ConstructionClient } from "./construction-client";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ClientConstructionPage({ params }: PageProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return <AccessRestricted message="No tienes autorización para acceder al diario de obra de este proyecto." />;
  }
  const { project } = access;

  let phases: PortalPhase[] = [];
  let weeklyUpdates: PortalWeeklyUpdate[] = [];
  let photos: PortalPhoto[] = [];

  try {
    [phases, weeklyUpdates, photos] = await Promise.all([
      getPhases(projectId),
      getWeeklyUpdates(projectId),
      getPhotos(projectId),
    ]);
    // Las fotos guardan rutas de Storage; el navegador necesita URLs firmadas
    photos = await withSignedPhotoUrls(photos);
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de obra:", err);
  }

  // Partes de más reciente a más antiguo (por semana, como siempre)
  const updates = [...weeklyUpdates].sort((a, b) => b.week_number - a.week_number);
  const version = updates[0]?.id ?? null;

  // «Se mueve lo que es de ahora»: el rotulador solo se dibuja con un parte nuevo para quien mira
  const nuevo = await esNovedad("obra", version);

  // La fecha de llaves al final de la regla, solo si el estudio la ha estimado
  const entrega = getDeliveryLine(project, phases);
  const llavesIso = entrega.kind === "estimate" ? entrega.dateIso : null;

  return (
    <>
      <ConstructionClient
        updates={updates}
        photos={photos}
        projectId={project.id}
        llavesIso={llavesIso}
        nuevo={nuevo}
      />
      <MarcarVisto id="obra" version={version} />
    </>
  );
}
