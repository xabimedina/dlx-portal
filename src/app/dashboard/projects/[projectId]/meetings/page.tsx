import React from "react";
import { getPhases, getMeetings, getDocuments, getPhotos, getRequests } from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { isConfirmedMeeting } from "@/lib/actions-aggregator";
import type { PortalDocument, PortalMeeting, PortalPhase, PortalPhoto, PortalRequest } from "@/types/portal";
import { MeetingsClient } from "./meetings-client";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ClientMeetingsPage({ params }: PageProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return <AccessRestricted message="No tienes autorización para acceder a las reuniones de este proyecto." />;
  }
  const { project } = access;

  let phases: PortalPhase[] = [];
  let meetings: PortalMeeting[] = [];
  let documents: PortalDocument[] = [];
  let photos: PortalPhoto[] = [];
  let requests: PortalRequest[] = [];

  try {
    const [phasesData, meetingsData, allDocs, photosData, requestsData] = await Promise.all([
      getPhases(projectId),
      getMeetings(projectId),
      getDocuments(projectId),
      getPhotos(projectId),
      getRequests(projectId),
    ]);
    phases = phasesData || [];
    meetings = meetingsData || [];
    documents = (allDocs || []).filter((d) => d.category === "Acta");
    // Las fotos guardan rutas de Storage; el navegador necesita URLs firmadas
    photos = await withSignedPhotoUrls(photosData || []);
    requests = requestsData || [];
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de reuniones:", err);
  }

  // Las actas en borrador no existen para el cliente (las antiguas sin
  // estado se consideran confirmadas).
  meetings = meetings.filter(isConfirmedMeeting);

  return (
    <MeetingsClient
      meetings={meetings}
      photos={photos}
      requests={requests}
      phases={phases}
      documents={documents}
      projectId={project.id}
      projectName={project.name}
    />
  );
}
