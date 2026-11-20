import React from "react";
import Link from "next/link";
import {
  Layers, Calendar, Check, Sparkles, ArrowUpRight, Download
} from "lucide-react";
import { getPhases, getMeetings, getDecisions, getDocuments } from "@/lib/firebase/db";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhaseState } from "@/lib/phase-status";
import { getPhaseDelay } from "@/lib/phase-delay";
import { phaseStatusClientLabel } from "@/lib/phase-status-client";
import { isConfirmedMeeting } from "@/lib/actions-aggregator";
import { formatDateEs } from "@/lib/format-date-es";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ClientProjectPhasesPage({ params }: PageProps) {
  const { projectId } = await params;

  const pageAccess = await getProjectPageAccess(projectId);
  if (pageAccess.mode === "denied") {
    return (
      <AccessRestricted
        message={
          pageAccess.profile.role === 'client'
            ? "No tienes autorización para acceder a las fases de este proyecto de obra."
            : "No se ha encontrado el proyecto seleccionado."
        }
      />
    );
  }
  let phases: any[] = [];
  let meetings: any[] = [];
  let decisions: any[] = [];
  let documents: any[] = [];

  try {
    const [phasesData, meetingsData, decisionsData, documentsData] = await Promise.all([
      getPhases(projectId),
      getMeetings(projectId),
      getDecisions(projectId),
      getDocuments(projectId),
    ]);
    phases = phasesData || [];
    meetings = meetingsData || [];
    decisions = decisionsData || [];
    documents = documentsData || [];
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de fases:", err);
  }

  // Las actas borrador no existen para el cliente
  meetings = meetings.filter(isConfirmedMeeting);

  // Formateador de bytes
  const formatBytes = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8">

      {/* Cabecera y Microcopy */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em]">
          <Layers className="h-3.5 w-3.5 text-zinc-500" />
          <span>Fases de tu proyecto</span>
        </div>
        <h1 className="display-portal text-zinc-900 dark:text-white">
          El camino
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
          Desde la primera idea en el papel hasta la entrega de tus llaves. Aquí puedes visualizar cronológicamente el estado de cada fase técnica, los acuerdos tomados y los documentos oficiales.
        </p>
      </div>

      {/* Timeline completo de Fases */}
      <div className="relative pl-8 border-l-2 border-zinc-200 dark:border-zinc-800 ml-4 space-y-8 py-4">
        {phases.map((phase) => {
          const status = phase.status;
          const phaseState = getPhaseState(status);
          const isComplete = phaseState === "complete";
          const isCurrent = phaseState === "current";

          // 1. Configuración de estilos visuales
          let ringClass = "bg-zinc-200 border-white dark:bg-zinc-800 dark:border-zinc-950 ring-transparent";
          let cardClass = "border-zinc-200/60 bg-white/70 dark:border-zinc-800/60 dark:bg-zinc-900/40 opacity-80";
          let badgeClass = "bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-550 border-zinc-250/20";
          let phaseIndicator = "";

          if (isComplete) {
            // Fases ya validadas: Sentirse cerradas y tranquilas (tonos suaves verdosos o zinc apacibles)
            ringClass = "bg-zinc-500 border-white dark:border-zinc-950 ring-zinc-500/15";
            cardClass = "border-zinc-200/40 bg-zinc-50/40 dark:border-zinc-850/30 dark:bg-zinc-900/10 opacity-75 shadow-none";
            badgeClass = "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/5 dark:text-zinc-400/90 border-zinc-500/20 font-bold";
          } else if (isCurrent) {
            // Fase actual destacada visualmente
            ringClass = "bg-amber-500 border-white dark:border-zinc-950 ring-amber-500/20";
            cardClass = "border-amber-500/30 bg-white/95 dark:border-amber-500/20 dark:bg-zinc-900/80 shadow-md ring-1 ring-amber-500/10 scale-[1.005] translate-x-0.5";
            badgeClass = "bg-amber-600 text-white dark:bg-amber-500/25 dark:text-amber-300 font-bold border-transparent";
            phaseIndicator = "Fase Activa";
          } else {
            // Fases pendientes: NO deben parecer errores, sino quietas y de trazo suave
            ringClass = "bg-zinc-150 border-white dark:bg-zinc-800 dark:border-zinc-950 ring-transparent";
            cardClass = "border-dashed border-zinc-200 bg-white/30 dark:border-zinc-800/60 dark:bg-zinc-900/15 opacity-70 shadow-none";
            badgeClass = "bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-500 border-zinc-200/40";
          }

          // Retraso derivado de la fecha objetivo (solo se comunica en fases abiertas)
          const delay = getPhaseDelay(phase);

          // 2. Extraer datos relacionados a esta fase
          const phaseDocs = documents.filter(d => d.phase_id === phase.id);
          const phaseDecsPending = decisions.filter(d => d.phase_id === phase.id && d.status === "Pendiente");
          const phaseDecsValidated = decisions.filter(d => d.phase_id === phase.id && (d.status === "Votado" || d.status === "Validada"));
          const phaseMeets = meetings.filter(m => m.phase_id === phase.id);

          return (
            <div key={phase.id} className="relative animate-in slide-in-from-bottom-4 duration-350">
              {/* Punto indicador de la línea de tiempo */}
              <div className={`absolute -left-[39px] top-2 h-3.5 w-3.5 rounded-full border-2 ring-4 ${ringClass} transition-all duration-500`} />

              <Card className={`border shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md ${cardClass}`}>
                <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 py-4.5 border-b border-zinc-150/40 dark:border-zinc-800/50">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[9px] bg-zinc-100 text-zinc-650 dark:bg-zinc-950 dark:text-zinc-400 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                        {phase.phase_number}
                      </span>
                      {phaseIndicator && (
                        <span className="font-mono text-[10px] bg-amber-500/10 text-zinc-800 dark:bg-amber-500/20 dark:text-amber-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          {phaseIndicator}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">
                      {phase.name}
                    </CardTitle>
                    {phase.target_end_date && (
                      <p className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                        <Calendar className="h-3 w-3 shrink-0 text-zinc-500" />
                        <span>Fecha objetivo: {formatDateEs(phase.target_end_date)}</span>
                        {delay && !delay.closed && (
                          <span className="font-semibold text-zinc-800 dark:text-amber-400">
                            · {delay.days === 1 ? "1 día" : `${delay.days} días`} de retraso
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border self-start sm:self-auto ${badgeClass}`}>
                    {phaseStatusClientLabel(phase.status)}
                  </span>
                </CardHeader>

                <CardContent className="pt-4 text-xs space-y-4">
                  {/* Descripción de la Fase */}
                  <p className="text-zinc-650 dark:text-zinc-400 leading-relaxed text-[11px]">
                    {phase.description}
                  </p>

                  {/* Próximos pasos específicos si es la fase activa */}
                  {isCurrent && (
                    <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 rounded-2xl space-y-2">
                      <div className="flex items-center space-x-1.5 text-zinc-800 dark:text-amber-400 font-bold font-mono text-[9px] uppercase tracking-wider">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Lo que estamos haciendo ahora</span>
                      </div>
                      <p className="text-[11px] text-zinc-650 dark:text-zinc-350 leading-relaxed">
                        Estamos centrados en concluir esta fase para poder pasar a la siguiente etapa. Puedes seguir el avance diario en el <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Diario de Obra</strong> o revisar los planos vinculados a continuación.
                      </p>
                    </div>
                  )}

                  {/* Contenedor relacional de Ficheros, Decisiones y Actas */}
                  {(phaseDocs.length > 0 || phaseDecsPending.length > 0 || phaseDecsValidated.length > 0 || phaseMeets.length > 0) ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40 text-[10px] font-mono leading-relaxed">

                      {/* 1. Documentos vinculados */}
                      <div className="space-y-2">
                        <span className="text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-bold block">DOCUMENTOS ({phaseDocs.length})</span>
                        {phaseDocs.length === 0 ? (
                          <span className="text-zinc-600 dark:text-zinc-400 italic block">Sin documentos enlazados</span>
                        ) : (
                          <div className="space-y-1.5 font-sans">
                            {phaseDocs.map(doc => (
                              <a
                                key={doc.id}
                                href={doc.file_url}
                                target="_blank"
                                className="flex items-center justify-between text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-amber-400 border border-zinc-200/40 dark:border-zinc-800 p-2 rounded-xl bg-white/40 dark:bg-zinc-950/20 transition-colors"
                              >
                                <div className="overflow-hidden pr-2">
                                  <span className="font-semibold block truncate text-[11px]">{doc.title}</span>
                                  <span className="text-[9px] text-zinc-600 dark:text-zinc-400 font-mono">{doc.version}{doc.file_size ? ` • ${formatBytes(doc.file_size)}` : ""}</span>
                                </div>
                                <Download className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Decisiones vinculadas */}
                      <div className="space-y-2">
                        <span className="text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-bold block">TUS ELECCIONES ({phaseDecsPending.length + phaseDecsValidated.length})</span>

                        {(phaseDecsPending.length === 0 && phaseDecsValidated.length === 0) ? (
                          <span className="text-zinc-600 dark:text-zinc-400 italic block">Sin decisiones requeridas</span>
                        ) : (
                          <div className="space-y-1.5">
                            {/* Decisiones Pendientes */}
                            {phaseDecsPending.map(dec => (
                              <Link
                                key={dec.id}
                                href={`/dashboard/projects/${projectId}/decisions`}
                                className="flex items-start p-2 border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl hover:border-amber-500/40 transition-colors group"
                              >
                                <div className="overflow-hidden flex-grow pr-1.5 font-sans">
                                  <span className="text-[9px] font-mono text-zinc-800 dark:text-amber-400 uppercase font-bold block">TE TOCA DECIDIR</span>
                                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate text-[11px] mt-0.5">{dec.title}</span>
                                  {dec.due_date && (
                                    <span className="text-[9px] text-zinc-800 font-mono block mt-0.5">Antes del {formatDateEs(dec.due_date)}</span>
                                  )}
                                </div>
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 mt-0.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                              </Link>
                            ))}

                            {/* Decisiones ya respondidas */}
                            {phaseDecsValidated.map(dec => (
                              <div
                                key={dec.id}
                                className="p-2 border border-zinc-200/50 bg-zinc-50/50 dark:border-zinc-800/40 dark:bg-zinc-950/20 rounded-xl flex items-start gap-1.5 font-sans"
                              >
                                <Check className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-500 bg-zinc-500/10 p-0.5 rounded-full shrink-0 mt-0.5" />
                                <div className="overflow-hidden">
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-350 block truncate text-[10px]">{dec.title}</span>
                                  <span className="text-[9px] text-zinc-600 dark:text-zinc-400 block mt-0.5 truncate">Elegiste: <strong className="font-semibold text-zinc-600 dark:text-zinc-300">{dec.client_response}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 3. Reuniones vinculadas */}
                      <div className="space-y-2">
                        <span className="text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-bold block">CITAS Y REUNIONES ({phaseMeets.length})</span>
                        {phaseMeets.length === 0 ? (
                          <span className="text-zinc-600 dark:text-zinc-400 italic block">Ninguna visita en esta fase</span>
                        ) : (
                          <div className="space-y-1.5 font-sans">
                            {phaseMeets.map(meet => (
                              <Link
                                key={meet.id}
                                href={`/dashboard/projects/${projectId}/meetings`}
                                className="block p-2 border border-zinc-200/40 dark:border-zinc-800 rounded-xl bg-white/40 dark:bg-zinc-950/20 hover:border-zinc-350 transition-colors"
                              >
                                <div className="flex justify-between items-start font-mono text-[8px] text-zinc-600 dark:text-zinc-400">
                                  <span>VISITA OFICIAL</span>
                                  <span>{formatDateEs(meet.meeting_date)}</span>
                                </div>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200 block truncate text-[10px] mt-0.5" title={meet.title}>
                                  {meet.title}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  ) : null}

                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

    </div>
  );
}
