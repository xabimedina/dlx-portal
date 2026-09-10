"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

interface SwitcherProject {
  id: string;
  name: string;
  status?: string;
}

/**
 * Selector de proyecto del header (solo si el cliente tiene más de uno).
 * Navega a /dashboard/projects/{otroId} conservando la sección actual: todas
 * las secciones existen en todos los proyectos, así que el resto de la ruta
 * se mantiene tal cual.
 */
export function ProjectSwitcher({
  projects,
  currentId,
}: {
  projects: SwitcherProject[];
  currentId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (nextId: string) => {
    if (nextId === currentId) return;
    const base = `/dashboard/projects/${currentId}`;
    const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
    router.push(`/dashboard/projects/${nextId}${rest}`);
  };

  return (
    // min-w-0 en el label y w-full en el select: el select nunca desborda el
    // hueco que el header le deja (antes se montaba sobre el botón de salir).
    <label className="relative flex min-w-0 items-center">
      <span className="sr-only">Cambiar de proyecto</span>
      <select
        value={currentId}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full min-w-0 cursor-pointer appearance-none truncate rounded-xl border border-transparent bg-transparent py-1 pl-1 pr-7 font-heading text-sm font-medium text-zinc-900 hover:border-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 dark:text-white dark:hover:border-zinc-800 sm:max-w-xs sm:text-base"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.status && p.status !== "Activo" ? ` (${p.status})` : ""}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
        aria-hidden
      />
    </label>
  );
}
