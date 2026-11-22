"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Route, Box, SquareCheck, CalendarDays, Image as ImageIcon, Folder, HardHat, Key, LayoutGrid,
} from "lucide-react";

/**
 * Navegación persistente del portal cliente (sistema revisado, nov 2026):
 * - Móvil y tablet: tab bar de 5 pestañas en Jet translúcido (el único cristal del
 *   sistema): Inicio, Camino, Decisiones, Obra y «Más». Reuniones, Fotos, Documentos,
 *   Maqueta y Entrega viven en «Más», cada una con su línea de contexto.
 * - Escritorio (≥1024 px): raíl lateral con todas las secciones, porque ahí caben.
 * «Entrega» solo aparece en etapa de entrega o con la obra finalizada, y «Maqueta» solo
 * si la obra tiene una versión publicada.
 */

type Item = { slug: string; label: string; icon: typeof Home };

const PRINCIPALES: Item[] = [
  { slug: "", label: "Inicio", icon: Home },
  { slug: "phases", label: "Camino", icon: Route },
  { slug: "decisions", label: "Decisiones", icon: SquareCheck },
  { slug: "construction", label: "Obra", icon: HardHat },
];

const SECUNDARIAS: Item[] = [
  { slug: "maqueta", label: "Maqueta", icon: Box },
  { slug: "meetings", label: "Reuniones", icon: CalendarDays },
  { slug: "photos", label: "Fotos", icon: ImageIcon },
  { slug: "documents", label: "Documentos", icon: Folder },
  { slug: "handover", label: "Entrega", icon: Key },
];

const MAS: Item = { slug: "mas", label: "Más", icon: LayoutGrid };

interface NavTabsProps {
  projectId: string;
  /** Decisiones pendientes del cliente: contador sobre «Decisiones». */
  pendingDecisions: number;
  /** «Entrega» solo se lista en etapa de entrega o proyecto finalizado. */
  showHandover: boolean;
  /** «Maqueta» solo se lista si hay una versión publicada. */
  showMaqueta: boolean;
}

export function NavTabs({ projectId, pendingDecisions, showHandover, showMaqueta }: NavTabsProps) {
  const pathname = usePathname();
  const base = `/dashboard/projects/${projectId}`;
  const hrefOf = (slug: string) => (slug ? `${base}/${slug}` : base);
  const isActive = (slug: string) => (slug ? pathname.startsWith(hrefOf(slug)) : pathname === base);

  const secundarias = SECUNDARIAS.filter(
    (t) => (t.slug !== "handover" || showHandover) && (t.slug !== "maqueta" || showMaqueta),
  );
  const enMas = isActive(MAS.slug) || secundarias.some((t) => isActive(t.slug));

  const count = (slug: string) =>
    slug === "decisions" && pendingDecisions > 0 ? pendingDecisions : 0;

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? (
      <>
        <span
          aria-hidden
          className="absolute top-0.5 left-[calc(50%+6px)] min-w-[18px] rounded-full bg-whitesmoke px-[5px] text-center text-xs font-bold leading-[18px] text-jet"
        >
          {n}
        </span>
        <span className="sr-only">, {n} {n === 1 ? "pendiente" : "pendientes"}</span>
      </>
    ) : null;

  const tabBar = [...PRINCIPALES, MAS];
  const rail = [...PRINCIPALES, ...secundarias];

  return (
    <>
      {/* Tab bar inferior (móvil y tablet): 5 pestañas, etiquetas de 12 px */}
      <nav
        aria-label="Secciones del proyecto"
        className="dark fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 bg-[var(--nav-glass)] px-1.5 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] text-zinc-200 backdrop-blur-[10px] lg:hidden"
      >
        {tabBar.map((item) => {
          const active = item.slug === MAS.slug ? enMas : isActive(item.slug);
          return (
            <Link
              key={item.slug || "inicio"}
              href={hrefOf(item.slug)}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[52px] flex-col items-center gap-1 pt-2 text-xs ${
                active
                  ? "font-semibold text-whitesmoke before:absolute before:inset-x-[30%] before:top-0 before:h-0.5 before:rounded-b-sm before:bg-whitesmoke"
                  : "font-medium hover:text-whitesmoke"
              }`}
            >
              <span className="relative inline-flex">
                <item.icon className="size-6" aria-hidden />
              </span>
              {item.label}
              <Badge n={count(item.slug)} />
            </Link>
          );
        })}
      </nav>

      {/* Raíl lateral (escritorio): todas las secciones */}
      <nav
        aria-label="Secciones del proyecto"
        className="dark fixed bottom-0 left-0 top-20 z-40 hidden w-24 flex-col items-stretch gap-1 overflow-y-auto bg-[var(--nav-glass)] pt-6 pb-4 text-zinc-200 backdrop-blur-[10px] lg:flex"
      >
        {rail.map((item) => {
          const active = isActive(item.slug);
          return (
            <Link
              key={item.slug || "inicio"}
              href={hrefOf(item.slug)}
              aria-current={active ? "page" : undefined}
              className={`relative mx-2 flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs ${
                active ? "bg-white/10 font-semibold text-whitesmoke" : "font-medium hover:bg-white/5 hover:text-whitesmoke"
              }`}
            >
              <item.icon className="size-5" aria-hidden />
              <span className="text-center leading-tight">{item.label}</span>
              <Badge n={count(item.slug)} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
