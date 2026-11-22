import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import {
  getPhases, getMeetings, getDecisions, getWeeklyUpdates, getPhotos, getRequests,
} from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { AccessRestricted } from "@/components/access-restricted";
import { Cells, Eyebrow } from "@/components/portal-ui";
import { MarcarVisto } from "@/components/novedad";
import { esNovedad } from "@/lib/novedad";
import { todayIso } from "@/lib/phase-delay";
import { formatDateEs, relativeDaysEs } from "@/lib/format-date-es";
import {
  getStatusHeadline, getDeliveryLine, getRecentMilestone, getActivePhase,
} from "@/lib/status-headline";
import { buildClientActions, isConfirmedMeeting } from "@/lib/actions-aggregator";
import type {
  PortalPhase, PortalMeeting, PortalDecision, PortalWeeklyUpdate, PortalPhoto, PortalRequest,
} from "@/types/portal";
import { StickyActionPill } from "./sticky-action-pill";
import { buildDisco, fechaCorta } from "./inicio-disco";
import { DiscoAhora } from "./inicio-disco-svg";
import { InicioTeToca } from "./inicio-te-toca";
import { InicioSemana } from "./inicio-semana";
import styles from "./inicio.module.css";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * Inicio del cliente (propuesta de noviembre de 2026, sistema revisado):
 * 1. Portada Jet a sangre con el estado y el «disco de ahora» (la línea real del
 *    proyecto, de la primera fase a las llaves, y el % real del último parte).
 * 2. «Te toca a ti»: índice numerado; solo lo más urgente lleva botón macizo.
 * 3. «Esta semana»: el último parte con foto honesta, avance y su tendencia.
 * Todo se deriva de datos (status-headline, actions-aggregator, inicio-disco); el
 * «Escribir al estudio» lo pone la banda de cierre del layout.
 */
export default async function ProjectHomePage({ params }: PageProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return (
      <AccessRestricted
        message={
          access.profile.role === "client"
            ? "No tienes autorización para acceder a este proyecto de obra."
            : "No se ha encontrado el proyecto seleccionado."
        }
      />
    );
  }
  const { project } = access;
  const base = `/dashboard/projects/${project.id}`;
  const today = todayIso();

  let phases: PortalPhase[] = [];
  let meetings: PortalMeeting[] = [];
  let decisions: PortalDecision[] = [];
  let weeklyUpdates: PortalWeeklyUpdate[] = [];
  let photos: PortalPhoto[] = [];
  let requests: PortalRequest[] = [];

  try {
    const [phasesData, meetingsData, decisionsData, weeklyUpdatesData, photosData, requestsData] =
      await Promise.all([
        getPhases(projectId),
        getMeetings(projectId),
        getDecisions(projectId),
        getWeeklyUpdates(projectId),
        getPhotos(projectId),
        getRequests(projectId),
      ]);
    phases = phasesData || [];
    meetings = meetingsData || [];
    decisions = decisionsData || [];
    weeklyUpdates = weeklyUpdatesData || [];
    requests = requestsData || [];
    photos = await withSignedPhotoUrls(photosData || []);
  } catch (err) {
    console.error("Error cargando datos de la home del proyecto:", err);
  }

  // Las actas borrador no existen para el cliente
  meetings = meetings
    .filter(isConfirmedMeeting)
    .sort((a, b) => String(b.meeting_date).localeCompare(String(a.meeting_date)));

  // El «último parte» SIEMPRE por week_number desc (nunca el orden del array)
  const updates = [...weeklyUpdates].sort(
    (a, b) =>
      b.week_number - a.week_number ||
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);
  const sortedPhotos = [...photos].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );

  const isPaused = project.status === "Pausado";

  // ---------- Derivaciones puras ----------
  const headline = getStatusHeadline({ project, phases: sortedPhases, decisions, today });
  const delivery = getDeliveryLine(project, sortedPhases);
  const milestone = getRecentMilestone(sortedPhases, today);
  const activePhase = getActivePhase(sortedPhases, project.current_phase_id);
  const { actions, studio } = buildClientActions({
    decisions, phases: sortedPhases, meetings, weeklyUpdates, requests,
  });

  const latestUpdate = updates[0] || null;
  const latestMeeting = meetings[0] || null;

  const coverPhoto = latestUpdate
    ? sortedPhotos.find((p) => p.weekly_update_id === latestUpdate.id) ||
      (activePhase && sortedPhotos.find((p) => p.phase_id === activePhase.id)) ||
      sortedPhotos[0] ||
      null
    : null;

  // ---------- El disco de ahora ----------
  const disco = buildDisco({
    phases: sortedPhases,
    activePhaseId: activePhase?.id ?? null,
    currentStage: project.current_stage,
    projectStart: project.start_date,
    delivery,
    updates,
    today,
  });

  // Momento de producto: solo si el último parte (o su %) es nuevo para quien mira
  const version = latestUpdate ? `${latestUpdate.id}:${latestUpdate.progress_percentage ?? ""}` : null;
  const nuevo = await esNovedad("inicio", version);

  const totalPhases = sortedPhases.length;
  const activeFull = activePhase ? sortedPhases.find((p) => p.id === activePhase.id) ?? null : null;
  const deliveryDateText = formatDateEs(delivery.kind === "unset" ? null : delivery.dateIso);

  const cells: Array<{ k: React.ReactNode; v: React.ReactNode }> = [];
  if (activeFull) {
    cells.push({
      k: `Fase ${activeFull.phase_number.replace(/^fase\s*/i, "")} de ${totalPhases}`,
      v: activeFull.name,
    });
  }
  if (activeFull?.target_end_date && headline.rule !== 5) {
    cells.push({ k: "Objetivo de la fase", v: fechaCorta(activeFull.target_end_date, today) });
  }

  return (
    <div>
      <MarcarVisto id="inicio" version={version} />

      {/* Contador pegajoso «Te toca · N» (móvil: el panel se va de la pantalla) */}
      <StickyActionPill count={actions.length} targetId="te-toca" />

      {/* ================= 1 · ¿Cómo va? — portada Jet a sangre ================= */}
      {/* Sube bajo la barra de cristal (h-20) y el relleno superior del main; a sangre
          hasta el raíl en escritorio (pl-24 del contenido: 48 px por lado del centro). */}
      <section
        aria-labelledby="inicio-estado"
        className="dark relative mx-[calc(50%_-_50vw)] -mt-28 bg-jet text-whitesmoke sm:-mt-30 lg:mx-[calc(50%_-_50vw_+_48px)]"
      >
        <div className="mx-auto max-w-4xl px-4 pt-[6.75rem] pb-8 sm:px-6 sm:pt-[7.5rem] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-x-10 lg:pt-32 lg:pb-14">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <Eyebrow>
              {project.name} · {project.project_type}
            </Eyebrow>
            <h1 id="inicio-estado" className="display-portal mt-3.5 text-balance text-whitesmoke">
              {headline.headline}
              {headline.detail &&
                (headline.dependsOnYou ? (
                  <>
                    {" "}
                    <a href="#te-toca" className="underline decoration-1 underline-offset-[6px] hover:decoration-2">
                      {headline.detail}
                    </a>
                  </>
                ) : (
                  <span className="text-zinc-300"> {headline.detail}</span>
                ))}
            </h1>
            {headline.chip && <p className="mt-3 text-sm text-zinc-300">{headline.chip}</p>}
          </div>

          {/* El dibujo. La textura de ejes vive solo detrás, y solo por encima de la línea:
              nunca bajo las etiquetas (alto de la zona de etiquetas = (H − axisY) / H).
              Sin fases, fechas ni %, no hay nada real que dibujar y se omite. */}
          {disco.drawable && (
            <div
              className={`mt-4 px-3 pt-1.5 -mx-4 sm:-mx-6 sm:px-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:mt-0 lg:p-0 ${styles.anim} ${
                nuevo ? styles.novedad : ""
              }`}
            >
              <div className="relative lg:hidden">
                <div aria-hidden className="tex-ejes pointer-events-none absolute -inset-x-3 -top-1.5 bottom-[24%] bg-[position:-28px_-20px] sm:-inset-x-5" />
                <DiscoAhora data={disco} variant="compacto" className="relative block" />
              </div>
              <div className="relative hidden lg:block">
                <div aria-hidden className="tex-ejes pointer-events-none absolute -inset-x-4 -top-4 bottom-[22.2%]" />
                <DiscoAhora data={disco} variant="ancho" className="relative block" />
              </div>
            </div>
          )}

          <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
            {/* La fecha, siempre */}
            <p className="mt-4 text-[15px] leading-normal text-zinc-300 lg:mt-5">
              {delivery.kind === "delivered" ? (
                deliveryDateText ? (
                  <>Llaves · entregadas el <strong className="font-semibold text-whitesmoke">{deliveryDateText}</strong>.</>
                ) : (
                  <>Tu casa está entregada.</>
                )
              ) : delivery.kind === "unset" ? (
                <>El estudio aún no ha fijado la fecha estimada de entrega.</>
              ) : delivery.kind === "paused" ? (
                <>
                  Llaves · estimada · <strong className="font-semibold text-whitesmoke">{deliveryDateText || "—"}</strong>
                  {" "}· en revisión durante la pausa.
                </>
              ) : (
                <>
                  Llaves · estimada · <strong className="font-semibold text-whitesmoke">{deliveryDateText || "—"}</strong>.
                  {" "}Si la fecha cambia, te lo contaremos aquí.
                </>
              )}
            </p>

            {cells.length > 0 && <Cells items={cells} className="mt-5" />}

            {milestone && (
              <p className="mt-3 text-[13px] text-zinc-300">
                {milestone.phaseNumber} completada {relativeDaysEs(milestone.endDate, today)}
              </p>
            )}

            {totalPhases > 0 && (
              <Link
                href={`${base}/phases`}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-whitesmoke hover:underline hover:underline-offset-4"
              >
                Ver el camino completo
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ================= 2 y 3 · Te toca a ti / Esta semana ================= */}
      {/* Móvil: primero lo que te toca. Escritorio: la semana a la izquierda y lo que te
          toca, fijo, a la derecha. */}
      <div className="mt-10 space-y-12 lg:mt-16 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-12 lg:space-y-0">
        <InicioTeToca
          base={base}
          actions={actions}
          studio={studio}
          isPaused={isPaused}
          className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-6"
        />
        <InicioSemana
          base={base}
          updates={updates}
          photos={sortedPhotos}
          latestMeeting={latestMeeting}
          isPaused={isPaused}
          isConstruction={project.current_stage === "construction"}
          coverPhoto={coverPhoto}
          today={today}
          className="lg:col-start-1 lg:row-start-1"
        />
      </div>
    </div>
  );
}
