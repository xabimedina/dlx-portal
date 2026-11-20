"use client";

import React, { useState, useTransition } from "react";
import {
  CheckSquare, Award, AlertCircle,
  Check, FileText, Download, RefreshCw, Clock
} from "lucide-react";
import { Profile } from "@/lib/firebase/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { validateDecisionAction, requestDecisionReviewAction } from "../../../actions";
import { PhotoImage } from "@/components/photo-image";
import { useToast, ToastViewport } from "@/components/toast";
import { formatDateEs } from "@/lib/format-date-es";

interface DecisionsClientProps {
  initialDecisions: any[];
  phases: any[];
  documents: any[];
  photos?: any[];
  projectId: string;
  profile: Profile;
}

/**
 * Traducción de los estados internos de decisión a lenguaje cliente: los
 * literales del modelo («En revisión», «Votado»…) nunca llegan al DOM.
 */
const DECISION_STATUS_LABELS: Record<string, string> = {
  "Pendiente": "Pendiente de ti",
  "En revisión": "Esperando al estudio",
  "Votado": "Registrada",
  "Validada": "Validada",
  "Cancelado": "Descartada",
  "Descartada": "Descartada",
  "Modificada": "Modificada",
};

export function DecisionsClient({
  initialDecisions,
  phases,
  documents,
  photos = [],
  projectId,
  profile,
}: DecisionsClientProps) {
  void projectId; void profile;
  // Formateador de bytes a Megabytes o Kilobytes
  const formatBytes = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Estado de filtrado
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [phaseFilter, setPhaseFilter] = useState<string>("todas");

  // Estado de comentarios/respuestas por decisión
  const [clientComments, setClientComments] = useState<Record<string, string>>({});

  // Transiciones y Toasts
  const [isPending, startTransition] = useTransition();
  const { toast, showToast, dismissToast } = useToast();

  // Manejador de Acción: Validar Decisión
  const handleValidateDecision = async (decisionId: string) => {
    const comment = clientComments[decisionId] || "";

    startTransition(async () => {
      try {
        await validateDecisionAction(decisionId, comment);
        showToast("¡Decisión validada y guardada con éxito!", "success");
      } catch (err: any) {
        console.error(err);
        showToast("No se pudo validar la decisión.", "error");
      }
    });
  };

  // Manejador de Acción: Solicitar Revisión
  const handleRequestReview = async (decisionId: string) => {
    const comment = clientComments[decisionId] || "";
    if (!comment.trim()) {
      showToast("Escribe primero el motivo por el que pides la revisión.", "error");
      return;
    }

    startTransition(async () => {
      try {
        await requestDecisionReviewAction(decisionId, comment);
        showToast("Se ha solicitado la revisión al arquitecto de DLX.", "success");
      } catch (err: any) {
        console.error(err);
        showToast("No se pudo enviar la solicitud de revisión.", "error");
      }
    });
  };

  // Filtrado de Decisiones en Cliente
  const filteredDecisions = initialDecisions.filter(dec => {
    const matchesStatus = statusFilter === "todos" || dec.status === statusFilter;
    const matchesPhase = phaseFilter === "todas" || dec.phase_id === phaseFilter;
    return matchesStatus && matchesPhase;
  });

  return (
    <div className="space-y-8">

      {/* Cabecera y Microcopy */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em]">
          <CheckSquare className="h-3.5 w-3.5 text-zinc-500" />
          <span>Toma de decisiones</span>
        </div>
        <h1 className="display-portal text-zinc-900 dark:text-white">
          Decisiones
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
          Cada detalle cuenta. Aquí puedes elegir acabados, calidades o luminarias sugeridas por el estudio, resolver dudas y dar tu aprobación oficial para que los trabajos avancen con tu total tranquilidad.
        </p>
      </div>

      {/* CONTENEDOR DE FILTROS */}
      <Card className="border border-zinc-200/50 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/60 p-5 shadow-xs rounded-3xl backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs font-mono">
          {/* 1. Filtro por Estado */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">Estado de la Decisión</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-850 dark:bg-zinc-950 px-3.5 py-2 text-xs focus-visible:outline-none"
            >
              <option value="todos">-- Todos los estados --</option>
              <option value="Pendiente">Pendiente de ti</option>
              <option value="En revisión">Esperando al estudio</option>
              <option value="Validada">Validada (cerrada)</option>
            </select>
          </div>

          {/* 2. Filtro por Fase */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">Filtrar por Fase de Obra</label>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-850 dark:bg-zinc-950 px-3.5 py-2 text-xs focus-visible:outline-none"
            >
              <option value="todas">-- Todas las fases --</option>
              {phases.map(p => (
                <option key={p.id} value={p.id}>{p.phase_number}: {p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* LISTADO DE DECISIONES */}
      <div className="space-y-6">
        {filteredDecisions.length > 0 ? (
          filteredDecisions.map((decision) => {
            const phase = phases.find(p => p.id === decision.phase_id);
            const linkedDoc = documents.find(d => d.id === decision.document_id);

            // Estado Votos
            const isPendingVote = decision.status === "Pendiente";
            const isUnderReview = decision.status === "En revisión";
            const isValidated = decision.status === "Validada";
            const isDiscarded = decision.status === "Descartada" || decision.status === "Cancelado";
            const isModified = decision.status === "Modificada";

            // Estilo de Badges de Estado
            let stateBadgeClass = "bg-zinc-100 text-zinc-650 dark:text-zinc-550 border-zinc-200";
            if (isPendingVote) stateBadgeClass = "bg-saffron-100 text-zinc-800 border-amber-500";
            if (isUnderReview) stateBadgeClass = "bg-saffron-100 text-zinc-800 border-amber-500";
            if (isValidated) stateBadgeClass = "bg-zinc-500/10 text-zinc-600 border-zinc-500/25 font-bold";
            if (isDiscarded) stateBadgeClass = "bg-zinc-150 text-zinc-600 dark:text-zinc-400 border-zinc-200 line-through";
            if (isModified) stateBadgeClass = "bg-zinc-500/10 text-zinc-600 border-zinc-500/25";

            // Estilo de Badges de Prioridad
            let priorityBadgeClass = "bg-zinc-100 text-zinc-600 dark:text-zinc-500 border-zinc-200";
            if (decision.priority === "Urgente") priorityBadgeClass = "bg-saffron-100 text-zinc-800 font-bold border-amber-500";
            if (decision.priority === "Alta") priorityBadgeClass = "bg-saffron-100 text-zinc-800 font-bold border-amber-500";

            // Comentario escrito actualmente por el cliente en cliente
            const typedComment = clientComments[decision.id] || "";

            return (
              <Card
                key={decision.id}
                className={`border bg-white/70 dark:bg-zinc-900/60 shadow-xs hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden ${
                  isValidated
                    ? "border-zinc-200/50 dark:border-zinc-800/50 opacity-90"
                    : isDiscarded
                      ? "border-zinc-200/30 opacity-70 bg-zinc-100/10"
                      : "border-zinc-200/80 dark:border-zinc-800/80"
                }`}
              >
                <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 py-4.5 border-b border-zinc-150/40 dark:border-zinc-800/50 bg-white/30">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] bg-zinc-100 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-450 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                        {phase ? `${phase.phase_number} • ${phase.name}` : "Diseño General"}
                      </span>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider border ${priorityBadgeClass}`}>
                        {decision.priority}
                      </span>
                    </div>
                    <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">
                      {decision.title}
                    </CardTitle>
                  </div>

                  <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border self-start sm:self-auto ${stateBadgeClass}`}>
                    {DECISION_STATUS_LABELS[decision.status] || "En proceso"}
                  </span>
                </CardHeader>

                <CardContent className="pt-4 text-xs space-y-4">
                  {/* Descripción */}
                  <p className={`text-zinc-700 dark:text-zinc-300 leading-relaxed text-[12px] ${
                    isDiscarded ? "line-through opacity-70" : ""
                  }`}>
                    {decision.description}
                  </p>

                  {/* Sugerencia dlx */}
                  {decision.studio_recommendation && !isDiscarded && (
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-150/40 dark:border-zinc-800/40 text-xs flex items-start space-x-2.5">
                      <Award className="h-4.5 w-4.5 text-zinc-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">Recomendación Técnica del Estudio DLX:</span>
                        <p className="text-zinc-700 dark:text-zinc-300 mt-0.5 leading-relaxed">{decision.studio_recommendation}</p>
                      </div>
                    </div>
                  )}

                  {/* Fotos de la decisión (adjuntas desde el estudio) */}
                  {photos.filter((ph: any) => ph.decision_id === decision.id).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block">Fotos de la decisión</span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {photos.filter((ph: any) => ph.decision_id === decision.id).map((photo: any) => (
                          <figure key={photo.id} className="space-y-1">
                            <div className="relative h-24 sm:h-28 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
                              <PhotoImage photo={photo} mode="gallery" fill className="object-cover" />
                            </div>
                            <figcaption className="text-[9px] text-zinc-600 dark:text-zinc-400 truncate">
                              {[photo.room, "Decisión"].filter(Boolean).join(" · ")}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documento Vinculado */}
                  {linkedDoc && (
                    <div className="space-y-1.5 pt-1 border-t border-zinc-150/20 dark:border-zinc-800/20">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block">Muestra / Plano Vinculado:</span>
                      <div className="flex items-center justify-between text-xs border border-zinc-200/50 bg-white/40 dark:border-zinc-800 dark:bg-zinc-950/20 p-3 rounded-2xl max-w-md">
                        <div className="flex items-center space-x-2.5 overflow-hidden">
                          <FileText className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-500 shrink-0" />
                          <div className="overflow-hidden pr-2">
                            <span className="font-semibold block truncate text-[11px] text-zinc-800 dark:text-zinc-250">{linkedDoc.title}</span>
                            <span className="text-[9px] text-zinc-600 dark:text-zinc-400 font-mono">{linkedDoc.version}{linkedDoc.file_size ? ` • ${formatBytes(linkedDoc.file_size)}` : ""}</span>
                          </div>
                        </div>
                        <a
                          href={linkedDoc.file_url}
                          target="_blank"
                          className="flex items-center gap-1 text-[10px] font-mono text-zinc-650 hover:text-zinc-950 font-bold transition-colors shrink-0 ml-3"
                        >
                          Descargar <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Historial o comentario consolidado del cliente */}
                  {(isValidated || isUnderReview) && decision.client_response && (
                    <div className={`p-3.5 rounded-2xl text-xs space-y-1.5 ${
                      isValidated
                        ? "bg-zinc-500/5 border border-zinc-500/10"
                        : "bg-amber-500/5 border border-amber-500/10"
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        {isValidated ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-500 bg-zinc-500/10 p-0.5 rounded-full" />
                            <span className="text-zinc-600 dark:text-zinc-400">Validado y Cerrado</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5 text-zinc-500 bg-amber-500/10 p-0.5 rounded-full" />
                            <span className="text-zinc-800 dark:text-amber-400">Petición de Revisión Enviada</span>
                          </>
                        )}
                      </div>
                      <div className="pl-5 space-y-1">
                        <p className="text-zinc-700 dark:text-zinc-300 italic">
                          &quot;{decision.client_response}&quot;
                        </p>
                        {decision.validated_at && (
                          <p className="text-[9px] text-zinc-600 dark:text-zinc-400 font-mono">
                            Registrado el {formatDateEs(decision.validated_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inputs del Cliente (Solo habilitado si está Pendiente o esperando al estudio) */}
                  {!isDiscarded && !isValidated && (
                    <div className="space-y-3 pt-3 border-t border-zinc-150/40 dark:border-zinc-800/40">
                      <div className="space-y-1.5">
                        <label htmlFor={`comment-${decision.id}`} className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block">
                          Tu Respuesta / Comentarios o Dudas:
                        </label>
                        <textarea
                          id={`comment-${decision.id}`}
                          value={typedComment}
                          onChange={(e) => setClientComments({
                            ...clientComments,
                            [decision.id]: e.target.value
                          })}
                          disabled={isPending}
                          placeholder="Escribe aquí tu elección técnica (ej. 'Opción B: Latón'), dudas específicas sobre las muestras, o indicaciones especiales..."
                          className="w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-850 dark:bg-zinc-950 px-3.5 py-2.5 text-xs min-h-[80px] text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                        <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-400" />
                          {decision.due_date ? (
                            <>Fecha sugerida de respuesta: <strong className="text-zinc-800">{formatDateEs(decision.due_date)}</strong></>
                          ) : (
                            <>Sin fecha límite: respóndela cuando puedas</>
                          )}
                        </span>

                        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                          <Button
                            onClick={() => handleRequestReview(decision.id)}
                            disabled={isPending || !typedComment.trim()}
                            variant="outline"
                            className="text-[11px] font-semibold uppercase tracking-[0.12em] border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 shadow-xs h-10 sm:h-9 shrink-0 w-full sm:w-auto"
                          >
                            Solicitar revisión
                          </Button>

                          <Button
                            onClick={() => handleValidateDecision(decision.id)}
                            disabled={isPending}
                            className="text-[11px] font-semibold uppercase tracking-[0.12em] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-xs h-10 sm:h-9 shrink-0 w-full sm:w-auto flex items-center justify-center gap-1"
                          >
                            {isPending ? (
                              <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Procesando...</>
                            ) : (
                              <><Check className="h-4 w-4" /> Validar decisión</>
                            )}
                          </Button>
                        </div>
                      </div>

                    </div>
                  )}

                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border border-zinc-200 bg-white/50 p-12 text-center text-zinc-600 dark:text-zinc-450 font-mono text-xs rounded-3xl">
            <AlertCircle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
            Ninguna decisión coincide con los filtros aplicados.
          </Card>
        )}
      </div>

      {/* Toast Notification flotante */}
      <ToastViewport toast={toast} onDismiss={dismissToast} />

    </div>
  );
}
