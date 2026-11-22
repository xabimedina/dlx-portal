"use client";

import { useState } from "react";

/**
 * Texto largo con «leer más» expandible (nada de line-clamp ciego): si el
 * texto cabe en el umbral se muestra entero; si no, se corta por palabra y el
 * cliente decide cuándo leer el resto.
 */
export function ExpandableText({
  text,
  threshold = 220,
  className = "",
}: {
  text: string;
  threshold?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= threshold) {
    return <p className={className}>{text}</p>;
  }

  const cut = text.slice(0, threshold).replace(/\s+\S*$/, "");

  return (
    <p className={className}>
      {expanded ? text : `${cut}… `}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="font-semibold text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
      >
        {expanded ? " Leer menos" : "Leer más"}
      </button>
    </p>
  );
}
