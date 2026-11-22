"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, AlertCircle, X } from "lucide-react";

/**
 * Toast flotante del portal (mismo diseño que el de /decisions). Sustituye a
 * los alert() del navegador: no bloquea, respeta el tema y se autodescarta.
 *
 *   const { toast, showToast, dismissToast } = useToast();
 *   ...
 *   <ToastViewport toast={toast} onDismiss={dismissToast} />
 */

export interface ToastState {
  message: string;
  type: "success" | "error";
}

export function useToast(autoHideMs = 4500) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastState["type"]) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      timer.current = setTimeout(() => setToast(null), autoHideMs);
    },
    [autoHideMs]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { toast, showToast, dismissToast };
}

export function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  // Sistema revisado: blanco, 12 px, sombra media, entra 8 px en 220 ms. El Saffron no se
  // gasta aquí (es «ahora» y ya tiene su pieza en la pantalla); el error lo dice la palabra
  // y el icono, en tinta, con el filete de peligro solo en el borde.
  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className="fixed inset-x-4 bottom-24 z-[110] flex justify-end animate-dlx-rise sm:inset-x-auto sm:right-6 lg:bottom-6"
    >
      <div
        className={`flex max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 text-ink shadow-[0_8px_24px_rgba(30,32,30,0.10)] ${
          toast.type === "success" ? "border-border" : "border-danger-ink/40"
        }`}
      >
        {toast.type === "success" ? (
          <Check className="mt-0.5 size-[18px] shrink-0 text-ink" aria-hidden />
        ) : (
          <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-danger-ink" aria-hidden />
        )}
        <span className="text-sm font-medium leading-snug">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="-m-2 ml-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-mute hover:bg-zinc-100 hover:text-ink"
          aria-label="Cerrar aviso"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
