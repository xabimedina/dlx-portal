"use client";

import React, { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { endSession } from "@/lib/firebase/session";

export function LogoutButton({ variant = "header" }: { variant?: "header" | "row" } = {}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
      await endSession();

      // Recarga completa para limpiar cabeceras de cookies
      window.location.href = "/login";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setIsLoggingOut(false);
    }
  };

  const Icon = isLoggingOut ? Loader2 : LogOut;
  const label = isLoggingOut ? "Saliendo…" : "Cerrar sesión";

  // Fila de «Más › Tu cuenta», sobre claro: icono + texto, 52 px de alto, sin caja
  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex min-h-[52px] w-full items-center gap-3 text-left text-[15px] font-medium text-ink disabled:opacity-60"
      >
        <Icon className={`size-5 ${isLoggingOut ? "animate-spin" : ""}`} aria-hidden />
        {label}
      </button>
    );
  }

  // Cabecera Jet: píldora con borde claro; en pantallas estrechas solo el icono (44 px de zona táctil)
  return (
    <Button
      onClick={handleLogout}
      disabled={isLoggingOut}
      variant="outline"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="h-11 min-w-11 gap-1.5 rounded-full border-white/25 bg-transparent px-3 text-[13px] font-semibold text-whitesmoke hover:bg-white/10 hover:text-white sm:px-4 dark:border-white/25 dark:bg-transparent dark:hover:bg-white/10 dark:hover:text-white"
    >
      <Icon className={`size-4 ${isLoggingOut ? "animate-spin" : ""}`} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
