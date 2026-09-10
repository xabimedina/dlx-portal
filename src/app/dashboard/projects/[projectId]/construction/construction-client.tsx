"use client";

import React, { useState } from "react";
import {
  AlertCircle, Wrench, Footprints,
  ClipboardList, Sparkles, HardHat, AlertTriangle, HelpCircle,
  ZoomIn, X
} from "lucide-react";
import { Profile } from "@/lib/firebase/profile";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { PhotoImage } from "@/components/photo-image";
import { weekLabel } from "@/lib/week-label";
import { gremiosDeAsistentes } from "@/lib/attendees";
import { formatDateEs } from "@/lib/format-date-es";

interface ConstructionClientProps {
  weeklyUpdates: any[];
  phases: any[];
  photos: any[];
  projectId: string;
  profile: Profile;
}

export function ConstructionClient({
  weeklyUpdates,
  phases,
  photos,
  projectId,
  profile,
}: ConstructionClientProps) {
  void phases; void projectId; void profile;

  // Estado del Lightbox de fotos
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);

  // Estado de carga progresiva por semana (limita fotos mostradas inicialmente)
  const [expandedGalleries, setExpandedGalleries] = useState<Record<string, boolean>>({});

  // Ordenar actualizaciones semanales de más reciente a más antigua
  const sortedUpdates = [...weeklyUpdates].sort((a, b) => b.week_number - a.week_number);

  const latestUpdate = sortedUpdates[0];
  const historyUpdates = sortedUpdates.slice(1);

  // Pie obligatorio de toda miniatura: {estancia} · {procedencia}
  const photoCaption = (photo: any, weekNumber: number) =>
    [photo.room, weekLabel(weekNumber)].filter(Boolean).join(" · ");

  // Toggle de visualización progresiva de fotos
  const toggleGallery = (updateId: string) => {
    setExpandedGalleries(prev => ({
      ...prev,
      [updateId]: !prev[updateId]
    }));
  };

  return (
    <div className="space-y-10">

      {/* Cabecera y Introducción */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em]">
          <HardHat className="h-3.5 w-3.5 text-amber-500" />
          <span>Seguimiento semanal</span>
        </div>
        <h1 className="text-3xl font-light tracking-tight text-zinc-900 dark:text-white leading-tight">
          Diario de obra
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-light max-w-xl">
          Toda la obra, bajo control. A continuación encontrarás el reporte semanal de visitas técnicas redactado por tu arquitecto de Despeja la X, documentando el estado de ejecución, las calidades colocadas y un carrete de fotos de los avances.
        </p>
      </div>

      {weeklyUpdates.length === 0 ? (
        <Card className="border border-zinc-200 bg-white/50 p-12 text-center text-zinc-600 dark:text-zinc-450 font-mono text-xs rounded-3xl">
          <AlertCircle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          No hay reportes de obra semanales publicados para este proyecto todavía.
        </Card>
      ) : (
        <div className="space-y-10">

          {/* 1. SECCIÓN DESTACADA: ÚLTIMA VISITA DE OBRA */}
          {latestUpdate && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-450 font-bold">Última visita de obra</h2>
              </div>

              <Card className="border-2 border-amber-500/25 bg-amber-500/[0.01] dark:bg-zinc-900/40 shadow-md hover:shadow-lg transition-shadow rounded-3xl overflow-hidden">
                {/* Cabecera */}
                <div className="px-6 py-5 border-b border-zinc-150/40 dark:border-zinc-800/50 bg-amber-500/[0.03] dark:bg-zinc-900/60 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        {weekLabel(latestUpdate.week_number)}
                      </span>
                      <span className="font-mono text-[9px] bg-zinc-100 text-zinc-600 dark:text-zinc-500 dark:bg-zinc-950 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                        Actualización de Visita
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold text-zinc-900 dark:text-white mt-1">
                      {latestUpdate.title}
                    </CardTitle>
                  </div>

                  {/* Porcentaje de Avance */}
                  <div className="bg-white dark:bg-zinc-950 p-3.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 self-start sm:self-auto text-center shrink-0 min-w-[110px] shadow-3xs">
                    <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 tracking-wider block uppercase">Avance Real</span>
                    <span className="text-2xl font-light font-mono block text-zinc-950 dark:text-white mt-0.5">{latestUpdate.progress_percentage}%</span>
                  </div>
                </div>

                {/* Contenido */}
                <CardContent className="p-6 space-y-6 text-xs leading-relaxed">

                  {/* Barra de progreso visual */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-200/20">
                      <div className="bg-amber-500 h-full rounded-full transition-all duration-1000" style={{ width: `${latestUpdate.progress_percentage}%` }} />
                    </div>
                  </div>

                  {/* Asistentes a la visita de obra (industriales) */}
                  {latestUpdate.attendees && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Revisado en obra por</span>
                      <p className="text-zinc-650 dark:text-zinc-350 font-light text-[12px] leading-relaxed">
                        {gremiosDeAsistentes(latestUpdate.attendees).join(" · ")}
                      </p>
                    </div>
                  )}

                  {/* Resumen ("Lo importante de esta semana") */}
                  {latestUpdate.summary && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Lo importante de esta semana</span>
                      <p className="text-zinc-650 dark:text-zinc-350 font-light text-[12px] leading-relaxed">
                        {latestUpdate.summary}
                      </p>
                    </div>
                  )}

                  {/* Trabajos realizados ("Trabajos realizados") */}
                  {latestUpdate.current_work && (
                    <div className="space-y-2 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold flex items-center gap-1.5">
                        <Wrench className="h-4 w-4 text-zinc-600 dark:text-zinc-400" /> Trabajos realizados
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-350 font-sans font-light leading-relaxed pl-5.5">
                        🔧 {latestUpdate.current_work}
                      </p>
                    </div>
                  )}

                  {/* Incidencias ("Incidencias detectadas") */}
                  {latestUpdate.issues && (
                    <div className="space-y-2 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500/80" /> Incidencias detectadas
                      </span>
                      <div className="p-3.5 bg-amber-500/[0.03] dark:bg-amber-500/5 border border-amber-500/10 rounded-2xl text-[11px] leading-relaxed text-zinc-650 dark:text-zinc-350 font-light">
                        {latestUpdate.issues}
                      </div>
                    </div>
                  )}

                  {/* Decisiones necesarias ("Decisiones necesarias") */}
                  {latestUpdate.decisions_needed && (
                    <div className="space-y-2 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold flex items-center gap-1.5">
                        <HelpCircle className="h-4 w-4 text-amber-500" /> Decisiones necesarias
                      </span>
                      <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 rounded-2xl text-[11px] pl-4 text-zinc-700 dark:text-zinc-350 font-medium">
                        💡 {latestUpdate.decisions_needed}
                      </div>
                    </div>
                  )}

                  {/* Próximos pasos ("Próximos pasos") */}
                  {latestUpdate.next_steps && (
                    <div className="space-y-2 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                      <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold flex items-center gap-1.5">
                        <Footprints className="h-4 w-4 text-zinc-600 dark:text-zinc-450" /> Próximos pasos
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-350 font-sans font-light leading-relaxed pl-5.5">
                        ➡️ {latestUpdate.next_steps}
                      </p>
                    </div>
                  )}

                  {/* Galería de fotos asociada */}
                  {(() => {
                    const updatePhotos = photos.filter(p => p.weekly_update_id === latestUpdate.id);
                    if (updatePhotos.length === 0) return null;

                    const isExpanded = expandedGalleries[latestUpdate.id] || false;
                    // Mostrar solo 4 fotos si no está expandido (carga progresiva)
                    const visiblePhotos = isExpanded ? updatePhotos : updatePhotos.slice(0, 4);

                    return (
                      <div className="space-y-3 pt-5 border-t border-zinc-150/40 dark:border-zinc-800/40">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Fotografías del Reporte ({updatePhotos.length}):</span>
                          {updatePhotos.length > 4 && (
                            <button
                              onClick={() => toggleGallery(latestUpdate.id)}
                              className="font-mono text-[9px] text-amber-600 hover:text-amber-500 font-bold transition-colors uppercase tracking-wider"
                            >
                              {isExpanded ? "Ver menos" : `Ver todas (+${updatePhotos.length - 4})`}
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {visiblePhotos.map((photo) => (
                            <div
                              key={photo.id}
                              onClick={() => setLightboxPhoto(photo)}
                              className="group relative h-28 sm:h-32 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 cursor-pointer shadow-xs bg-zinc-100 dark:bg-zinc-950 transition-all duration-300 hover:scale-[1.01]"
                            >
                              <PhotoImage
                                photo={photo}
                                mode="gallery"
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <ZoomIn className="h-6 w-6 text-white" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-[9px] text-white font-mono truncate">
                                {photoCaption(photo, latestUpdate.week_number)}
                              </div>
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

          {/* 2. SECCIÓN: HISTORIAL DE VISITAS DE OBRA ANTERIORES */}
          {historyUpdates.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <ClipboardList className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-450 font-bold">Bitácoras e historial de obra anterior</h2>
              </div>

              <div className="space-y-6 relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">
                {historyUpdates.map((update) => {
                  const updatePhotos = photos.filter(p => p.weekly_update_id === update.id);
                  const isExpanded = expandedGalleries[update.id] || false;
                  const visiblePhotos = isExpanded ? updatePhotos : updatePhotos.slice(0, 3);

                  return (
                    <div key={update.id} className="relative animate-in slide-in-from-bottom-2 duration-300">
                      {/* Timeline Circle */}
                      <div className="absolute -left-[19px] top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-950 bg-zinc-350 dark:bg-zinc-700" />

                      <Card className="border border-zinc-200/70 bg-white/70 dark:border-zinc-850 dark:bg-zinc-900/60 shadow-2xs hover:shadow-xs transition-shadow rounded-2xl overflow-hidden">
                        <CardHeader className="py-4 border-b border-zinc-150/40 dark:border-zinc-800/50 bg-white/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2 font-mono text-[9px]">
                              <span className="bg-zinc-105 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-500 px-2 py-0.5 rounded font-semibold uppercase tracking-wider border border-zinc-200/30">
                                {weekLabel(update.week_number)}
                              </span>
                            </div>
                            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-white mt-1">
                              {update.title}
                            </CardTitle>
                          </div>

                          {/* Avance */}
                          <div className="flex items-center gap-2 font-mono text-[9px] bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-200/55 dark:border-zinc-850 self-start sm:self-auto">
                            <span className="text-zinc-600 dark:text-zinc-400 uppercase font-light">AVANCE:</span>
                            <span className="font-bold text-zinc-750 dark:text-zinc-200">{update.progress_percentage}%</span>
                          </div>
                        </CardHeader>

                        <CardContent className="p-5 space-y-4 text-xs">

                          {/* Asistentes a la visita de obra */}
                          {update.attendees && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Revisado en obra por</span>
                              <p className="text-zinc-650 dark:text-zinc-450 leading-relaxed font-light text-[11px]">{gremiosDeAsistentes(update.attendees).join(" · ")}</p>
                            </div>
                          )}

                          {/* Summary */}
                          {update.summary && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Lo importante de esta semana</span>
                              <p className="text-zinc-650 dark:text-zinc-450 leading-relaxed font-light text-[11px]">{update.summary}</p>
                            </div>
                          )}

                          {/* Trabajos realizados */}
                          {update.current_work && (
                            <div className="space-y-1 border-t border-zinc-100/60 dark:border-zinc-800/20 pt-3">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Trabajos realizados</span>
                              <p className="text-zinc-650 dark:text-zinc-400 font-light leading-relaxed pl-1">
                                🔧 {update.current_work}
                              </p>
                            </div>
                          )}

                          {/* Incidencias */}
                          {update.issues && (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl space-y-1 border border-zinc-150/40 dark:border-zinc-850">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-amber-500/70" />
                                Incidencias detectadas
                              </span>
                              <p className="text-zinc-600 dark:text-zinc-300 font-light italic pl-1 leading-relaxed text-[10.5px]">
                                {update.issues}
                              </p>
                            </div>
                          )}

                          {/* Decisiones requeridas */}
                          {update.decisions_needed && (
                            <div className="p-3 bg-amber-500/[0.02] border border-amber-500/10 rounded-xl space-y-1">
                              <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-widest block font-bold">Decisiones necesarias</span>
                              <p className="text-zinc-650 dark:text-zinc-350 font-medium pl-1 leading-relaxed text-[10.5px]">
                                💡 {update.decisions_needed}
                              </p>
                            </div>
                          )}

                          {/* Próximos Pasos */}
                          {update.next_steps && (
                            <div className="space-y-1 border-t border-zinc-150/40 dark:border-zinc-800/20 pt-3">
                              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Próximos pasos</span>
                              <p className="text-zinc-650 dark:text-zinc-450 font-light mt-0.5 pl-1">
                                ➡️ {update.next_steps}
                              </p>
                            </div>
                          )}

                          {/* Galería de fotos en cascada */}
                          {updatePhotos.length > 0 && (
                            <div className="space-y-2.5 pt-3.5 border-t border-zinc-150/40 dark:border-zinc-800/20">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Fotografías del Avance ({updatePhotos.length}):</span>
                                {updatePhotos.length > 3 && (
                                  <button
                                    onClick={() => toggleGallery(update.id)}
                                    className="font-mono text-[10px] text-zinc-455 hover:text-amber-500 font-bold transition-colors uppercase tracking-wider"
                                  >
                                    {isExpanded ? "Ver menos" : `Ver todas (+${updatePhotos.length - 3})`}
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                {visiblePhotos.map((photo) => (
                                  <div
                                    key={photo.id}
                                    onClick={() => setLightboxPhoto(photo)}
                                    className="group relative h-20 rounded-xl overflow-hidden border border-zinc-200/50 dark:border-zinc-850 cursor-pointer shadow-3xs bg-zinc-100 dark:bg-zinc-950 transition-all duration-300 hover:scale-[1.01]"
                                  >
                                    <PhotoImage
                                      photo={photo}
                                      mode="gallery"
                                      fill
                                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                      <ZoomIn className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/85 to-transparent text-[8px] text-white font-mono truncate">
                                      {photoCaption(photo, update.week_number)}
                                    </div>
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

      {/* Lightbox / Visor de fotos ampliado */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300"
        >
          {/* Botón de cierre en esquina superior derecha */}
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-6 right-6 p-2 rounded-full bg-zinc-900/60 text-white hover:bg-zinc-800 hover:scale-105 transition-all shadow-md z-[130]"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Wrapper de la imagen */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl h-[65vh] md:h-[72vh] rounded-3xl overflow-hidden shadow-2xl border border-white/5 bg-zinc-950 flex items-center justify-center"
          >
            <PhotoImage
              photo={lightboxPhoto}
              mode="detail"
              fill
              className="object-contain"
            />
          </div>

          {/* Información del archivo a pie de Lightbox */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl pt-5 px-3 text-xs font-mono text-zinc-600 dark:text-zinc-400"
          >
            <div className="space-y-1 md:max-w-xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded uppercase tracking-wider font-semibold">
                  {lightboxPhoto.room || "Obra"}
                </span>
                <span className="text-[10px] text-zinc-400">Subida el {formatDateEs(lightboxPhoto.created_at)}</span>
              </div>
              <p className="text-white text-[11px] font-sans font-light leading-relaxed pt-1.5">
                {lightboxPhoto.caption || "Sin pie de foto descriptivo."}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
