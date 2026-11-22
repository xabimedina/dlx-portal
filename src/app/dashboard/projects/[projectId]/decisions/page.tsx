import React from "react";
import type { PortalDocument, PortalPhase, PortalPhoto } from "@/types/portal";
import { getPhases, getDecisions, getDocuments, getPhotos } from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { esNovedadConjunto, versionDeConjunto } from "@/lib/novedad";
import { AccessRestricted } from "@/components/access-restricted";
import { MarcarVisto } from "@/components/novedad";
import { DecisionsClient } from "./decisions-client";
import type { Decision } from "./decision-utils";

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
  const { project } = access;

  let phases: PortalPhase[] = [];
  let decisions: Decision[] = [];
  let documents: PortalDocument[] = [];
  let photos: PortalPhoto[] = [];

  try {
    [phases, decisions, documents, photos] = await Promise.all([
      getPhases(projectId),
      getDecisions(projectId),
      getDocuments(projectId),
      getPhotos(projectId),
    ]);
    // Esta pantalla solo pinta las fotos adjuntas a una decisión; el navegador
    // necesita URLs firmadas (las fotos guardan rutas de Storage)
    photos = await withSignedPhotoUrls(photos.filter((p) => p.decision_id));
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de decisiones:", err);
  }

  // Hoy en Madrid (igual que «Lo que te toca»): el plazo se dice igual en servidor y cliente
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

  // «Se mueve lo que es de ahora»: la entrada de las tarjetas solo se reproduce si hay
  // alguna decisión pendiente que quien mira no había visto (si el conjunto encoge, no)
  const pendientes = decisions.filter((d) => d.status === "Pendiente").map((d) => d.id);
  const version = versionDeConjunto(pendientes);
  const nuevo = await esNovedadConjunto("decisiones", pendientes);

  return (
    <>
      <DecisionsClient
        initialDecisions={decisions}
        phases={phases}
        documents={documents}
        photos={photos}
        projectName={project.name}
        today={today}
        nuevo={nuevo}
      />
      <MarcarVisto id="decisiones" version={version} />
    </>
  );
}
