import React from "react";
import { getPhases, getDocuments } from "@/lib/firebase/db";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { todayIso } from "@/lib/phase-delay";
import type { PortalDocument, PortalPhase } from "@/types/portal";
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
  const { project } = access;

  let phases: PortalPhase[] = [];
  let documents: PortalDocument[] = [];

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
      documents={documents || []}
      phases={phases || []}
      projectId={project.id}
      projectName={project.name}
      // «Lo último» se calcula con la fecha del servidor: sin desajustes al hidratar
      today={todayIso()}
    />
  );
}
