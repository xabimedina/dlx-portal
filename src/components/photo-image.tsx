"use client";

import React, { useState, useEffect } from "react";
import { Image as ImageIcon, AlertCircle } from "lucide-react";
import type { PortalPhoto as Photo } from "@/types/portal";

interface PhotoImageProps {
  photo: Photo;
  mode: "gallery" | "detail";
  className?: string; // Estilos CSS aplicados a la etiqueta img
  containerClassName?: string; // Estilos CSS aplicados al contenedor wrapper
  alt?: string;
  fill?: boolean; // Si es true, el componente llenará el contenedor padre (como next/image fill)
}

export function PhotoImage({ 
  photo, 
  mode, 
  className = "", 
  containerClassName = "", 
  alt,
  fill = false
}: PhotoImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Determinar la URL correcta a usar según el modo
  const src = mode === "gallery" ? (photo.thumbnail_url || photo.image_url) : photo.image_url;
  
  // Texto alternativo descriptivo
  const imageAlt = alt || photo.caption || `${photo.room} - Foto de obra`;

  // Calcular la relación de aspecto para prevenir CLS (Cumulative Layout Shift) en modo fluido
  const hasDimensions = photo.width && photo.height;
  const aspectRatioStyle = hasDimensions
    ? { aspectRatio: `${photo.width} / ${photo.height}` }
    : { aspectRatio: "4 / 3" }; // Fallback estándar para fotos de obra

  // Restablecer estados si cambia la fuente (por ejemplo, al cambiar de foto en Lightbox)
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  // Si fill es true, el wrapper llena el contenedor padre; si no, usa aspect-ratio
  const wrapperClass = fill
    ? "absolute inset-0 w-full h-full"
    : "relative w-full";

  const wrapperStyle = fill ? {} : aspectRatioStyle;

  return (
    <div 
      className={`overflow-hidden bg-zinc-100 dark:bg-zinc-950 transition-all duration-300 ${wrapperClass} ${containerClassName}`}
      style={wrapperStyle}
    >
      {/* Esqueleto de Carga (Skeleton) */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-900 animate-pulse z-10">
          <div className="flex flex-col items-center space-y-2 text-zinc-600 dark:text-zinc-400">
            <ImageIcon className="h-6 w-6 animate-bounce" />
            <span className="text-[9px] font-mono uppercase tracking-wider">Cargando...</span>
          </div>
        </div>
      )}

      {/* Fallback de Error (ej. Enlace expirado o roto) */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-900 text-center border border-zinc-200/50 dark:border-zinc-800/50 z-20">
          <AlertCircle className="h-6 w-6 text-amber-500 mb-1" />
          <h5 className="text-[10px] font-bold text-zinc-800 dark:text-zinc-200 font-mono uppercase">Enlace Expirado</h5>
          <p className="text-[9px] text-zinc-600 dark:text-zinc-400 font-light max-w-[180px] leading-normal mt-0.5">
            La URL firmada ha vencido por seguridad. Recarga la página.
          </p>
        </div>
      ) : (
        /* Etiqueta de Imagen Nativa (Bypass total de Vercel Image Optimization) */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full transition-all duration-500 ${
            isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-95 blur-xs"
          } ${className}`}
        />
      )}
    </div>
  );
}
