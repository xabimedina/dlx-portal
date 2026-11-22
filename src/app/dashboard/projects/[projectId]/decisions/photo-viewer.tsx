"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PortalPhoto } from "@/types/portal";
import { PhotoImage } from "@/components/photo-image";
import { etiquetaFoto } from "./decision-utils";

/**
 * Visor de las fotos de una decisión: un <dialog> modal nativo (foco atrapado y Escape
 * de serie), la foto entera sobre Jet, su etiqueta honesta, el pie y el paso entre fotos.
 */
export function PhotoViewer({
  photos,
  start,
  title,
  onClose,
}: {
  photos: PortalPhoto[];
  start: number;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const photo = photos[index];
  const total = photos.length;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  if (!photo) return null;

  const go = (step: number) => setIndex((i) => (i + step + total) % total);
  const pie = [photo.caption, photo.room].filter(Boolean).join(" · ");

  return (
    <dialog
      ref={ref}
      aria-label={`Fotos de «${title}»`}
      onClose={onClose}
      onKeyDown={(e) => {
        if (total < 2) return;
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      className="dark m-0 h-dvh max-h-none w-screen max-w-none bg-jet p-0 text-whitesmoke backdrop:bg-jet/80 sm:m-auto sm:h-auto sm:max-h-[92vh] sm:w-[min(960px,92vw)] sm:rounded-xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-5">
          <p className="min-w-0 truncate text-sm font-semibold">
            {title}
            {total > 1 && <span className="ml-2 font-normal tabular-nums text-zinc-300">{index + 1} de {total}</span>}
          </p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Cerrar el visor"
            className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="relative mx-4 mt-2 min-h-[50vh] flex-1 overflow-hidden rounded-lg sm:mx-5 sm:h-[66vh] sm:flex-none">
          <PhotoImage
            key={photo.id}
            photo={photo}
            mode="detail"
            fill
            className="object-contain"
            tag={etiquetaFoto(photo)}
            alt={photo.caption || `Foto de la decisión «${title}»`}
          />
        </div>

        <div className="flex items-center gap-3 px-4 pb-5 pt-3 sm:px-5">
          <p className="min-w-0 flex-1 text-sm leading-[1.5] text-zinc-300">{pie}</p>
          {total > 1 && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Foto anterior"
                className="inline-flex size-11 items-center justify-center rounded-full border border-[#9da19a] hover:bg-white/10"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Foto siguiente"
                className="inline-flex size-11 items-center justify-center rounded-full border border-[#9da19a] hover:bg-white/10"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
