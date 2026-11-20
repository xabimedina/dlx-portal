"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { establishSession } from "@/lib/firebase/session";
import { EMAIL_FOR_SIGN_IN_KEY } from "@/lib/firebase/email-link";
import { BrandLogo } from "@/components/brand-logo";

type Status =
  | { kind: "working" }
  | { kind: "need-email" } // el enlace se abrió en otro dispositivo: confirmar email
  | { kind: "error"; message: string };

/**
 * Destino del enlace de acceso por email (Firebase email link sign-in).
 * Completa el inicio de sesión, crea la cookie de sesión del servidor y
 * redirige al dashboard. Si el enlace se abre en un dispositivo distinto al
 * que lo pidió, Firebase exige confirmar el email tecleándolo una vez.
 */
export default function AccesoPage() {
  const [status, setStatus] = useState<Status>({ kind: "working" });
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startedRef = useRef(false);

  const completeSignIn = async (emailToUse: string) => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setStatus({ kind: "error", message: "La autenticación de Firebase no está configurada." });
      return;
    }
    try {
      const credential = await signInWithEmailLink(auth, emailToUse, window.location.href);
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);

      const idToken = await credential.user.getIdToken();
      const result = await establishSession(idToken);
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error || "No se pudo iniciar la sesión." });
        return;
      }
      window.location.replace("/dashboard");
    } catch (err: any) {
      console.error("Error completando el acceso por enlace:", err);
      if (err?.code === "auth/invalid-action-code" || err?.code === "auth/expired-action-code") {
        setStatus({
          kind: "error",
          message: "Este enlace ya se usó o ha caducado. Pide uno nuevo desde la página de acceso.",
        });
      } else if (err?.code === "auth/invalid-email") {
        setStatus({ kind: "need-email" });
      } else {
        setStatus({ kind: "error", message: "No se pudo completar el acceso. Pide un enlace nuevo e inténtalo otra vez." });
      }
    }
  };

  useEffect(() => {
    if (startedRef.current) return; // el StrictMode de desarrollo monta dos veces
    startedRef.current = true;

    const auth = getFirebaseAuth();
    if (!auth || !isSignInWithEmailLink(auth, window.location.href)) {
      setStatus({ kind: "error", message: "Este enlace de acceso no es válido. Pide uno nuevo desde la página de acceso." });
      return;
    }
    const savedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
    if (savedEmail) {
      void completeSignIn(savedEmail);
    } else {
      // Enlace abierto en un dispositivo distinto al que lo solicitó
      setStatus({ kind: "need-email" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setIsSubmitting(true);
    setStatus({ kind: "working" });
    await completeSignIn(cleanEmail);
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

      <div className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md">
          <Card className="border border-zinc-200/80 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/90 shadow-2xl backdrop-blur-md transition-all duration-300">
            <CardHeader className="space-y-3 pt-8 text-center border-b border-zinc-100 dark:border-zinc-800/80 pb-6">
              <div className="flex justify-center mb-1">
                <BrandLogo className="h-9" />
              </div>
              <CardTitle className="text-xl tracking-tight text-zinc-900 dark:text-white">
                Completando tu acceso
              </CardTitle>
              <CardDescription className="text-zinc-600 dark:text-zinc-400 text-xs max-w-[280px] mx-auto">
                Portal de Clientes de Despeja la X
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-8 pb-8">
              {status.kind === "working" && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Verificando tu enlace de acceso...
                  </p>
                </div>
              )}

              {status.kind === "need-email" && (
                <form onSubmit={handleConfirmEmail} className="space-y-5">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Has abierto el enlace en un dispositivo distinto al que lo pidió.
                    Por seguridad, confirma el correo al que se envió:
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-email" className="text-xs font-mono tracking-wider uppercase text-zinc-600 dark:text-zinc-400">
                      Correo Electrónico
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                      <Input
                        id="confirm-email"
                        type="email"
                        placeholder="ejemplo@despejalax.es"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-10 border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-white"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 font-mono text-xs uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-all duration-300"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
                      </>
                    ) : (
                      "Confirmar y entrar"
                    )}
                  </Button>
                </form>
              )}

              {status.kind === "error" && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <ShieldAlert className="h-10 w-10 text-amber-500 bg-amber-500/10 p-2 rounded-full" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-[300px]">
                    {status.message}
                  </p>
                  <Link href="/login" className="w-full">
                    <Button
                      variant="outline"
                      className="w-full h-10 font-mono text-[10px] uppercase tracking-widest border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      Pedir un enlace nuevo
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
