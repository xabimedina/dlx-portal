"use client";

import React, { useState, useMemo } from "react";
import {
  AlertCircle, Maximize2, X, FileImage, ChevronLeft, ChevronRight, RefreshCw
} from "lucide-react";
import { Profile } from "@/lib/firebase/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoImage } from "@/components/photo-image";
import { weekLabel } from "@/lib/week-label";
import { formatDateEs, formatDayMonthEs } from "@/lib/format-date-es";

interface PhotosClientProps {
  photos: any[];
  phases: any[];
  weeklyUpdates: any[];
  meetings?: any[];
  projectId: string;
  profile: Profile;
}

export function PhotosClient({
  photos,
  phases,
  weeklyUpdates,
  meetings = [],
  projectId,
  profile,
}: PhotosClientProps) {
  void projectId; void profile;

  // --- FILTROS DE SELECCIÓN ---
  const [selectedWeek, setSelectedWeek] = useState<string>("todas");
  const [selectedPhase, setSelectedPhase] = useState<string>("todas");
  const [selectedRoom, setSelectedRoom] = useState<string>("todas");
  const [sortOrder, setSortOrder] = useState<"recientes" | "antiguas">("recientes");

  // --- CONTROL DE PAGINACIÓN PROGRESIVA (Lotes de 24) ---
  const [visibleCount, setVisibleCount] = useState<number>(24);

  // --- CONTROL DE LIGHTBOX Y CARRUSEL ---
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);

  // Procedencia de la foto (las fotos nacen adjuntas a un parte, acta o decisión)
  const provenance = (photo: any): string => {
    const update = weeklyUpdates.find((w) => w.id === photo.weekly_update_id);
    if (update) return weekLabel(update.week_number);
    const meeting = meetings.find((m) => m.id === photo.meeting_id);
    if (meeting) return `Acta del ${formatDayMonthEs(meeting.meeting_date)}`;
    if (photo.decision_id) return "Decisión";
    const phase = phases.find((p) => p.id === photo.phase_id);
    return phase ? phase.phase_number : "Proyecto";
  };

  // Obtener estancias únicas dinámicamente de los datos para rellenar los selectores
  const uniqueRooms = useMemo(() => {
    const roomsSet = new Set<string>();
    photos.forEach(p => {
      if (p.room) roomsSet.add(p.room);
    });
    return Array.from(roomsSet).sort();
  }, [photos]);

  // Filtrado y ordenación de fotos síncrona en cliente
  const filteredPhotos = useMemo(() => {
    let result = [...photos];

    // 1. Filtrar por Semana de obra
    if (selectedWeek !== "todas") {
      result = result.filter(p => p.weekly_update_id === selectedWeek);
    }

    // 2. Filtrar por Fase
    if (selectedPhase !== "todas") {
      result = result.filter(p => p.phase_id === selectedPhase);
    }

    // 3. Filtrar por Estancia
    if (selectedRoom !== "todas") {
      result = result.filter(p => p.room === selectedRoom);
    }

    // 4. Ordenación por fecha de subida
    result.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === "recientes" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [photos, selectedWeek, selectedPhase, selectedRoom, sortOrder]);

  // Fotos visibles actualmente según paginación progresiva
  const visiblePhotos = useMemo(() => {
    return filteredPhotos.slice(0, visibleCount);
  }, [filteredPhotos, visibleCount]);

  // Manejador de Carga Progresiva
  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 24);
  };

  // --- LÓGICA DE NAVEGACIÓN EN LIGHTBOX ---
  const activeIndexInFiltered = useMemo(() => {
    if (!lightboxPhoto) return -1;
    return filteredPhotos.findIndex(p => p.id === lightboxPhoto.id);
  }, [lightboxPhoto, filteredPhotos]);

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIndexInFiltered > 0) {
      setLightboxPhoto(filteredPhotos[activeIndexInFiltered - 1]);
    }
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIndexInFiltered < filteredPhotos.length - 1) {
      setLightboxPhoto(filteredPhotos[activeIndexInFiltered + 1]);
    }
  };

  return (
    <div className="space-y-8">

      {/* Cabecera y Introducción */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em]">
          <FileImage className="h-3.5 w-3.5 text-amber-500" />
          <span>Seguimiento gráfico</span>
        </div>
        <h1 className="text-3xl font-light tracking-tight text-zinc-900 dark:text-white leading-tight">
          Fotos
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-light max-w-xl">
          La bitácora visual de tu hogar. Explora las imágenes capturadas durante las visitas técnicas del estudio, filtra por estancia, fecha o fases del camino y comprueba cada detalle del proceso constructivo.
        </p>
      </div>

      {/* CONTENEDOR DE FILTROS CRUZADOS */}
      <Card className="border border-zinc-200/50 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/60 p-5 shadow-xs rounded-3xl backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          {/* 1. Filtrar por Estancia */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">Estancia / Estructura</label>
            <select
              value={selectedRoom}
              onChange={(e) => { setSelectedRoom(e.target.value); setVisibleCount(24); }}
              className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-850 dark:bg-zinc-950 px-3 py-2 text-xs focus-visible:outline-none"
            >
              <option value="todas">-- Todas --</option>
              {uniqueRooms.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          {/* 2. Filtrar por Fase */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">Fase del Proyecto</label>
            <select
              value={selectedPhase}
              onChange={(e) => { setSelectedPhase(e.target.value); setVisibleCount(24); }}
              className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-850 dark:bg-zinc-950 px-3 py-2 text-xs focus-visible:outline-none"
            >
              <option value="todas">-- Todas --</option>
              {phases.map(p => (
                <option key={p.id} value={p.id}>{p.phase_number}: {p.name}</option>
              ))}
            </select>
          </div>

          {/* 3. Filtrar por Semana */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">Reporte Semanal</label>
            <select
              value={selectedWeek}
              onChange={(e) => { setSelectedWeek(e.target.value); setVisibleCount(24); }}
              className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-850 dark:bg-zinc-950 px-3 py-2 text-xs focus-visible:outline-none"
            >
              <option value="todas">-- Todas --</option>
              {weeklyUpdates.map(w => (
                <option key={w.id} value={w.id}>{weekLabel(w.week_number)}: {w.title}</option>
              ))}
            </select>
          </div>

          {/* 4. Ordenación por Fecha */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">Orden Cronológico</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-850 dark:bg-zinc-950 px-3 py-2 text-xs focus-visible:outline-none"
            >
              <option value="recientes">Más recientes primero</option>
              <option value="antiguas">Más antiguas primero</option>
            </select>
          </div>
        </div>
      </Card>

      {/* GRID DE FOTOGRAFÍAS */}
      {visiblePhotos.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {visiblePhotos.map((photo) => {
              return (
                <Card
                  key={photo.id}
                  onClick={() => setLightboxPhoto(photo)}
                  className="border border-zinc-200 bg-white/70 dark:border-zinc-850 dark:bg-zinc-900/60 shadow-2xs hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden cursor-pointer hover:scale-[1.01] flex flex-col group justify-between"
                >
                  {/* Contenedor de la foto con aspect ratio resguardado contra CLS */}
                  <div className="relative h-40 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200/40 dark:border-zinc-850">
                    <PhotoImage
                      photo={photo}
                      mode="gallery"
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Maximize2 className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  {/* Contenido / Metadatos */}
                  <CardContent className="p-4 space-y-2 text-xs">

                    {/* Pie obligatorio: estancia · procedencia */}
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      {[photo.room, provenance(photo)].filter(Boolean).join(" · ")}
                    </div>

                    {/* Pie de foto o descripción */}
                    <p className="text-zinc-650 dark:text-zinc-450 leading-relaxed font-light text-[11px] line-clamp-2 min-h-[32px]">
                      {photo.caption || "Seguimiento de obra."}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* BOTÓN DE CARGA PROGRESIVA ("Cargar más") */}
          {filteredPhotos.length > visiblePhotos.length && (
            <div className="flex justify-center pt-4 pb-6">
              <Button
                onClick={handleLoadMore}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-sm h-10 px-8 rounded-2xl flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Cargar más fotografías ({filteredPhotos.length - visiblePhotos.length} restantes)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="border border-zinc-200 bg-white/50 p-12 text-center text-zinc-600 dark:text-zinc-450 font-mono text-xs rounded-3xl">
          <AlertCircle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          Ninguna fotografía coincide con los filtros aplicados.
        </Card>
      )}

      {/* Lightbox / Visor de carrusel de fotos ampliado */}
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

          {/* Carrusel: Botón Anterior */}
          {activeIndexInFiltered > 0 && (
            <button
              onClick={handlePrevPhoto}
              className="absolute left-4 md:left-8 p-3 rounded-full bg-zinc-900/60 text-white hover:bg-zinc-800 hover:scale-105 transition-all shadow-md z-[130] flex items-center justify-center"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Carrusel: Botón Siguiente */}
          {activeIndexInFiltered < filteredPhotos.length - 1 && (
            <button
              onClick={handleNextPhoto}
              className="absolute right-4 md:right-8 p-3 rounded-full bg-zinc-900/60 text-white hover:bg-zinc-800 hover:scale-105 transition-all shadow-md z-[130] flex items-center justify-center"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

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
            className="w-full max-w-4xl pt-5 px-3 text-xs font-mono text-zinc-400"
          >
            <div className="space-y-1 md:max-w-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[9px] bg-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded uppercase tracking-wider font-semibold">
                  {[lightboxPhoto.room || "Obra", provenance(lightboxPhoto)].join(" · ")}
                </span>
                <span className="text-[10px] text-zinc-400">Subida el {formatDateEs(lightboxPhoto.created_at)}</span>
                <span className="text-[9px] text-zinc-550 font-bold bg-zinc-900 px-2.5 py-0.5 rounded font-mono">
                  {activeIndexInFiltered + 1} de {filteredPhotos.length}
                </span>
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
