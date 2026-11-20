"use client";

import React, { useCallback, useState } from "react";
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

type LoadStatus = "loading" | "loaded" | "error";

export function PhotoImage({
  photo,
  mode,
  className = "",
  containerClassName = "",
  alt,
  fill = false
}: PhotoImageProps) {
  // Determinar la URL correcta a usar según el modo
  const src = mode === "gallery" ? (photo.thumbnail_url || photo.image_url) : photo.image_url;

  // El estado va ligado a la fuente: al cambiar de foto (visor) vuelve solo a «cargando»
  const [load, setLoad] = useState<{ src: string; status: LoadStatus }>({ src, status: "loading" });
  const status: LoadStatus = load.src === src ? load.status : "loading";

  // Con loading="lazy" y la caché del navegador, la foto puede terminar de cargar
  // antes de que React hidrate: entonces onLoad no llega nunca y la foto se quedaba
  // invisible en «Cargando…». Al montar (y al cambiar de fuente) se mira si ya está.
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete) return;
      setLoad({ src, status: img.naturalWidth > 0 ? "loaded" : "error" });
    },
    [src]
  );

  // Texto alternativo descriptivo
  const imageAlt = alt || photo.caption || `${photo.room} - Foto de obra`;

  // Calcular la relación de aspecto para prevenir CLS (Cumulative Layout Shift) en modo fluido
  const hasDimensions = photo.width && photo.height;
  const aspectRatioStyle = hasDimensions
    ? { aspectRatio: `${photo.width} / ${photo.height}` }
    : { aspectRatio: "4 / 3" }; // Fallback estándar para fotos de obra

  // Si fill es true, el wrapper llena el contenedor padre; si no, usa aspect-ratio
  const wrapperClass = fill
    ? "absolute inset-0 w-full h-full"
    : "relative w-full";

  const wrapperStyle = fill ? {} : aspectRatioStyle;

  return (
    <div
      className={`overflow-hidden bg-zinc-100 dark:bg-zinc-950 ${wrapperClass} ${containerClassName}`}
      style={wrapperStyle}
    >
      {/* Mientras carga: rayado de obra quieto (45°, cada 12 px). Sin pulsos ni rebotes. */}
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-100 bg-[repeating-linear-gradient(45deg,transparent_0_11px,rgba(51,53,51,0.1)_11px_12px)] dark:bg-zinc-900">
          <ImageIcon className="h-5 w-5 text-zinc-400" aria-hidden />
          <span className="sr-only">Cargando foto</span>
        </div>
      )}

      {/* Fallback de Error (ej. Enlace expirado o roto) */}
      {status === "error" ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 bg-zinc-50 p-4 text-center dark:bg-zinc-900">
          <AlertCircle className="h-5 w-5 text-zinc-500" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-800 dark:text-zinc-200">Enlace caducado</p>
          <p className="max-w-[200px] text-xs leading-snug text-zinc-600 dark:text-zinc-400">
            El enlace de la foto vence por seguridad. Recarga la página para verla.
          </p>
        </div>
      ) : (
        /* Etiqueta de Imagen Nativa (Bypass total de Vercel Image Optimization) */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          ref={imgRef}
          src={src}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoad({ src, status: "loaded" })}
          onError={() => setLoad({ src, status: "error" })}
          className={`w-full h-full transition-opacity duration-[220ms] ease-out ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          } ${className}`}
        />
      )}
    </div>
  );
}
