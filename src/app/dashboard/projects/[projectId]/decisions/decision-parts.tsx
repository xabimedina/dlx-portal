"use client";

import React, { useEffect, useRef } from "react";
import { Check, Clock, Download, FileText, LoaderCircle, MessageSquare } from "lucide-react";
import type { PortalDocument, PortalPhoto } from "@/types/portal";
import { PhotoImage } from "@/components/photo-image";
import { Notice } from "@/components/portal-ui";
import { formatDateEs } from "@/lib/format-date-es";
import { cn } from "@/lib/utils";
import { type Decision, etiquetaFoto, formatBytes, plazoEnPalabras } from "./decision-utils";

/**
 * Piezas de una decisión (propuesta de noviembre de 2026 al sistema revisado): plazo,
 * fotos con su etiqueta honesta, recomendación del estudio en panel Jet, documento
 * vinculado, historial y el formulario de respuesta con las mismas acciones de siempre.
 */

const btnPrimario =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-jet px-6 text-sm font-semibold text-whitesmoke hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecundario =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-control-line bg-transparent px-6 text-sm font-semibold text-ink hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";

/** Filete Saffron: la única pieza «ahora» de la pantalla (el texto sigue en tinta). */
function FileteAhora() {
  return <span aria-hidden className="h-[3px] w-[22px] shrink-0 rounded-full bg-saffron" />;
}

/** «Fase 1 · Distribución · Urgente»: dónde vive la decisión y, si la hay, su prioridad alta. */
export function MetaLinea({ fase, priority, className }: { fase: string; priority: string; className?: string }) {
  const prioridad = priority === "Urgente" ? "Urgente" : priority === "Alta" ? "Prioridad alta" : null;
  return (
    <p className={cn("text-xs font-semibold uppercase leading-[1.4] tracking-[0.12em] text-ink-soft", className)}>
      {[fase, prioridad].filter(Boolean).join(" · ")}
    </p>
  );
}

/** El plazo en palabras tranquilas. Con `ahora`, lleva el filete Saffron. */
export function Plazo({ due, today, ahora, className }: { due: string | null; today: string; ahora?: boolean; className?: string }) {
  const plazo = plazoEnPalabras(due, today);
  if (!plazo) {
    return (
      <p className={cn("flex items-start gap-2 text-sm leading-[1.45] text-ink-soft", className)}>
        <Clock className="mt-px size-4 shrink-0 text-ink-mute" aria-hidden />
        Sin fecha límite: respóndela cuando puedas
      </p>
    );
  }
  if (ahora) {
    return (
      <p className={cn("flex items-center gap-2.5 text-[15px] font-semibold leading-[1.4] text-ink", className)}>
        <FileteAhora />
        {plazo.texto}
      </p>
    );
  }
  return (
    <p className={cn("flex items-start gap-2 text-sm leading-[1.45] text-ink-soft", className)}>
      <Clock className="mt-px size-4 shrink-0 text-ink-mute" aria-hidden />
      {plazo.texto}
    </p>
  );
}

/** Fotos adjuntas por el estudio, cada una con su etiqueta honesta. Se abren en el visor. */
export function FotosDecision({
  photos,
  title,
  onOpen,
  densa,
  className,
}: {
  photos: PortalPhoto[];
  title: string;
  onOpen: (index: number) => void;
  /** En la lista de ya decididas: miniaturas más pequeñas. */
  densa?: boolean;
  className?: string;
}) {
  if (photos.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">Fotos de la decisión</p>
      <ul className={cn("mt-2.5 grid gap-2.5", densa ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4")}>
        {photos.map((photo, i) => {
          const pie = photo.caption || photo.room;
          return (
            <li key={photo.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`Ver en grande: ${pie || `foto ${i + 1} de «${title}»`}`}
                className="group block w-full rounded-lg text-left"
              >
                <span
                  className={cn(
                    "relative block overflow-hidden rounded-lg border border-border bg-zinc-100",
                    densa ? "aspect-square" : "aspect-[4/5]",
                  )}
                >
                  <PhotoImage
                    photo={photo}
                    mode="gallery"
                    fill
                    className="object-cover"
                    tag={densa ? undefined : etiquetaFoto(photo)}
                    alt={photo.caption || `Foto de la decisión «${title}»`}
                  />
                </span>
                {pie && !densa && (
                  <span className="mt-1.5 line-clamp-2 block text-[13px] leading-[1.4] text-ink-soft group-hover:text-ink">
                    {pie}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Nuestra recomendación, solo si el estudio la ha escrito: panel Jet con la firma. */
export function Recomendacion({ texto, className }: { texto: string; className?: string }) {
  return (
    <aside aria-label="Nuestra recomendación" className={cn("dark rounded-xl bg-jet p-5 text-whitesmoke", className)}>
      <p className="eyebrow">Nuestra recomendación</p>
      <p className="mt-2.5 text-pretty text-[17px] font-medium leading-[1.5]">{texto}</p>
      <p className="mt-4 flex items-center gap-3 border-t border-border pt-3.5 text-sm font-semibold text-zinc-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/isotipo-negativo-color.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
        Estudio Despeja la X
      </p>
    </aside>
  );
}

/** Muestra o plano vinculado (campo heredado): se descarga con una URL firmada al momento. */
export function DocumentoVinculado({
  doc,
  busy,
  onDownload,
  className,
}: {
  doc: PortalDocument;
  busy: boolean;
  onDownload: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">Muestra o plano vinculado</p>
      <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-border bg-white p-3 pl-3.5">
        <FileText className="size-5 shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-[1.4] text-ink">{doc.title}</p>
          <p className="text-[13px] text-ink-mute">{[doc.version, formatBytes(doc.file_size)].filter(Boolean).join(" · ")}</p>
        </div>
        {/* En móvil, solo el icono (44 px) para que el título no se corte */}
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          aria-label={`Descargar ${doc.title}`}
          className={cn(btnSecundario, "size-11 shrink-0 px-0 sm:size-auto sm:px-4")}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          <span className="hidden sm:inline">Descargar</span>
        </button>
      </div>
    </div>
  );
}

/** Lo que el cliente ya respondió: validada y cerrada, o petición de revisión enviada. */
export function Historial({ decision, className }: { decision: Decision; className?: string }) {
  const validada = decision.status === "Validada";
  if (!(validada || decision.status === "En revisión") || !decision.client_response) return null;
  return (
    <Notice
      className={className}
      title={validada ? "Validada y cerrada" : "Petición de revisión enviada"}
      icon={validada ? <Check aria-hidden /> : <Clock aria-hidden />}
    >
      <p className="italic">«{decision.client_response}»</p>
      {decision.validated_at && (
        <p className="mt-1 text-[13px] not-italic text-ink-mute">Registrado el {formatDateEs(decision.validated_at)}</p>
      )}
    </Notice>
  );
}

/**
 * Tu elección o comentario, y las dos acciones de siempre: validar (comentario opcional)
 * y solicitar revisión (motivo obligatorio). Sin fecha límite, el filete «ahora» va aquí.
 */
export function RespuestaForm({
  decision,
  value,
  onChange,
  disabled,
  acting,
  ahora,
  onValidate,
  onReview,
}: {
  decision: Decision;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  /** Esta decisión es la que se está guardando ahora mismo. */
  acting: boolean;
  ahora?: boolean;
  onValidate: () => void;
  onReview: () => void;
}) {
  const id = `comment-${decision.id}`;
  return (
    <div className="mt-6 border-t border-border pt-5">
      <label htmlFor={id} className="flex items-center gap-2.5 text-sm font-semibold text-ink">
        {ahora && <FileteAhora />}
        Tu elección o comentario
      </label>
      <p id={`${id}-ayuda`} className="mt-0.5 text-[13px] leading-[1.45] text-ink-mute">
        Para validar es opcional. Si pides una revisión, cuéntanos el motivo.
      </p>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        maxLength={2000}
        aria-describedby={`${id}-ayuda`}
        placeholder="Por ejemplo: «Opción B, latón», o tus dudas sobre las muestras."
        className="mt-2 block min-h-24 w-full resize-y rounded-md border-[1.5px] border-control-line bg-white px-3.5 py-3 text-base leading-[1.5] text-ink placeholder:text-ink-mute disabled:opacity-60"
      />
      <div className="mt-5 grid gap-2.5 sm:flex sm:flex-row-reverse sm:justify-start">
        <button type="button" onClick={onValidate} disabled={disabled} className={btnPrimario}>
          {acting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Procesando…
            </>
          ) : (
            <>
              <Check className="size-4" aria-hidden /> Validar decisión
            </>
          )}
        </button>
        <button type="button" onClick={onReview} disabled={disabled || !value.trim()} className={btnSecundario}>
          Solicitar revisión
        </button>
      </div>
      <p className="mt-3 text-balance text-center text-[13px] leading-[1.45] text-ink-mute sm:text-right">
        Al validarla queda cerrada. Si después quieres cambiarla, escríbenos.
      </p>
    </div>
  );
}

/**
 * Momento de producto: al registrar un voto, una marca se dibuja en 140 ms donde estaba
 * la decisión (sin token de excepción). Recibe el foco para que nadie se pierda.
 */
export function Registro({ tipo, title }: { tipo: "validada" | "revision"; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="flex items-center gap-3 rounded-lg border border-border bg-done-surface px-4 py-3.5 text-ink outline-none"
    >
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-jet text-whitesmoke">
        {tipo === "validada" ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M20 6 9 17l-5-5"
              pathLength={1}
              className="[--len:1] [stroke-dasharray:1] animate-[dlx-draw_var(--dur-fast)_var(--ease-out)_both]"
            />
          </svg>
        ) : (
          <MessageSquare className="size-4" />
        )}
      </span>
      <p className="text-sm leading-[1.5]">
        <span className="font-semibold">{tipo === "validada" ? "Decisión validada:" : "Revisión solicitada:"}</span> {title}.{" "}
        {tipo === "validada" ? "La tienes en «Ya decididas»." : "El estudio la revisa y te responde."}
      </p>
    </div>
  );
}
