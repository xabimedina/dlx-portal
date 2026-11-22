import Link from "next/link";
import { ArrowRight, ChevronRight, Clock } from "lucide-react";
import { Eyebrow, SecHead, StateBadge } from "@/components/portal-ui";
import type { ClientAction, StudioItem } from "@/lib/actions-aggregator";

/**
 * «Te toca a ti»: índice numerado de lo que espera respuesta del cliente
 * (buildClientActions). Solo el asunto más urgente lleva botón macizo; la urgencia va
 * en el estado «requiere acción» (StateBadge), nunca en naranja ni en Saffron suelto.
 * Debajo, «En manos del estudio»: lo que el cliente ya respondió.
 */
export function InicioTeToca({
  base,
  actions,
  studio,
  isPaused,
  className = "",
}: {
  base: string;
  actions: ClientAction[];
  studio: StudioItem[];
  isPaused: boolean;
  className?: string;
}) {
  // El más urgente arriba (si ninguno es urgente, el primero del agregador); el resto, en su orden
  const primary = actions.find((a) => a.urgent) ?? actions[0] ?? null;
  const ordered = primary ? [primary, ...actions.filter((a) => a !== primary)] : [];
  const shown = ordered.slice(0, 3);

  const meta = (a: ClientAction) => [a.verb === "Decidir" ? "Decisión" : null, a.origin || null].filter(Boolean).join(" · ");

  return (
    <section id="te-toca" aria-labelledby="inicio-toca" className={`scroll-mt-28 ${className}`}>
      <SecHead
        id="inicio-toca"
        title="Te toca a ti"
        action={
          actions.length > 0 ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-jet px-2.5 py-1 text-xs font-semibold uppercase leading-[1.4] tracking-[0.04em] text-whitesmoke">
              {actions.length} {actions.length === 1 ? "asunto" : "asuntos"}
            </span>
          ) : undefined
        }
      />

      {isPaused && actions.length > 0 && (
        <p className="mt-3 text-sm text-ink-soft">El proyecto está en pausa; puedes responder cuando quieras.</p>
      )}

      {actions.length === 0 ? (
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Nada pendiente por tu parte — te avisaremos aquí cuando haya algo.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {shown.map((action, i) => {
            const numeral = String(i + 1).padStart(2, "0");
            const href = `${base}/${action.section}`;
            if (action === primary) {
              return (
                <li key={action.key} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 py-4">
                  <span className="numeral pt-1.5">{numeral}</span>
                  <div>
                    {action.urgent && <StateBadge tone="action" className="mb-2">Urgente</StateBadge>}
                    <p className="text-base font-semibold leading-[1.4] text-ink">{action.title}</p>
                    {meta(action) && <p className="mt-0.5 text-sm leading-[1.45] text-ink-soft">{meta(action)}</p>}
                    <Link
                      href={href}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-jet px-5 text-sm font-semibold text-whitesmoke hover:bg-zinc-700 sm:w-auto"
                    >
                      {action.verb}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                </li>
              );
            }
            return (
              <li key={action.key}>
                <Link
                  href={href}
                  className="group grid min-h-16 grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-x-3 py-4"
                >
                  <span className="numeral pt-1.5">{numeral}</span>
                  <span className="block min-w-0">
                    {action.urgent && <StateBadge tone="action" className="mb-2">Urgente</StateBadge>}
                    <span className="block text-base font-semibold leading-[1.4] text-ink group-hover:underline group-hover:underline-offset-4">
                      {action.title}
                    </span>
                    {meta(action) && (
                      <span className="mt-0.5 block text-sm leading-[1.45] text-ink-soft">{meta(action)}</span>
                    )}
                  </span>
                  <ChevronRight className="size-5 self-center text-ink-mute" aria-hidden />
                  <span className="sr-only">: {action.verb}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {actions.length > shown.length && (
        <Link
          href={`${base}/decisions`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink hover:underline hover:underline-offset-4"
        >
          Ver los {actions.length} asuntos
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}

      {studio.length > 0 && (
        <div className="mt-6">
          <Eyebrow>En manos del estudio</Eyebrow>
          <ul className="mt-1.5 divide-y divide-border">
            {studio.map((item) => {
              // «Título · resto»: el asunto en tinta y lo que pasa con él en gris
              const cut = item.text.indexOf(" · ");
              return (
                <li key={item.key} className="flex gap-2.5 py-2.5 text-sm leading-normal text-ink-soft">
                  <Clock className="mt-0.5 size-4 shrink-0 text-ink-mute" aria-hidden />
                  <span>
                    {cut > 0 ? (
                      <>
                        <span className="font-semibold text-ink">{item.text.slice(0, cut)}</span>
                        {item.text.slice(cut)}
                      </>
                    ) : (
                      item.text
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
