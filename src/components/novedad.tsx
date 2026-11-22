"use client";

import { useEffect } from "react";
import { novedadCookie } from "@/lib/novedad-cookie";

/**
 * Marca como vista la versión de una pieza («se mueve lo que es de ahora»). La página,
 * en el servidor, decide con `esNovedad()` si la coreografía se reproduce; este
 * componente solo apunta, al montar, qué versión ha visto ya quien mira. Así no hay
 * scripts en línea ni parpadeos: el HTML ya llega con la animación o sin ella.
 */
export function MarcarVisto({ id, version }: { id: string; version: string | null | undefined }) {
  useEffect(() => {
    if (!version) return;
    document.cookie = `${novedadCookie(id)}=${encodeURIComponent(version)}; path=/; max-age=31536000; samesite=lax`;
  }, [id, version]);
  return null;
}
