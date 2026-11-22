import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Piezas del hilo de «El camino» (propuesta de noviembre de 2026, sistema revisado).
 *
 * El hilo es una línea vertical con un nudo por fase. El eje está a 20 px del borde
 * y el contenido empieza a 48 px (`pl-12`). Cada fila sabe a qué altura (ky) cae su
 * nudo, así la línea puede ir de nudo a nudo sin medir nada en el navegador:
 * - el tramo hecho es un único trazo Jet de 3 px, desde el primer nudo hasta el nudo
 *   de ahora (es el que se dibuja en el «momento de producto»);
 * - el tramo por llegar es discontinuo y lo pinta cada fila con su segmento.
 */

/** Centro de los nudos, desde el borde izquierdo del hilo. */
const EJE = 20;

/** Altura del nudo en cada tipo de fila (padding superior + media línea del titular). */
export const KY = {
  fase: 25,
  pliegue: 22,
  ahora: 40,
} as const;

export type TipoNudo = "hecha" | "ahora" | "porLlegar";

const TAM: Record<TipoNudo, number> = { hecha: 24, ahora: 28, porLlegar: 22 };

/** Disco del hilo: macizo Jet (hecha), Saffron con el numeral (ahora) o hueco (por llegar). */
export function Nudo({
  tipo,
  ky,
  numeral,
  className,
}: {
  tipo: TipoNudo;
  ky: number;
  numeral?: string;
  className?: string;
}) {
  const s = TAM[tipo];
  return (
    <span
      aria-hidden
      className={cn(
        "absolute z-[1] grid place-items-center rounded-full",
        tipo === "hecha" && "bg-jet text-whitesmoke",
        // El nudo de ahora: la única pieza Saffron de la pantalla (el numeral va en Jet)
        tipo === "ahora" && "bg-saffron font-heading text-[13px] font-semibold leading-none tracking-[0.04em] text-jet tabular-nums",
        tipo === "porLlegar" && "border-2 border-control-line bg-background",
        className,
      )}
      style={{ left: EJE - s / 2, top: ky - s / 2, width: s, height: s }}
    >
      {tipo === "hecha" && <Check className="size-4" strokeWidth={2.5} />}
      {tipo === "ahora" && numeral}
    </span>
  );
}

/** Arcos concéntricos estáticos alrededor del nudo de ahora. */
export function Arcos({ ky }: { ky: number }) {
  return (
    <>
      {[38, 52].map((s) => (
        <span
          key={s}
          aria-hidden
          className="absolute z-[1] rounded-full border border-zinc-200"
          style={{ left: EJE - s / 2, top: ky - s / 2, width: s, height: s }}
        />
      ))}
    </>
  );
}

export type TipoSegmento = "completo" | "desdeNudo" | "hastaNudo";

/** Tramo discontinuo (por llegar) de una fila: entera, desde su nudo o hasta su nudo. */
export function Segmento({ tipo, ky }: { tipo: TipoSegmento; ky: number }) {
  const style: CSSProperties =
    tipo === "completo" ? { top: 0, bottom: 0 } : tipo === "desdeNudo" ? { top: ky, bottom: 0 } : { top: 0, height: ky };
  return (
    <span
      aria-hidden
      className="absolute w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--color-quiet-line)_0_5px,transparent_5px_10px)]"
      style={{ left: EJE - 1, ...style }}
    />
  );
}

/**
 * Tramo hecho: un trazo Jet desde el nudo de la primera fila del bloque (`desde`) hasta
 * `hasta` px por debajo del bloque (el nudo de ahora, que va justo después). Con
 * `dibujar`, se dibuja a 10 fps (dlx-draw, steps(10), --dur-draw): el «momento de
 * producto» de la pantalla. Sin la clase, ya está en su estado final.
 */
export function Trazo({ desde, hasta, dibujar }: { desde: number; hasta: number; dibujar: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute w-[3px]" style={{ left: EJE - 1.5, top: desde, bottom: -hasta }}>
      {/* Mientras se dibuja, debajo asoma el camino discontinuo que va rellenando */}
      {dibujar && (
        <span className="absolute inset-y-0 left-[0.5px] w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--color-quiet-line)_0_5px,transparent_5px_10px)]" />
      )}
      <svg className="relative block h-full w-[3px] overflow-visible">
        <line
          x1="1.5"
          y1="0"
          x2="1.5"
          y2="100%"
          pathLength={1}
          strokeWidth={3}
          className={cn(
            "stroke-jet",
            dibujar &&
              "[--len:1] [stroke-dasharray:1] animate-[dlx-draw_var(--dur-draw)_steps(10)_both] motion-reduce:animate-none",
          )}
        />
      </svg>
    </span>
  );
}

/** Antetítulo de etapa en el hilo («Proyecto · fases 00–08»). */
export function Etapa({ children, segmento }: { children: ReactNode; segmento?: boolean }) {
  return (
    <div className="relative flex min-h-[52px] items-center pl-12">
      {segmento && <Segmento tipo="completo" ky={0} />}
      <p className="eyebrow eyebrow-bare">{children}</p>
    </div>
  );
}

/** Lista de filas (documentos, reuniones, decisiones) separadas por filetes. */
export function Filas({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-zinc-200 border-t border-zinc-200", className)}>{children}</ul>;
}

/**
 * Fila de la tabla técnica de una fase: icono, título, detalle y la acción a la
 * derecha (chevron o descarga). Enlace interno, descarga externa o fila sin enlace.
 */
export function Fila({
  icono,
  titulo,
  detalle,
  final,
  href,
  externo,
  compacta,
}: {
  icono: ReactNode;
  titulo: ReactNode;
  detalle?: ReactNode;
  final?: ReactNode;
  href?: string;
  externo?: boolean;
  compacta?: boolean;
}) {
  const clase = cn(
    "group/fila grid grid-cols-[20px_minmax(0,1fr)_16px] items-center gap-3",
    compacta ? "min-h-12 py-2" : "min-h-[60px] py-2.5",
  );
  const cuerpo = (
    <>
      <span className="text-ink [&_svg]:size-5" aria-hidden>{icono}</span>
      <span className="min-w-0">
        <span
          className={cn(
            "block break-words font-semibold leading-[1.35] text-ink",
            compacta ? "text-sm" : "text-[15px]",
            href && "decoration-1 underline-offset-4 group-hover/fila:underline",
          )}
        >
          {titulo}
        </span>
        {detalle && <span className="mt-0.5 block text-[13px] leading-[1.4] text-ink-mute">{detalle}</span>}
      </span>
      <span className="text-ink-mute [&_svg]:size-4" aria-hidden>{final}</span>
    </>
  );

  return (
    <li>
      {!href ? (
        <div className={clase}>{cuerpo}</div>
      ) : externo ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={clase}>
          {cuerpo}
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      ) : (
        <Link href={href} className={clase}>
          {cuerpo}
        </Link>
      )}
    </li>
  );
}
