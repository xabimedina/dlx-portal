import React from "react";
import { getPhases, getWeeklyUpdates, getPhotos } from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
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
  const { profile, project } = access;

  let phases: any[] = [];
  let weeklyUpdates: any[] = [];
  let photos: any[] = [];

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

  return (
    <ConstructionClient
      weeklyUpdates={weeklyUpdates}
      phases={phases}
      photos={photos}
      projectId={project.id}
      profile={profile}
    />
  );
}
