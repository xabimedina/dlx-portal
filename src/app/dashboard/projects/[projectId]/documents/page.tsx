import React from "react";
import { getPhases, getDocuments } from "@/lib/firebase/db";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { DocumentsClient } from "./documents-client";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ClientDocumentsPage({ params }: PageProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return <AccessRestricted message="No tienes autorización para acceder a los planos y contratos de este proyecto." />;
  }
  const { profile, project } = access;

  let phases: any[] = [];
  let documents: any[] = [];

  try {
    [phases, documents] = await Promise.all([
      getPhases(projectId),
      getDocuments(projectId),
    ]);
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de documentos:", err);
  }

  return (
    <DocumentsClient
      documents={documents}
      phases={phases}
      projectId={project.id}
      profile={profile}
    />
  );
}
