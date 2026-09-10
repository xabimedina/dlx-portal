import React from "react";
import { getPhases, getDecisions, getDocuments, getPhotos } from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { DecisionsClient } from "./decisions-client";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ClientDecisionsPage({ params }: PageProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return <AccessRestricted message="No tienes autorización para acceder a las decisiones de este proyecto." />;
  }
  const { profile, project } = access;

  let phases: any[] = [];
  let decisions: any[] = [];
  let documents: any[] = [];
  let photos: any[] = [];

  try {
    [phases, decisions, documents, photos] = await Promise.all([
      getPhases(projectId),
      getDecisions(projectId),
      getDocuments(projectId),
      getPhotos(projectId),
    ]);
    // Las fotos guardan rutas de Storage; el navegador necesita URLs firmadas
    photos = await withSignedPhotoUrls(photos);
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de decisiones:", err);
  }

  return (
    <DecisionsClient
      initialDecisions={decisions}
      phases={phases}
      documents={documents}
      photos={photos}
      projectId={project.id}
      profile={profile}
    />
  );
}
