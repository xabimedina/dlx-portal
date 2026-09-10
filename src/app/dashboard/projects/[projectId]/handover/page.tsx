import React from "react";
import { getPhases, getDocuments, getPhotos, getWeeklyUpdates } from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { HandoverClient } from "./handover-client";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ClientProjectHandoverPage({ params }: PageProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return <AccessRestricted message="No tienes autorización para acceder a la entrega de este proyecto." />;
  }
  const { profile, project } = access;

  let phases: any[] = [];
  let documents: any[] = [];
  let photos: any[] = [];
  let weeklyUpdates: any[] = [];

  try {
    const [phasesData, documentsData, photosData, weeklyUpdatesData] = await Promise.all([
      getPhases(projectId),
      getDocuments(projectId),
      getPhotos(projectId),
      getWeeklyUpdates(projectId),
    ]);
    phases = phasesData || [];
    documents = documentsData || [];
    weeklyUpdates = weeklyUpdatesData || [];
    // Las fotos guardan rutas de Storage; el navegador necesita URLs firmadas
    photos = await withSignedPhotoUrls(photosData || []);
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de entrega:", err);
  }

  return (
    <HandoverClient
      project={project}
      phases={phases}
      documents={documents}
      photos={photos}
      weeklyUpdates={weeklyUpdates}
      profile={profile}
    />
  );
}
