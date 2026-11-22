"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * Contador pegajoso «Te toca · N»: píldora Jet que aparece bajo la barra cuando el
 * bloque «Te toca a ti» sale de la pantalla. Un toque vuelve a él. Solo existe si hay
 * asuntos pendientes (en escritorio ese bloque está fijo a la derecha y no sale nunca).
 */
export function StickyActionPill({ count, targetId }: { count: number; targetId: string }) {
  // null: el bloque se ve; si no, hacia dónde queda
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (count === 0) return;
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) =>
        setDir(entry.isIntersecting ? null : entry.boundingClientRect.top > 0 ? "down" : "up"),
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [count, targetId]);

  if (count === 0 || !dir) return null;
  const Arrow = dir === "down" ? ArrowDown : ArrowUp;

  const scrollToPanel = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={scrollToPanel}
      className="fixed left-1/2 top-[92px] z-40 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-jet px-5 text-sm font-semibold text-whitesmoke shadow-[0_4px_16px_rgba(30,32,30,0.24)] hover:bg-zinc-700 lg:left-[calc(50%+3rem)]"
      aria-label={`Tienes ${count} ${count === 1 ? "asunto pendiente" : "asuntos pendientes"}; ir a «Te toca a ti»`}
    >
      Te toca · {count}
      <Arrow className="size-4" aria-hidden />
    </button>
  );
}
