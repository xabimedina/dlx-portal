import type { ReactNode } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Piezas comunes del portal del cliente (fase 2): la propuesta de noviembre de 2026
 * pasada al sistema revisado. Saffron = «ahora» (una pieza por pantalla), píldoras en
 * botones y contadores, tarjetas de 18 px, estados sin verde ni rojo.
 */

// ─── Estados ───────────────────────────────────────────────────────────────────────
// Regla del sistema: requiere acción (saffron-100, tinta Jet y el Saffron en el punto),
// en curso (Jet lleno), hecho (neutro), quieto (borde). Siempre con palabra.

export type StateTone = "action" | "progress" | "done" | "quiet";

const TONE_CLASS: Record<StateTone, string> = {
  action: "bg-action-surface text-action-ink",
  progress: "bg-progress-surface text-progress-ink",
  done: "bg-done-surface text-done-ink",
  quiet: "border border-quiet-line bg-transparent text-quiet-ink",
};

export function StateBadge({
  tone,
  children,
  icon,
  className,
}: {
  tone: StateTone;
  children: ReactNode;
  /** Icono Lucide opcional; en «requiere acción» sin icono se pinta el punto Saffron. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold uppercase leading-[1.4] tracking-[0.04em] [&_svg]:size-3.5 [&_svg]:shrink-0",
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon ?? (tone === "action" ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-action-mark" /> : null)}
      {children}
    </span>
  );
}

/** Literal del modelo → [tono, etiqueta del cliente]. Misma tabla que StatusBadge de la librería (audiencia cliente). */
const STATUS_MAP: Record<string, Record<string, [StateTone, string]>> = {
  fase: {
    "No iniciada": ["quiet", "Por llegar"],
    "En desarrollo": ["progress", "En marcha"],
    "Pendiente de revisión cliente": ["action", "Esperando tu revisión"],
    "Pendiente de cambios": ["progress", "Ajustando tus cambios"],
    Validada: ["done", "Validada por ti"],
    Bloqueada: ["quiet", "En espera"],
    Finalizada: ["done", "Completada"],
  },
  decision: {
    Pendiente: ["action", "Pendiente de ti"],
    "En revisión": ["progress", "Esperando al estudio"],
    Votado: ["done", "Registrada"],
    Validada: ["done", "Validada"],
    Cancelado: ["quiet", "Descartada"],
  },
  documento: {
    Borrador: ["quiet", "Preliminar"],
    Revisión: ["done", "Validado"],
    Aprobado: ["done", "Vigente"],
    Obsoleto: ["quiet", "Sustituido"],
  },
};

export type StatusKind = keyof typeof STATUS_MAP;

export function statusOf(kind: StatusKind, status: string): { tone: StateTone; label: string } {
  const entry = STATUS_MAP[kind]?.[status];
  return entry ? { tone: entry[0], label: entry[1] } : { tone: "quiet", label: status };
}

export function StatusBadge({
  kind,
  status,
  label,
  className,
}: {
  kind: StatusKind;
  status: string;
  /** Texto propio si la pantalla necesita otro; el tono sigue saliendo del estado. */
  label?: ReactNode;
  className?: string;
}) {
  const s = statusOf(kind, status);
  return <StateBadge tone={s.tone} className={className}>{label ?? s.label}</StateBadge>;
}

// ─── Tipografía y estructura ───────────────────────────────────────────────────────

export function Eyebrow({ children, bare, className }: { children: ReactNode; bare?: boolean; className?: string }) {
  return <p className={cn("eyebrow", bare && "eyebrow-bare", className)}>{children}</p>;
}

/**
 * Cabecera de sección como índice de dossier: numeral opcional, titular Kanit 600 en
 * mayúsculas y un filete debajo. `action` va a la derecha (enlace «Ver todo», contador…).
 */
export function SecHead({
  title,
  numeral,
  action,
  id,
  as: Tag = "h2",
  className,
}: {
  title: ReactNode;
  numeral?: string;
  action?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3 border-b border-border pb-3", className)}>
      {numeral && <span className="numeral shrink-0">{numeral}</span>}
      <Tag id={id} className="min-w-0 flex-1 text-2xl leading-[1.1] tracking-[0.02em] text-ink dark:text-whitesmoke">
        {title}
      </Tag>
      {action}
    </div>
  );
}

/** Enlace pequeño de cabecera de sección («Diario →»). */
export function SecLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-my-3.5 inline-flex min-h-11 shrink-0 items-center gap-1 text-[13px] font-semibold text-ink hover:underline hover:underline-offset-4 dark:text-whitesmoke">
      {children}
    </Link>
  );
}

/** Cuadro técnico: pares clave/valor separados por filetes (en lugar de cajas con emoji). */
export function Cells({
  items,
  cols,
  className,
}: {
  items: Array<{ k: ReactNode; v: ReactNode }>;
  cols?: number;
  className?: string;
}) {
  return (
    <dl className={cn("cells", className)} style={{ ["--cols" as string]: String(cols ?? items.length) }}>
      {items.map((item, i) => (
        <div key={i}>
          <dt className="cell-k">{item.k}</dt>
          <dd className="cell-v text-ink dark:text-whitesmoke">{item.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Aviso dentro de la página. `default`: nota neutra (surface-deep). `accent`: requiere
 * acción (saffron-100, borde Saffron, tinta Jet). Siempre con título; en el portal nunca rojo.
 */
export function Notice({
  tone = "default",
  title,
  children,
  icon,
  className,
}: {
  tone?: "default" | "accent";
  title: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3.5 [&_svg]:mt-0.5 [&_svg]:size-[18px] [&_svg]:shrink-0",
        tone === "accent"
          ? "border-action-mark bg-action-surface text-action-ink"
          : "border-border bg-[#eceaeb] text-ink [&_svg]:text-ink-soft",
        className,
      )}
    >
      {icon}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em]">{title}</p>
        {children && <div className="mt-1 text-sm leading-[1.55] text-ink">{children}</div>}
      </div>
    </div>
  );
}

// ─── Cierre de página ──────────────────────────────────────────────────────────────

/** «¿Alguna duda?»: se acaba con una persona, no con un copyright. Banda Jet con el isotipo. */
export function ClosingBand({ href }: { href: string }) {
  return (
    <section className="dark bg-jet text-whitesmoke" aria-labelledby="cierre-duda">
      <div className="container mx-auto flex max-w-4xl items-start gap-4 px-4 py-8 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/isotipo-negativo-color.svg" alt="" width={40} height={40} className="size-10 shrink-0" />
        <div className="space-y-3">
          <h2 id="cierre-duda" className="text-xl leading-[1.15] tracking-[0.02em]">¿Alguna duda?</h2>
          <p className="max-w-[46ch] text-sm leading-[1.55] text-zinc-300">
            Todo queda escrito aquí, junto a tu obra. Te respondemos en 24–48 h.
          </p>
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#9da19a] px-5 text-sm font-semibold text-whitesmoke hover:bg-white/10"
          >
            <MessageSquare className="size-4" aria-hidden />
            Escribir al estudio
          </Link>
        </div>
      </div>
    </section>
  );
}
