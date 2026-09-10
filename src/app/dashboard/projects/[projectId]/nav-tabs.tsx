"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Layers, CheckSquare, CalendarDays, FileImage, FolderArchive, HardHat, Key,
} from "lucide-react";

/**
 * Navegación persistente del portal cliente: tab bar inferior en móvil y raíl
 * lateral izquierdo en desktop (≥1024px). Todas las secciones viven aquí;
 * «Entrega» solo aparece cuando el proyecto llega a esa etapa.
 */

const TABS = [
  { slug: "", label: "Inicio", icon: Home },
  { slug: "phases", label: "El camino", icon: Layers },
  { slug: "decisions", label: "Decisiones", icon: CheckSquare },
  { slug: "meetings", label: "Reuniones", icon: CalendarDays },
  { slug: "photos", label: "Fotos", icon: FileImage },
  { slug: "documents", label: "Documentos", icon: FolderArchive },
  { slug: "construction", label: "Obra", icon: HardHat },
  { slug: "handover", label: "Entrega", icon: Key },
] as const;

interface NavTabsProps {
  projectId: string;
  /** Punto ámbar (sin número) sobre «Decisiones» si hay decisiones pendientes. */
  showDecisionsDot: boolean;
  /** «Entrega» solo se lista en etapa de entrega o proyecto finalizado. */
  showHandover: boolean;
}

export function NavTabs({ projectId, showDecisionsDot, showHandover }: NavTabsProps) {
  const pathname = usePathname();
  const base = `/dashboard/projects/${projectId}`;

  const items = TABS.filter((tab) => tab.slug !== "handover" || showHandover).map((tab) => {
    const href = tab.slug ? `${base}/${tab.slug}` : base;
    const active = tab.slug ? pathname.startsWith(href) : pathname === base;
    const withDot = tab.slug === "decisions" && showDecisionsDot;
    return { ...tab, href, active, withDot };
  });

  const renderIcon = (item: (typeof items)[number]) => (
    <span className="relative inline-flex">
      <item.icon className="h-5 w-5" aria-hidden />
      {item.withDot && (
        <span
          className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-amber-500"
          aria-label="Hay decisiones pendientes"
        />
      )}
    </span>
  );

  return (
    <>
      {/* Tab bar inferior (móvil y tablet) */}
      <nav
        aria-label="Secciones del proyecto"
        className="fixed bottom-0 inset-x-0 z-40 flex border-t border-zinc-200/70 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] dark:border-zinc-800/70 dark:bg-zinc-950/95 lg:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex min-h-14 min-w-0 flex-auto flex-col items-center justify-center gap-1 px-0.5 py-2 text-[8.5px] font-medium tracking-tight transition-colors ${
              item.active
                ? "text-zinc-900 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200"
            }`}
          >
            {renderIcon(item)}
            <span className={`max-w-full truncate ${item.active ? "font-semibold" : ""}`}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {/* Raíl lateral (desktop) */}
      <nav
        aria-label="Secciones del proyecto"
        className="fixed left-0 top-20 bottom-0 z-40 hidden w-24 flex-col items-stretch gap-1 overflow-y-auto border-r border-zinc-200/60 bg-white/70 pt-6 pb-4 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/70 lg:flex"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`mx-2 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-medium transition-colors ${
              item.active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-white"
                : "text-zinc-500 hover:bg-zinc-100/60 hover:text-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-200"
            }`}
          >
            {renderIcon(item)}
            <span className={`text-center leading-tight ${item.active ? "font-semibold" : ""}`}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
