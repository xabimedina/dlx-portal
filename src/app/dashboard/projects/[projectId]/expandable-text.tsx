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
        onClick={() => setExpanded((v) => !v)}
        className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
      >
        {expanded ? " Leer menos" : "Leer más"}
      </button>
    </p>
  );
}
