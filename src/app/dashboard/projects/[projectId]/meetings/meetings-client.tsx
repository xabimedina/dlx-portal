"use client";

import React, { useState, useTransition } from "react";
import {
  Calendar, FileText, Download, AlertCircle, Clock,
  CheckCircle2, User, Wrench, Footprints, ClipboardList, Sparkles
} from "lucide-react";
import { Profile } from "@/lib/firebase/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoImage } from "@/components/photo-image";
import { createClientRequestAction } from "../../../actions";
import { formatDateEs, formatDayMonthEs } from "@/lib/format-date-es";

interface MeetingsClientProps {
  meetings: any[];
  photos: any[];
  requests: any[];
  phases: any[];
  documents: any[];
  projectId: string;
  profile: Profile;
}

export function MeetingsClient({
  meetings,
  photos,
  requests,
  phases,
  documents,
  projectId,
  profile,
}: MeetingsClientProps) {
  void profile;

  // --- SOLICITUDES DEL CLIENTE ---
  const [localRequests, setLocalRequests] = useState<any[]>(requests || []);
  const [reqCategory, setReqCategory] = useState("Tema para la próxima reunión");
  const [reqMessage, setReqMessage] = useState("");
  const [reqFeedback, setReqFeedback] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const submitRequest = () => {
    if (!reqMessage.trim()) return;
    setReqFeedback(null);
    startSubmit(async () => {
      const res: any = await createClientRequestAction(projectId, reqCategory, reqMessage);
      if (res?.success) {
        if (res.request) setLocalRequests((prev) => [res.request, ...prev]);
        setReqMessage("");
        setReqFeedback("Solicitud registrada. El estudio la verá en su panel.");
        setTimeout(() => setReqFeedback(null), 3500);
      } else {
        setReqFeedback(res?.error || "No se pudo registrar la solicitud.");
      }
    });
  };

  // Formateador de bytes
  const formatBytes = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Pie obligatorio de toda miniatura: {estancia} · {procedencia}
  const photoCaption = (photo: any, meetingDate: string) =>
    [photo.room, `Acta del ${formatDayMonthEs(meetingDate)}`].filter(Boolean).join(" · ");

  // 1. Ordenar reuniones cronológicamente de más reciente a más antigua
  const sortedMeetings = [...meetings].sort((a, b) => {
    return String(b.meeting_date).localeCompare(String(a.meeting_date));
  });

  const latestMeeting = sortedMeetings[0];
  const historyMeetings = sortedMeetings.slice(1);

  return (
    <div className="space-y-10">

      {/* Cabecera y Introducción */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em]">
          <Calendar className="h-3.5 w-3.5 text-amber-500" />
          <span>Reuniones y visitas de obra</span>
        </div>
        <h1 className="text-3xl font-light tracking-tight text-zinc-900 dark:text-white leading-tight">
          Reuniones y actas
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-light max-w-xl">
          Aquí recopilamos las actas de visitas técnicas y reuniones presenciales, detallando los acuerdos adoptados, las tareas de seguimiento pendientes para el estudio o para ti, y los próximos pasos de la construcción de tu hogar.
        </p>
      </div>

      {/* SOLICITUDES DEL CLIENTE */}
      <Card id="escribir" className="border border-zinc-200/70 dark:border-zinc-850 bg-white/70 dark:bg-zinc-900/60 rounded-3xl shadow-xs overflow-hidden">
        <CardHeader className="py-5 border-b border-zinc-100 dark:border-zinc-850">
          <CardTitle className="text-base font-light text-zinc-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> ¿Quieres tratar algo en la próxima reunión?
          </CardTitle>
          <CardDescription className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
            Pide una revisión o propón un tema. Queda registrado aquí para que no se pierda, sin WhatsApp ni correos sueltos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block mb-1.5">Tipo</label>
              <select value={reqCategory} onChange={(e) => setReqCategory(e.target.value)} className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-[12px] text-zinc-700 dark:text-zinc-200">
                <option>Tema para la próxima reunión</option>
                <option>Revisión</option>
                <option>Consulta</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block mb-1.5">¿Qué quieres plantear?</label>
              <textarea value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} placeholder="Ej.: Me gustaría ver opciones de iluminación para la cocina…" className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-[12px] min-h-[64px] text-zinc-700 dark:text-zinc-200" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={submitRequest} disabled={isSubmitting || !reqMessage.trim()} className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-medium text-xs rounded-xl">
              {isSubmitting ? "Enviando…" : "Enviar solicitud"}
            </Button>
            {reqFeedback && <span className="text-[11px] text-amber-600 dark:text-amber-400">{reqFeedback}</span>}
          </div>

          {localRequests.length > 0 && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850 space-y-2.5">
              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block">Tus solicitudes</span>
              {localRequests.map((r: any) => (
                <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-zinc-150/60 dark:border-zinc-850 bg-white/50 dark:bg-zinc-950/40 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">{r.category}</div>
                    <p className="text-[12px] text-zinc-700 dark:text-zinc-300 font-light leading-relaxed mt-0.5">{r.message}</p>
                  </div>
                  <span className={r.status === "Atendida"
                    ? "shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-100"
                    : "shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400"}>
                    {r.status === "Atendida" ? "Atendida" : "Recibida"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {meetings.length === 0 ? (
        <Card className="border border-zinc-200 bg-white/50 p-12 text-center text-zinc-600 dark:text-zinc-450 font-mono text-xs rounded-3xl">
          <AlertCircle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          Todavía no se ha registrado ninguna reunión o visita en este proyecto.
        </Card>
      ) : (
        <div className="space-y-10">

          {/* 1. SECCIÓN DESTACADA: ÚLTIMA REUNIÓN */}
          {latestMeeting && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-450 font-bold">Última reunión</h2>
              </div>

              <Card className="border-2 border-amber-500/25 bg-amber-500/[0.02] dark:bg-zinc-900/40 shadow-sm hover:shadow-md transition-shadow rounded-3xl overflow-hidden">
                {/* Cabecera */}
                <div className="px-6 py-5 border-b border-zinc-150/40 dark:border-zinc-800/50 bg-amber-500/[0.04] dark:bg-zinc-900/60 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                        {(() => {
                          const phase = phases.find(p => p.id === latestMeeting.phase_id);
                          return phase ? `${phase.phase_number} • ${phase.name}` : "Reunión General";
                        })()}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold text-zinc-900 dark:text-white mt-1">
                      {latestMeeting.title}
                    </CardTitle>
                  </div>

                  <div className="flex items-center space-x-2 text-zinc-600 dark:text-zinc-400 font-mono text-[10px] bg-white dark:bg-zinc-950 px-3.5 py-1.5 rounded-full border border-zinc-200/50 dark:border-zinc-800 self-start sm:self-auto shadow-2xs">
                    <Clock className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span>{formatDateEs(latestMeeting.meeting_date)}</span>
                  </div>
                </div>

                {/* Contenido */}
                <CardContent className="p-6 space-y-6 text-xs leading-relaxed">

                  {/* Resumen */}
                  {latestMeeting.summary && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Resumen de la visita</span>
                      <p className="text-zinc-650 dark:text-zinc-350 font-light text-[12px] leading-relaxed">
                        {latestMeeting.summary}
                      </p>
                    </div>
                  )}

                  {/* Fotos de la reunión */}
                  {photos.filter((ph: any) => ph.meeting_id === latestMeeting.id).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block">Fotos de la reunión</span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {photos.filter((ph: any) => ph.meeting_id === latestMeeting.id).map((photo: any) => (
                          <figure key={photo.id} className="space-y-1">
                            <div className="relative h-24 sm:h-28 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
                              <PhotoImage photo={photo} mode="gallery" fill className="object-cover" />
                            </div>
                            <figcaption className="text-[9px] text-zinc-600 dark:text-zinc-400 truncate">
                              {photoCaption(photo, latestMeeting.meeting_date)}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Acuerdos / Decisiones ("Lo que se ha decidido") */}
                  {latestMeeting.decisions_summary && (
                    <div className="p-4 bg-zinc-500/[0.04] dark:bg-zinc-500/5 border border-zinc-500/10 rounded-2xl space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-zinc-600 dark:text-zinc-400 text-xs">
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                        <span>Lo que se ha decidido</span>
                      </div>
                      <p className="text-zinc-650 dark:text-zinc-300 font-light italic pl-6 text-[11px] leading-relaxed">
                        &quot;{latestMeeting.decisions_summary}&quot;
                      </p>
                    </div>
                  )}

                  {/* Tareas Pendientes ("Lo que queda pendiente") */}
                  {(latestMeeting.client_tasks || latestMeeting.studio_tasks) && (
                    <div className="space-y-3 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Lo que queda pendiente</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Tareas del Cliente */}
                        <div className="p-3.5 bg-white dark:bg-zinc-950/40 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 space-y-2 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="font-mono text-[9px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold flex items-center gap-1">
                              <User className="h-3.5 w-3.5" /> Tareas asignadas a ti:
                            </span>
                            <p className="text-zinc-600 dark:text-zinc-350 font-sans font-light leading-relaxed pl-1">
                              {latestMeeting.client_tasks || "Ninguna tarea pendiente asignada."}
                            </p>
                          </div>
                        </div>

                        {/* Tareas del Estudio */}
                        <div className="p-3.5 bg-white dark:bg-zinc-950/40 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 space-y-2 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="font-mono text-[9px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-1">
                              <Wrench className="h-3.5 w-3.5" /> Trabajos del estudio DLX:
                            </span>
                            <p className="text-zinc-600 dark:text-zinc-350 font-sans font-light leading-relaxed pl-1">
                              {latestMeeting.studio_tasks || "Ningún trabajo pendiente asignado."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Próximos pasos ("Próximos pasos") */}
                  {latestMeeting.next_steps && (
                    <div className="space-y-2 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] font-bold">
                        <Footprints className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        <span>Próximos pasos</span>
                      </div>
                      <p className="text-zinc-650 dark:text-zinc-350 font-light pl-5.5">
                        {latestMeeting.next_steps}
                      </p>
                    </div>
                  )}

                  {/* Documentos Vinculados */}
                  {(() => {
                    const phaseDocs = documents.filter(d => d.phase_id === latestMeeting.phase_id);
                    if (phaseDocs.length === 0) return null;

                    return (
                      <div className="space-y-2.5 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                        <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Documentación y Actas en PDF:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {phaseDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/20 p-3 rounded-2xl">
                              <div className="flex items-center space-x-2.5 overflow-hidden">
                                <FileText className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-450 shrink-0" />
                                <div className="overflow-hidden pr-2">
                                  <span className="font-semibold block truncate text-[11px] text-zinc-850 dark:text-zinc-250">{doc.title}</span>
                                  <span className="text-[9px] text-zinc-600 dark:text-zinc-400 font-mono">{doc.version}{doc.file_size ? ` • ${formatBytes(doc.file_size)}` : ""}</span>
                                </div>
                              </div>
                              <a
                                href={doc.file_url}
                                target="_blank"
                                className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 hover:text-amber-500 font-bold transition-colors shrink-0 ml-3"
                              >
                                Descargar <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                </CardContent>
              </Card>
            </div>
          )}

          {/* 2. SECCIÓN: HISTORIAL DE REUNIONES ANTERIORES */}
          {historyMeetings.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <ClipboardList className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 font-bold">Historial de reuniones anteriores</h2>
              </div>

              <div className="space-y-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">
                {historyMeetings.map((meet) => {
                  const phase = phases.find(p => p.id === meet.phase_id);
                  const phaseDocs = documents.filter(d => d.phase_id === meet.phase_id);

                  return (
                    <div key={meet.id} className="relative animate-in slide-in-from-bottom-2 duration-300">
                      {/* Indicador en timeline */}
                      <div className="absolute -left-[30px] top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-950 bg-zinc-350 dark:bg-zinc-700" />

                      <Card className="border border-zinc-200/70 bg-white/70 dark:border-zinc-850 dark:bg-zinc-900/60 shadow-2xs hover:shadow-xs transition-shadow rounded-2xl overflow-hidden">
                        <CardHeader className="py-4 border-b border-zinc-150/40 dark:border-zinc-800/50 bg-white/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2 font-mono text-[9px]">
                              <span className="bg-zinc-100 dark:bg-zinc-950 text-zinc-650 dark:text-zinc-555 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                                {phase ? `${phase.phase_number} • ${phase.name}` : "Reunión General"}
                              </span>
                            </div>
                            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">
                              {meet.title}
                            </CardTitle>
                          </div>

                          <div className="flex items-center space-x-1.5 text-zinc-600 dark:text-zinc-400 font-mono text-[9px] bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-200/50 dark:border-zinc-850 self-start sm:self-auto">
                            <Clock className="h-3 w-3" />
                            <span>{formatDateEs(meet.meeting_date)}</span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-5 space-y-4 text-xs">
                          {meet.summary && (
                            <p className="text-zinc-650 dark:text-zinc-450 leading-relaxed font-light text-[11px]">{meet.summary}</p>
                          )}

                          {/* Fotos de la reunión */}
                          {photos.filter((ph: any) => ph.meeting_id === meet.id).length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block">Fotos de la reunión</span>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {photos.filter((ph: any) => ph.meeting_id === meet.id).map((photo: any) => (
                                  <figure key={photo.id} className="space-y-1">
                                    <div className="relative h-20 sm:h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
                                      <PhotoImage photo={photo} mode="gallery" fill className="object-cover" />
                                    </div>
                                    <figcaption className="text-[9px] text-zinc-600 dark:text-zinc-400 truncate">
                                      {photoCaption(photo, meet.meeting_date)}
                                    </figcaption>
                                  </figure>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Acuerdos / Decisiones ("Lo que se ha decidido") */}
                          {meet.decisions_summary && (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl space-y-1.5 border border-zinc-150/40 dark:border-zinc-800/50">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Lo que se ha decidido</span>
                              <p className="text-zinc-600 dark:text-zinc-300 font-light italic pl-1 leading-relaxed text-[10.5px]">
                                &quot;{meet.decisions_summary}&quot;
                              </p>
                            </div>
                          )}

                          {/* Tareas Pendientes */}
                          {(meet.client_tasks || meet.studio_tasks) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-150/40 dark:border-zinc-800/30 text-[10px] font-mono">
                              <div className="space-y-1">
                                <span className="text-zinc-600 dark:text-zinc-400 uppercase tracking-widest block font-bold">Tareas asignadas a ti:</span>
                                <span className="text-zinc-700 dark:text-zinc-350 block font-sans font-light leading-relaxed">
                                  👤 {meet.client_tasks || "Ninguna"}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <span className="text-zinc-600 dark:text-zinc-400 uppercase tracking-widest block font-bold">Trabajos del estudio:</span>
                                <span className="text-zinc-700 dark:text-zinc-350 block font-sans font-light leading-relaxed">
                                  🔧 {meet.studio_tasks || "Ninguno"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Próximos Pasos */}
                          {meet.next_steps && (
                            <div className="pt-2.5 border-t border-zinc-150/40 dark:border-zinc-800/30">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Próximos pasos:</span>
                              <p className="text-zinc-650 dark:text-zinc-450 font-light mt-0.5 pl-1">
                                {meet.next_steps}
                              </p>
                            </div>
                          )}

                          {/* Documentos Vinculados */}
                          {phaseDocs.length > 0 && (
                            <div className="space-y-1.5 pt-3 border-t border-zinc-150/40 dark:border-zinc-800/30">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Documentos adjuntos:</span>
                              <div className="space-y-2">
                                {phaseDocs.map((doc) => (
                                  <div key={doc.id} className="flex items-center justify-between text-xs border border-zinc-200/50 bg-white/40 dark:border-zinc-850 dark:bg-zinc-950/20 p-2.5 rounded-xl max-w-md">
                                    <div className="flex items-center space-x-2 overflow-hidden">
                                      <FileText className="h-4 w-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                      <div className="overflow-hidden pr-2">
                                        <span className="font-semibold block truncate text-[10.5px] text-zinc-800 dark:text-zinc-250">{doc.title}</span>
                                        <span className="text-[8.5px] text-zinc-600 dark:text-zinc-400 font-mono block">{doc.version}{doc.file_size ? ` • ${formatBytes(doc.file_size)}` : ""}</span>
                                      </div>
                                    </div>
                                    <a
                                      href={doc.file_url}
                                      target="_blank"
                                      className="flex items-center gap-1 text-[9.5px] font-mono text-zinc-650 hover:text-amber-500 font-bold transition-colors shrink-0 ml-3"
                                    >
                                      Descargar <Download className="h-3 w-3" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
