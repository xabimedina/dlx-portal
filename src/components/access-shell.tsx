import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/**
 * Marco de las pantallas de entrada del portal (fase 2), en el mismo lenguaje que /login:
 * portada Jet con el logotipo, la línea del método (la textura de marcos solo detrás del
 * dibujo), el antetítulo y el titular `display-portal`; y la zona clara con el contenido y
 * el pie con el lema. En escritorio, dos columnas con la portada fija.
 * Pantallas tranquilas: nada se anima al cargar.
 *
 * Lo usan /acceso y los avisos del cliente de /dashboard (sin obra vinculada, error de carga).
 * /login lleva esta misma portada escrita en línea.
 */
export function AccessShell({
  titleId,
  eyebrow = "Portal de clientes",
  title = "Tu casa, fase a fase",
  action,
  footerNote,
  children,
}: {
  /** id del titular de la portada (la portada se etiqueta con él). */
  titleId: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** Arriba a la derecha de la portada: «Volver al inicio», cerrar sesión… */
  action?: ReactNode;
  /** Nota sobre el lema del pie. */
  footerNote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      {/* ── Portada Jet ── */}
      <section
        aria-labelledby={titleId}
        className="dark flex flex-col bg-jet px-4 pt-4 pb-8 text-whitesmoke sm:px-6 lg:sticky lg:top-0 lg:h-dvh lg:px-12 lg:pt-8 lg:pb-12"
      >
        <div className="flex min-h-11 items-center justify-between gap-3">
          <BrandLogo className="h-7 sm:h-8" />
          {action}
        </div>

        <div className="lg:my-auto">
          {/* Zona del dibujo: la textura de marcos vive solo aquí, detrás de la línea del método
              (proyecto, obra, llaves). Decorativa y quieta. */}
          <div aria-hidden className="tex-marcos -mx-4 mt-5 flex h-36 items-center px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:h-52 lg:px-12">
            <svg viewBox="0 0 350 62" className="h-auto w-full max-w-[350px] overflow-visible lg:max-w-[440px]" focusable="false">
              <path d="M0 14 H236" stroke="#f5f3f4" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M246 14 H332" stroke="#8c9089" strokeWidth="2" strokeDasharray="5 5" fill="none" />
              <g fill="#f5f3f4">
                {[14, 32, 50, 68, 86, 104, 122, 140, 158].map((cx) => (
                  <circle key={cx} cx={cx} cy="14" r="4" />
                ))}
              </g>
              <circle cx="236" cy="14" r="9" fill="#333533" stroke="#f5f3f4" strokeWidth="2" />
              <circle cx="342" cy="14" r="6" fill="#333533" stroke="#8c9089" strokeWidth="2" />
              <g fontFamily="Montserrat, system-ui, sans-serif" fontSize="12" fontWeight="600" letterSpacing="1.7" fill="#9da19a">
                <text x="86" y="44" textAnchor="middle">PROYECTO</text>
                <text x="236" y="44" textAnchor="middle">OBRA</text>
                <text x="350" y="44" textAnchor="end">LLAVES</text>
              </g>
            </svg>
          </div>

          <div className="mt-4 space-y-3 lg:mt-8">
            <p className="eyebrow">{eyebrow}</p>
            <h1 id={titleId} className="display-portal text-whitesmoke [text-wrap:balance]">
              {title}
            </h1>
          </div>
        </div>
      </section>

      {/* ── Zona clara ── */}
      <main className="flex flex-1 flex-col px-4 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-md pt-7 lg:my-auto lg:pt-12">{children}</div>

        <footer className="mx-auto mt-auto w-full max-w-md pt-10 pb-8">
          <div className="border-t border-border pt-4">
            {footerNote && <p className="text-sm leading-[1.5] text-ink-soft">{footerNote}</p>}
            <p className={cn("eyebrow", footerNote && "mt-4")}>Tu hogar, listo y sin sorpresas.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
