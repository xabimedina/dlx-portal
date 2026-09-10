import React from "react";
import Link from "next/link";
import {
  ArrowRight, CheckSquare, CalendarDays, Eye, MessageSquare, ChevronRight,
} from "lucide-react";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import {
  getPhases, getMeetings, getDecisions, getWeeklyUpdates, getPhotos, getRequests,
} from "@/lib/firebase/db";
import { withSignedPhotoUrls } from "@/lib/firebase/storage-urls";
import { AccessRestricted } from "@/components/access-restricted";
import { PhotoImage } from "@/components/photo-image";
import { getPhaseState } from "@/lib/phase-status";
import { todayIso } from "@/lib/phase-delay";
import { weekLabel } from "@/lib/week-label";
import { gremiosDeAsistentes } from "@/lib/attendees";
import { formatDateEs, formatDayMonthEs, relativeDaysEs, daysBetween } from "@/lib/format-date-es";
import {
  getStatusHeadline, getDeliveryLine, getRecentMilestone, getActivePhase,
} from "@/lib/status-headline";
import { buildClientActions, isConfirmedMeeting, isNoOpStudioText } from "@/lib/actions-aggregator";
import type {
  PortalPhase, PortalMeeting, PortalDecision, PortalWeeklyUpdate, PortalPhoto, PortalRequest,
} from "@/types/portal";
import { StickyActionPill } from "./sticky-action-pill";
import { ExpandableText } from "./expandable-text";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

const STAGE_LABELS: Record<string, string> = {
  project: "Proyecto",
  construction: "Obra",
  handover: "Entrega",
};

const ACTION_ICONS = {
  Decidir: CheckSquare,
  Revisar: Eye,
  "Ver acta": CalendarDays,
  Responder: MessageSquare,
} as const;

/**
 * Home del cliente: el Tríptico. Tres paneles — ¿Cómo va? / ¿Qué me toca a
 * mí? / ¿Qué ha pasado? — más la fila «Explora». Todo el estado se deriva de
 * datos (status-headline, actions-aggregator); aquí no hay copy que pueda
 * mentir.
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
  const previousUpdate = updates[1] || null;
  const latestMeeting = meetings[0] || null;

  // ---------- Panel 3: contenido y procedencias ----------
  const provenance = (photo: PortalPhoto): string => {
    const update = updates.find((w) => w.id === photo.weekly_update_id);
    if (update) return weekLabel(update.week_number);
    const meeting = meetings.find((m) => m.id === photo.meeting_id);
    if (meeting) return `Acta del ${formatDayMonthEs(meeting.meeting_date)}`;
    if (photo.decision_id) return "Decisión";
    const phase = sortedPhases.find((p) => p.id === photo.phase_id);
    return phase ? phase.phase_number : "Proyecto";
  };

  const coverPhoto = latestUpdate
    ? sortedPhotos.find((p) => p.weekly_update_id === latestUpdate.id) ||
      (activePhase && sortedPhotos.find((p) => p.phase_id === activePhase.id)) ||
      sortedPhotos[0] ||
      null
    : null;

  const stripPhotos = latestUpdate
    ? sortedPhotos
        .filter((p) => p.weekly_update_id === latestUpdate.id && p.id !== coverPhoto?.id)
        .slice(0, 3)
    : [];

  const updateIsStale = latestUpdate ? daysBetween(latestUpdate.created_at, today) > 14 : false;
  const progressDelta =
    latestUpdate && previousUpdate
      ? latestUpdate.progress_percentage - previousUpdate.progress_percentage
      : null;
  const workBullets: string[] = (latestUpdate?.current_work || "")
    .split(/[.,;]/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 3)
    .slice(0, 3);
  const gremios = gremiosDeAsistentes(latestUpdate?.attendees);

  // ---------- Barra de recorrido ----------
  const totalPhases = sortedPhases.length;
  const activeNumber = activePhase
    ? activePhase.phase_number.replace(/^fase\s*/i, "")
    : null;

  const deliveryDateText = formatDateEs(delivery.kind === "unset" ? null : delivery.dateIso);

  return (
    <div className="space-y-4">
      {/* Contador pegajoso «Te toca · N» */}
      <StickyActionPill count={actions.length} targetId="te-toca" />

      {/* ================= Cabecera de la home ================= */}
      <header className="px-1 pb-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
          El camino de tu hogar
        </p>
        <h1 className="mt-1.5 font-heading text-3xl font-light leading-tight text-zinc-900 dark:text-white sm:text-4xl">
          {project.name}
        </h1>
        <p className="mt-1 text-sm font-light text-zinc-600 dark:text-zinc-400">
          {project.address} · {project.project_type}
        </p>
      </header>

      {/* ================= Panel 1 · ¿Cómo va? ================= */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full ${
              headline.tone === "amber"
                ? "bg-amber-500"
                : headline.tone === "jet-saffron"
                  ? "bg-amber-500"
                  : "bg-zinc-800 dark:bg-zinc-200"
            }`}
          />
          <h2 className="font-heading text-2xl font-light leading-snug text-zinc-900 dark:text-white sm:text-3xl">
            {headline.headline}
            {headline.detail && (
              headline.dependsOnYou ? (
                <a
                  href="#te-toca"
                  className="ml-2 font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
                >
                  {headline.detail} ↓
                </a>
              ) : (
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">{headline.detail}</span>
              )
            )}
          </h2>
        </div>

        {headline.chip && (
          <p className="mt-3 inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            {headline.chip}
          </p>
        )}

        {/* Dónde estamos */}
        {activePhase && (
          <p className="mt-5 text-sm text-zinc-700 dark:text-zinc-300">
            <strong className="font-semibold text-zinc-900 dark:text-white">
              Fase {activeNumber} de {totalPhases} · {activePhase.name}
            </strong>
            {" — "}etapa {STAGE_LABELS[project.current_stage] || "Proyecto"}
          </p>
        )}

        {/* Barra de recorrido: única representación del roadmap; un solo tap → El camino */}
        {totalPhases > 0 && (
          <Link
            href={`${base}/phases`}
            aria-label="Ver el camino completo del proyecto"
            className="group mt-3 flex min-h-11 items-center rounded-xl"
          >
            <span className="flex w-full items-center gap-1">
              {sortedPhases.map((p) => {
                const state = getPhaseState(p.status);
                const cls =
                  state === "complete"
                    ? "bg-zinc-800 dark:bg-zinc-200"
                    : p.id === activePhase?.id
                      ? `bg-amber-500 ${isPaused ? "" : "motion-safe:animate-pulse"}`
                      : "bg-zinc-200 dark:bg-zinc-700";
                return <span key={p.id} className={`h-1.5 flex-1 rounded-full ${cls}`} />;
              })}
            </span>
            <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {/* La fecha, siempre */}
        <p className="mt-4 border-t border-zinc-100 pt-4 text-sm font-light text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          {delivery.kind === "delivered" ? (
            deliveryDateText ? (
              <>Entregada el <strong className="font-semibold text-zinc-900 dark:text-white">{deliveryDateText}</strong></>
            ) : (
              <>Tu casa está entregada</>
            )
          ) : delivery.kind === "unset" ? (
            <>El estudio aún no ha fijado la fecha estimada de entrega</>
          ) : (
            <>
              Tu casa, lista hacia el{" "}
              <strong className="font-semibold text-zinc-900 dark:text-white">{deliveryDateText || "—"}</strong>
              {" "}· fecha estimada
              {delivery.kind === "paused" && <> · en revisión durante la pausa</>}
            </>
          )}
        </p>

        {/* Hito reciente */}
        {milestone && (
          <p className="mt-2 text-xs font-light text-zinc-500 dark:text-zinc-400">
            {milestone.phaseNumber} completada {relativeDaysEs(milestone.endDate, today)}
          </p>
        )}
      </section>

      {/* ================= Panel 2 · ¿Qué me toca a mí? ================= */}
      <section
        id="te-toca"
        className={`scroll-mt-28 rounded-3xl border bg-white dark:bg-zinc-900 ${
          actions.length > 0
            ? "border-amber-500/30 p-6 sm:p-8"
            : "border-zinc-200 p-5 dark:border-zinc-800 sm:p-6"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg font-medium text-zinc-900 dark:text-white">
            Te toca a ti
            <span className="ml-2 text-sm font-light text-zinc-500 dark:text-zinc-400">
              · {actions.length} {actions.length === 1 ? "asunto" : "asuntos"}
            </span>
          </h2>
          {actions.length > 3 && (
            <Link
              href={`${base}/decisions`}
              className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              Ver los {actions.length} →
            </Link>
          )}
        </div>

        {isPaused && actions.length > 0 && (
          <p className="mt-2 text-xs font-light text-zinc-500 dark:text-zinc-400">
            El proyecto está en pausa; puedes responder cuando quieras.
          </p>
        )}

        {actions.length === 0 ? (
          <p className="mt-2 text-sm font-light text-zinc-600 dark:text-zinc-400">
            Nada pendiente por tu parte — te avisaremos aquí cuando haya algo.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {actions.slice(0, 3).map((action) => {
              const Icon = ACTION_ICONS[action.verb];
              return (
                <li
                  key={action.key}
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 sm:flex-row sm:items-center"
                >
                  <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 sm:flex">
                    <Icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-grow">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug text-zinc-900 dark:text-white">
                        {action.title}
                      </p>
                      {action.urgent && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-900">
                          urgente
                        </span>
                      )}
                    </div>
                    {action.origin && (
                      <p className="mt-0.5 text-xs font-light text-zinc-600 dark:text-zinc-400">
                        {action.origin}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`${base}/${action.section}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                  >
                    {action.verb} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* En manos del estudio */}
        {studio.length > 0 && (
          <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
              En manos del estudio
            </h3>
            <ul className="mt-2 space-y-1.5">
              {studio.map((item) => (
                <li key={item.key} className="text-xs font-light leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Link
            href={`${base}/meetings`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 px-5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600"
          >
            Escribir al estudio
          </Link>
        </div>
      </section>

      {/* ================= Panel 3 · ¿Qué ha pasado? ================= */}
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {latestUpdate ? (
          <>
            {/* Foto de portada (tap → Fotos) */}
            <Link href={`${base}/photos`} className="block" aria-label="Ver todas las fotos">
              {coverPhoto ? (
                <figure className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                  <PhotoImage photo={coverPhoto} mode="gallery" fill className="object-cover" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 text-xs text-white">
                    {[coverPhoto.room, coverPhoto.caption].filter(Boolean).join(" · ")}
                  </figcaption>
                </figure>
              ) : (
                // Composición tipográfica de marca (nunca un gradiente gris)
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900 dark:bg-zinc-950">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#3f3f46_1px,transparent_1px),linear-gradient(to_bottom,#3f3f46_1px,transparent_1px)] bg-[size:2.5rem_2.5rem] opacity-40" />
                  <div className="absolute left-6 top-6 h-10 w-10 border-l-2 border-t-2 border-amber-500" />
                  <div className="absolute inset-0 flex items-end p-6">
                    <span className="font-heading text-2xl font-light leading-snug text-white">
                      {latestUpdate.title}
                    </span>
                  </div>
                </div>
              )}
            </Link>

            <div className="space-y-5 p-6 sm:p-8">
              {/* Cabecera del parte con atribución y recencia */}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {updateIsStale && <span>Último parte disponible: </span>}
                  {weekLabel(latestUpdate.week_number) === "Cierre"
                    ? "Cierre de obra"
                    : weekLabel(latestUpdate.week_number)}
                  <span className="ml-2 normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
                    · {relativeDaysEs(latestUpdate.created_at, today)}
                  </span>
                </p>
                <h2 className="mt-1 font-heading text-xl font-light text-zinc-900 dark:text-white sm:text-2xl">
                  {latestUpdate.title}
                </h2>
                {isPaused && (
                  <p className="mt-1 text-xs font-light text-zinc-500 dark:text-zinc-400">
                    Último parte antes de la pausa.
                  </p>
                )}
              </div>

              {/* El único porcentaje, con atribución */}
              {typeof latestUpdate.progress_percentage === "number" && (
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Avance de obra:{" "}
                    <strong className="font-semibold text-zinc-900 dark:text-white">
                      {latestUpdate.progress_percentage}%
                    </strong>
                    {progressDelta !== null && (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {" "}· {progressDelta >= 0 ? `+${progressDelta}` : progressDelta} desde la semana pasada
                      </span>
                    )}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" "}· según el parte de la {weekLabel(latestUpdate.week_number)}
                    </span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${latestUpdate.progress_percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Crónica en tres tiempos */}
              {latestUpdate.summary && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
                    Esta semana
                  </h3>
                  <ExpandableText
                    text={latestUpdate.summary}
                    className="mt-1.5 text-sm font-light leading-relaxed text-zinc-700 dark:text-zinc-300"
                  />
                  {workBullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {workBullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs font-light text-zinc-600 dark:text-zinc-400">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {latestUpdate.issues && !isNoOpStudioText(latestUpdate.issues) && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-800 dark:text-amber-400">
                    Hubo un imprevisto
                  </h3>
                  <p className="mt-1.5 text-sm font-light leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {latestUpdate.issues}
                  </p>
                </div>
              )}

              {latestUpdate.next_steps && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
                    La semana que viene
                  </h3>
                  <p className="mt-1.5 text-sm font-light leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {latestUpdate.next_steps}
                  </p>
                </div>
              )}

              {/* Pie humano: gremios + tira de miniaturas */}
              {(gremios.length > 0 || stripPhotos.length > 0) && (
                <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  {gremios.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-light text-zinc-600 dark:text-zinc-400">
                      En obra esta semana:
                      {gremios.map((g) => (
                        <span
                          key={g}
                          className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {g}
                        </span>
                      ))}
                    </p>
                  )}
                  {stripPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {stripPhotos.map((photo) => (
                        <Link key={photo.id} href={`${base}/photos`}>
                          <figure className="space-y-1">
                            <div className="relative h-20 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 sm:h-24">
                              <PhotoImage photo={photo} mode="gallery" fill className="object-cover" />
                            </div>
                            <figcaption className="truncate text-[9px] text-zinc-500 dark:text-zinc-400">
                              {[photo.room, provenance(photo)].filter(Boolean).join(" · ")}
                            </figcaption>
                          </figure>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Link
                href={`${base}/construction`}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
              >
                Semanas anteriores <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </>
        ) : latestMeeting ? (
          // Degradación 2: sin partes pero hay acta confirmada
          <div className="space-y-5 p-6 sm:p-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                Reunión del {formatDayMonthEs(latestMeeting.meeting_date)}
                <span className="ml-2 normal-case tracking-normal text-zinc-400 dark:text-zinc-500">
                  · {relativeDaysEs(latestMeeting.meeting_date, today)}
                </span>
              </p>
              <h2 className="mt-1 font-heading text-xl font-light text-zinc-900 dark:text-white sm:text-2xl">
                {latestMeeting.title}
              </h2>
              {project.current_stage === "construction" && (
                <p className="mt-1 text-xs font-light text-zinc-500 dark:text-zinc-400">
                  La obra arranca; aquí verás el parte de cada semana.
                </p>
              )}
              {isPaused && (
                <p className="mt-1 text-xs font-light text-zinc-500 dark:text-zinc-400">
                  Última novedad antes de la pausa.
                </p>
              )}
            </div>

            {latestMeeting.summary && (
              <ExpandableText
                text={latestMeeting.summary}
                className="text-sm font-light leading-relaxed text-zinc-700 dark:text-zinc-300"
              />
            )}

            {latestMeeting.decisions_summary && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
                  Lo que se decidió
                </h3>
                <p className="mt-1.5 text-sm font-light leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {latestMeeting.decisions_summary}
                </p>
              </div>
            )}

            {(() => {
              const meetingPhotos = sortedPhotos
                .filter((p) => p.meeting_id === latestMeeting.id)
                .slice(0, 3);
              if (!meetingPhotos.length) return null;
              return (
                <div className="grid grid-cols-3 gap-2">
                  {meetingPhotos.map((photo) => (
                    <Link key={photo.id} href={`${base}/photos`}>
                      <figure className="space-y-1">
                        <div className="relative h-20 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 sm:h-24">
                          <PhotoImage photo={photo} mode="gallery" fill className="object-cover" />
                        </div>
                        <figcaption className="truncate text-[9px] text-zinc-500 dark:text-zinc-400">
                          {[photo.room, `Acta del ${formatDayMonthEs(latestMeeting.meeting_date)}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </figcaption>
                      </figure>
                    </Link>
                  ))}
                </div>
              );
            })()}

            <Link
              href={`${base}/meetings`}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              Todas las reuniones <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        ) : (
          // Degradación 3: ni partes ni actas
          <div className="p-6 sm:p-8">
            <h2 className="font-heading text-lg font-light text-zinc-900 dark:text-white">
              ¿Qué ha pasado?
            </h2>
            <p className="mt-2 text-sm font-light text-zinc-600 dark:text-zinc-400">
              Las novedades de tu proyecto aparecerán aquí tras la primera reunión.
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
