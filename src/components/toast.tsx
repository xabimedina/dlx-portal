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
  return (
    <div className="fixed bottom-20 right-6 z-[110] animate-in slide-in-from-bottom-5 duration-300 lg:bottom-6">
      <div
        className={`flex items-center space-x-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg ${
          toast.type === "success"
            ? "bg-zinc-900/95 text-white border-zinc-800 dark:bg-white/95 dark:text-zinc-950 dark:border-zinc-200"
            : "bg-amber-500/95 text-zinc-900 border-amber-600"
        }`}
      >
        {toast.type === "success" ? (
          <Check className="h-4.5 w-4.5 bg-zinc-500/20 p-0.5 rounded-full shrink-0" />
        ) : (
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
        )}
        <span className="text-xs font-mono font-medium">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="opacity-60 hover:opacity-100 transition-opacity ml-2 shrink-0"
          aria-label="Cerrar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
