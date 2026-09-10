"use client";

import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

/**
 * Contador pegajoso «Te toca · N»: pill compacta que aparece bajo el header
 * cuando el Panel 2 («¿Qué me toca a mí?») sale del viewport. Un tap hace
 * scroll de vuelta al panel. Solo existe si hay asuntos pendientes.
 */
export function StickyActionPill({ count, targetId }: { count: number; targetId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [count, targetId]);

  if (count === 0 || !show) return null;

  const scrollToPanel = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      onClick={scrollToPanel}
      className="fixed left-1/2 top-24 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-900 shadow-lg shadow-amber-500/25 transition-transform hover:scale-105 lg:left-[calc(50%+3rem)]"
      aria-label={`Tienes ${count} ${count === 1 ? "asunto pendiente" : "asuntos pendientes"}; ir al panel`}
    >
      Te toca · {count}
      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
