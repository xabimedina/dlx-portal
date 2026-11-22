import React from "react";
import { getPhases, getWeeklyUpdates, getPhotos, getMeetings } from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { isConfirmedMeeting } from "@/lib/actions-aggregator";
import type { PortalMeeting, PortalPhase, PortalPhoto, PortalWeeklyUpdate } from "@/types/portal";
import { PhotosClient } from "./photos-client";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ClientPhotosPage({ params }: PageProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return <AccessRestricted message="No tienes autorización para acceder a la galería de fotos de este proyecto." />;
  }
  const { profile, project } = access;

  let phases: PortalPhase[] = [];
  let weeklyUpdates: PortalWeeklyUpdate[] = [];
  let photos: PortalPhoto[] = [];
  let meetings: PortalMeeting[] = [];

  try {
    [phases, weeklyUpdates, photos, meetings] = await Promise.all([
      getPhases(projectId),
      getWeeklyUpdates(projectId),
      getPhotos(projectId),
      getMeetings(projectId),
    ]);
    // Las fotos guardan rutas de Storage; el navegador necesita URLs firmadas
    photos = await withSignedPhotoUrls(photos);
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de fotos:", err);
  }

  // Las actas borrador no existen para el cliente (aquí solo dan la procedencia)
  meetings = meetings.filter(isConfirmedMeeting);

  return (
    <PhotosClient
      photos={photos}
      phases={phases}
      weeklyUpdates={weeklyUpdates}
      meetings={meetings}
      projectId={project.id}
      projectName={project.name}
      profile={profile}
    />
  );
}
