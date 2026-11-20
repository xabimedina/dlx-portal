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
        className="dark fixed bottom-0 inset-x-0 z-40 flex bg-[var(--nav-glass)] backdrop-blur-[10px] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex min-h-14 min-w-0 flex-auto flex-col items-center justify-center gap-1 px-0.5 py-2 text-[8.5px] font-medium tracking-tight ${
              item.active
                ? "text-white before:absolute before:inset-x-[28%] before:top-0 before:h-0.5 before:rounded-b-sm before:bg-whitesmoke"
                : "text-zinc-200 hover:text-white"
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
        className="dark fixed left-0 top-20 bottom-0 z-40 hidden w-24 flex-col items-stretch gap-1 overflow-y-auto bg-[var(--nav-glass)] pt-6 pb-4 backdrop-blur-[10px] lg:flex"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`mx-2 flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium ${
              item.active
                ? "bg-white/10 text-white"
                : "text-zinc-200 hover:bg-white/5 hover:text-white"
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
