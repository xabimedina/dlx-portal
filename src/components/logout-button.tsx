"use client";

import React, { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { endSession } from "@/lib/firebase/session";

export function LogoutButton() {
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

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoggingOut}
      variant="outline"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="font-mono text-xs uppercase tracking-wider border-white/25 bg-transparent text-whitesmoke hover:bg-white/10 hover:text-white dark:border-white/25 dark:bg-transparent dark:hover:bg-white/10 dark:hover:text-white"
    >
      {/* En pantallas estrechas queda solo el icono para no invadir el header */}
      {isLoggingOut ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
          <span className="hidden sm:inline">Saliendo...</span>
        </>
      ) : (
        <>
          <LogOut className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-500 sm:mr-1.5" />
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </>
      )}
    </Button>
  );
}
