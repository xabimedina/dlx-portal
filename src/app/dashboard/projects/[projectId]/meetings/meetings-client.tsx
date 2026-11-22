"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, Download, FileText, RefreshCw } from "lucide-react";
import { PhotoImage } from "@/components/photo-image";
import { Cells, Eyebrow, Notice, SecHead, StateBadge } from "@/components/portal-ui";
import { useToast, ToastViewport } from "@/components/toast";
import { isNoOpStudioText } from "@/lib/actions-aggregator";
import { formatDateEs, formatDayMonthEs } from "@/lib/format-date-es";
import type { PortalDocument, PortalMeeting, PortalPhase, PortalPhoto, PortalRequest } from "@/types/portal";
import { createClientRequestAction, getSignedDocumentUrlAction } from "../../../actions";

/**
 * Reuniones (fase 2): el acta más reciente como un documento (lo decidido en grande, lo
 * pendiente en filas «Tú» / «Estudio»), el formulario para la próxima reunión y el
 * historial en filas que se despliegan. Pantalla tranquila: sin coreografía de entrada,
 * solo transiciones de estado de 140/220 ms. El único Saffron es el punto de tu tarea
 * pendiente en el acta más reciente.
 */

interface MeetingsClientProps {
  meetings: PortalMeeting[];
  photos: PortalPhoto[];
  requests: PortalRequest[];
  phases: PortalPhase[];
  /** Solo documentos de categoría «Acta». */
  documents: PortalDocument[];
  projectId: string;
  projectName: string;
}

const BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-jet px-5 text-sm font-semibold text-whitesmoke hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-45";
const BTN_SECONDARY =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-control-line px-4 text-sm font-semibold text-ink hover:border-jet hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45";

/** Mismos valores que acepta createClientRequestAction; la etiqueta puede ser más corta. */
const REQUEST_TYPES = [
  { value: "Tema para la próxima reunión", label: "Tema para la reunión" },
  { value: "Revisión", label: "Revisión" },
  { value: "Consulta", label: "Consulta" },
] as const;

const TEXTAREA_ID = "reu-texto";

const bytesFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes === 0) return "0\u00a0B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${bytesFmt.format(bytes / Math.pow(1024, i))}\u00a0${sizes[i]}`;
}

/** «application/pdf» → «PDF» (solo si la extensión es corta y legible). */
function formatLabel(mime: string | null | undefined): string {
  const sub = (mime || "").split("/")[1] || "";
  return sub && sub.length <= 4 ? sub.toUpperCase() : "";
}

export function MeetingsClient({
  meetings,
  photos,
  requests,
  phases,
  documents,
  projectId,
  projectName,
}: MeetingsClientProps) {
  // --- SOLICITUDES DEL CLIENTE ---
  const [localRequests, setLocalRequests] = useState<PortalRequest[]>(requests || []);
  const [reqCategory, setReqCategory] = useState<string>("Tema para la próxima reunión");
  const [reqMessage, setReqMessage] = useState("");
  const [reqFeedback, setReqFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const submitRequest = () => {
    if (!reqMessage.trim()) return;
    setReqFeedback(null);
    startSubmit(async () => {
      const res = (await createClientRequestAction(projectId, reqCategory, reqMessage)) as {
        success: boolean;
        error?: string;
        request?: PortalRequest;
      };
      if (res?.success) {
        const created = res.request;
        if (created) setLocalRequests((prev) => [created, ...prev]);
        setReqMessage("");
        setReqFeedback({ text: "Solicitud registrada. El estudio la verá en su panel.", ok: true });
        setTimeout(() => setReqFeedback(null), 3500);
      } else {
        setReqFeedback({ text: res?.error || "No se pudo registrar la solicitud.", ok: false });
      }
    });
  };

  // --- DESCARGA DE ACTAS (URL firmada al momento, como en Documentos) ---
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();
  const handleDownload = async (doc: PortalDocument) => {
    setLoadingDocId(doc.id);
    try {
      const signedUrl = await getSignedDocumentUrlAction(doc.storage_path);
      if (typeof window !== "undefined") window.open(signedUrl, "_blank");
    } catch (err) {
      console.error(err);
      showToast("No se pudo preparar la descarga del acta. Escríbenos aquí mismo si persiste.", "error");
    } finally {
      setLoadingDocId(null);
    }
  };

  /** «Responder aquí»: lleva al campo para escribir. */
  const focusTextarea = () => {
    const el = document.getElementById(TEXTAREA_ID) as HTMLTextAreaElement | null;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
  };

  // Pie obligatorio de toda miniatura: {estancia} · {procedencia}
  const photoCaption = (photo: PortalPhoto, meetingDate: string) =>
    [photo.room, `Acta del ${formatDayMonthEs(meetingDate)}`].filter(Boolean).join(" · ");

  const phaseLabel = (meeting: PortalMeeting) => {
    const phase = phases.find((p) => p.id === meeting.phase_id);
    return phase ? `${phase.phase_number} · ${phase.name}` : "Reunión general";
  };

  // Ordenar reuniones de más reciente a más antigua
  const sortedMeetings = [...meetings].sort((a, b) => String(b.meeting_date).localeCompare(String(a.meeting_date)));
  const latestMeeting = sortedMeetings[0];
  const historyMeetings = sortedMeetings.slice(1);

  /** Contenido de un acta: lo decidido, lo pendiente, los próximos pasos, fotos y actas en PDF. */
  const renderActa = (meeting: PortalMeeting, latest: boolean) => {
    const meetingPhotos = photos.filter((ph) => ph.meeting_id === meeting.id);
    const phaseDocs = documents.filter((d) => d.phase_id === meeting.phase_id);
    const pending = [
      !isNoOpStudioText(meeting.client_tasks) && { who: "Tú", text: meeting.client_tasks as string, mine: true },
      !isNoOpStudioText(meeting.studio_tasks) && { who: "Estudio", text: meeting.studio_tasks as string, mine: false },
    ].filter(Boolean) as Array<{ who: string; text: string; mine: boolean }>;

    return (
      <div className="space-y-6">
        {meeting.decisions_summary && (
          <div className="space-y-2">
            <p className="cell-k">Lo decidido</p>
            <p
              className={`whitespace-pre-line font-medium text-ink ${
                latest ? "text-lg leading-normal" : "text-base leading-[1.55]"
              }`}
            >
              {meeting.decisions_summary}
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <div>
            <p className="cell-k">Lo que queda pendiente</p>
            <ul className="mt-1 divide-y divide-border">
              {pending.map((item) => (
                <li key={item.who} className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-3.5">
                  <span className="cell-k inline-flex items-center gap-1.5 pt-[3px]">
                    {latest && item.mine && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-saffron" />}
                    {item.who}
                  </span>
                  <p className="whitespace-pre-line break-words text-[15px] font-semibold leading-[1.45] text-ink">
                    {item.text}
                  </p>
                  {latest && item.mine && (
                    <button type="button" onClick={focusTextarea} className={`${BTN_PRIMARY} col-start-2 mt-2 justify-self-start`}>
                      Responder aquí
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {meeting.next_steps && (
          <div className="space-y-2">
            <p className="cell-k">Próximos pasos</p>
            <p className="whitespace-pre-line text-sm leading-[1.6] text-ink-soft">{meeting.next_steps}</p>
          </div>
        )}

        {meetingPhotos.length > 0 && (
          <div className="space-y-2">
            <p className="cell-k">Fotos de la reunión</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {meetingPhotos.map((photo) => (
                <figure key={photo.id} className="min-w-0 space-y-1.5">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-zinc-100">
                    <PhotoImage photo={photo} mode="gallery" fill className="object-cover" />
                  </div>
                  <figcaption className="truncate text-xs font-medium text-ink-mute">
                    {photoCaption(photo, meeting.meeting_date)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {phaseDocs.length > 0 && (
          <ul className="space-y-4">
            {phaseDocs.map((doc) => {
              const meta = [formatLabel(doc.mime_type), formatBytes(doc.file_size), doc.version].filter(Boolean).join(" · ");
              const busy = loadingDocId === doc.id;
              return (
                <li key={doc.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-4">
                  <span className="grid size-11 place-items-center rounded-md bg-jet text-whitesmoke">
                    <FileText className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-[15px] font-semibold leading-snug text-ink">{doc.title}</p>
                    {meta && <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-mute tabular-nums">{meta}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    disabled={loadingDocId !== null}
                    aria-label={busy ? `Preparando la descarga de ${doc.title}` : `Descargar ${doc.title}`}
                    className={BTN_SECONDARY}
                  >
                    {busy ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                    <span className="hidden sm:inline">{busy ? "Preparando…" : "Descargar"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-14">
      {/* Cabecera */}
      <header className="space-y-3">
        <Link
          href={`/dashboard/projects/${projectId}/mas`}
          className="-ml-1.5 -mt-2 flex min-h-11 w-fit items-center gap-1 pr-2 text-sm font-semibold text-ink lg:hidden"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Más
        </Link>
        <Eyebrow>{projectName}</Eyebrow>
        <h1 className="display-portal text-ink">Reuniones</h1>
        <p className="max-w-[60ch] text-[15px] leading-[1.6] text-ink-soft">
          Las actas de cada visita y reunión: lo que se decidió, lo que queda pendiente para ti o para el estudio y los
          próximos pasos.
        </p>
      </header>

      {/* 1. El acta más reciente, como un documento */}
      {latestMeeting ? (
        <section aria-labelledby="reu-ultima">
          <article className="space-y-6 rounded-xl border border-border bg-card p-5 sm:p-7">
            <div className="space-y-2.5">
              <Eyebrow>Última reunión</Eyebrow>
              <h2 id="reu-ultima" className="text-xl leading-[1.15] tracking-[0.02em] text-ink sm:text-2xl">
                {latestMeeting.title}
              </h2>
              {latestMeeting.summary && (
                <p className="whitespace-pre-line text-sm leading-[1.6] text-ink-soft">{latestMeeting.summary}</p>
              )}
            </div>
            <Cells
              cols={2}
              items={[
                { k: "Fecha", v: formatDateEs(latestMeeting.meeting_date) },
                { k: "Fase", v: phaseLabel(latestMeeting) },
              ]}
            />
            {renderActa(latestMeeting, true)}
          </article>
        </section>
      ) : (
        <Notice tone="default" title="Aún no hay actas" icon={<CalendarDays aria-hidden />}>
          Todavía no se ha registrado ninguna reunión o visita en este proyecto.
        </Notice>
      )}

      {/* 2. Para la próxima: solicitudes del cliente */}
      <section id="escribir" aria-labelledby="reu-escribir" className="scroll-mt-28 space-y-5">
        <SecHead id="reu-escribir" title="Para la próxima" />
        <form
          className="max-w-2xl space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submitRequest();
          }}
        >
          <p className="text-sm leading-[1.6] text-ink-soft">
            Pide una revisión o propón un tema para la próxima reunión. Queda registrado aquí para que no se pierda, sin
            WhatsApp ni correos sueltos.
          </p>
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-ink">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map((t) => (
                <label
                  key={t.value}
                  className="inline-flex min-h-11 cursor-pointer select-none items-center rounded-full border border-control-line px-4 text-sm font-semibold text-ink hover:border-jet has-[:checked]:border-jet has-[:checked]:bg-jet has-[:checked]:text-whitesmoke has-[:focus-visible]:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"
                >
                  <input
                    type="radio"
                    name="reu-tipo"
                    value={t.value}
                    checked={reqCategory === t.value}
                    onChange={() => setReqCategory(t.value)}
                    className="sr-only"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <label htmlFor={TEXTAREA_ID} className="text-[13px] font-semibold text-ink">
              ¿Qué quieres plantear?
            </label>
            <textarea
              id={TEXTAREA_ID}
              value={reqMessage}
              onChange={(e) => setReqMessage(e.target.value)}
              placeholder="Por ejemplo: me gustaría ver opciones de iluminación para la cocina."
              className="min-h-[108px] w-full resize-y rounded-md border-[1.5px] border-control-line bg-white px-3.5 py-3 text-base leading-normal text-ink transition-colors placeholder:text-ink-mute hover:border-jet"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <button type="submit" disabled={isSubmitting || !reqMessage.trim()} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
              {isSubmitting ? "Enviando…" : "Enviar al estudio"}
            </button>
            <p role="status" aria-live="polite" className="text-sm font-medium text-ink">
              {reqFeedback?.text}
            </p>
          </div>
        </form>

        {localRequests.length > 0 && (
          <div className="max-w-2xl pt-4">
            <Eyebrow>Tus solicitudes</Eyebrow>
            <ul className="mt-1.5 divide-y divide-border">
              {localRequests.map((r) => {
                const atendida = r.status === "Atendida";
                const tipo = REQUEST_TYPES.find((t) => t.value === r.category)?.label ?? r.category;
                return (
                  <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-3.5">
                    <div className="min-w-0">
                      <p className="whitespace-pre-line break-words text-[15px] font-semibold leading-[1.45] text-ink">{r.message}</p>
                      <p className="mt-0.5 text-xs font-medium text-ink-mute">
                        {[tipo, formatDayMonthEs(r.created_at)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <StateBadge tone={atendida ? "done" : "progress"}>{atendida ? "Atendida" : "Recibida"}</StateBadge>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* 3. Reuniones anteriores, en filas que se despliegan */}
      {historyMeetings.length > 0 && (
        <section aria-labelledby="reu-hist" className="space-y-1">
          <SecHead
            id="reu-hist"
            title="Reuniones anteriores"
            action={<span className="text-xs font-semibold text-ink-mute tabular-nums">{historyMeetings.length}</span>}
          />
          <ul className="divide-y divide-border border-b border-border">
            {historyMeetings.map((meet) => (
              <li key={meet.id}>
                <details className="group">
                  <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="block break-words text-[15px] font-semibold leading-snug text-ink">{meet.title}</span>
                      <span className="mt-0.5 block text-xs font-medium text-ink-mute">
                        {formatDateEs(meet.meeting_date)} · {phaseLabel(meet)}
                      </span>
                    </span>
                    <ChevronDown
                      className="size-5 text-ink-mute transition-transform duration-[220ms] ease-[var(--ease-standard)] group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="space-y-6 pb-7 pt-2">
                    {meet.summary && <p className="whitespace-pre-line text-sm leading-[1.6] text-ink-soft">{meet.summary}</p>}
                    {renderActa(meet, false)}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
