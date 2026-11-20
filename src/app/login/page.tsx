"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { sendSignInLinkToEmail } from "firebase/auth";
import { EMAIL_FOR_SIGN_IN_KEY } from "@/lib/firebase/email-link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Acceso sin contraseña (email link de Firebase): el cliente escribe su email
 * y recibe un enlace de un solo uso que completa la página /acceso.
 */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Pequeño retardo visual para mostrar la hermosa micro-animación de carga
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        setErrorMsg("Escribe tu correo electrónico.");
        return;
      }

      const auth = getFirebaseAuth();
      if (!auth) {
        setErrorMsg("La autenticación de Firebase no está configurada.");
        return;
      }
      await sendSignInLinkToEmail(auth, cleanEmail, {
        url: `${window.location.origin}/acceso`,
        handleCodeInApp: true,
      });
      // Recordar el email para que /acceso no lo pida en este dispositivo
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, cleanEmail);
      setLinkSent(true);
    } catch (err: any) {
      // Mensaje idéntico exista o no el correo, para no revelar qué emails
      // están autorizados; solo los errores de formato se detallan.
      if (err?.code === "auth/invalid-email") {
        setErrorMsg("El correo no tiene un formato válido; revísalo.");
      } else {
        console.error("Error enviando el enlace de acceso:", err);
        setErrorMsg("No se pudo enviar el enlace de acceso. Inténtalo de nuevo en unos minutos.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 relative overflow-hidden">
      {/* Fondo con retícula de plano arquitectónico */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

      {/* Botón superior de retorno al Home público */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/">
          <Button variant="ghost" className="font-mono text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-900/50 transition-colors duration-200">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver al Inicio
          </Button>
        </Link>
      </div>

      <div className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md">
          {/* Card Principal */}
          <Card className="border border-zinc-200/80 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/90 shadow-2xl backdrop-blur-md transition-all duration-300">
            <CardHeader className="space-y-3 pt-8 text-center border-b border-zinc-100 dark:border-zinc-800/80 pb-6">
              <div className="flex justify-center mb-1">
                <BrandLogo className="h-9" />
              </div>
              <CardTitle className="text-xl tracking-tight text-zinc-900 dark:text-white">
                Acceso al Portal de Clientes
              </CardTitle>
              <CardDescription className="text-zinc-600 dark:text-zinc-400 text-xs max-w-[280px] mx-auto">
                Sin contraseñas: escribe tu correo y te enviaremos un enlace de acceso seguro.
              </CardDescription>
            </CardHeader>

            {linkSent ? (
              /* Estado: enlace enviado */
              <CardContent className="space-y-5 pt-8 pb-8 text-center">
                <MailCheck className="h-12 w-12 text-zinc-800 bg-zinc-100 p-2.5 rounded-full mx-auto" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">Revisa tu correo</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-[300px] mx-auto leading-relaxed">
                    Si <span className="font-mono">{email.trim().toLowerCase()}</span> está dado de alta,
                    te hemos enviado un enlace para entrar al portal. Ábrelo desde este dispositivo
                    para acceder directamente. Revisa también la carpeta de spam.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setLinkSent(false); setSuccessMsg(null); }}
                  className="text-[10px] font-mono tracking-wide text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:underline"
                >
                  ¿No te llega? Vuelve a intentarlo
                </button>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-5 pt-6">
                  {/* Mensajes de Alerta */}
                  {errorMsg && (
                    <div className="p-3 text-xs bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg">
                      {errorMsg}
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3 text-xs bg-zinc-100  text-zinc-800  border border-zinc-200  rounded-lg">
                      {successMsg}
                    </div>
                  )}

                  {/* Campo Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-mono tracking-wider uppercase text-zinc-600 dark:text-zinc-400">
                      Correo Electrónico
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="ejemplo@despejalax.es"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-10 border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-white"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
                      Usa el correo con el que el estudio te dio de alta en tu obra.
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col space-y-4 pb-8 pt-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 font-mono text-xs uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-all duration-300"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                      </>
                    ) : (
                      "Enviarme el enlace de acceso"
                    )}
                  </Button>

                  <div className="text-[10px] text-zinc-600 dark:text-zinc-400 text-center max-w-[280px]">
                    Si eres cliente y no consigues acceder, ponte en contacto con tu gestor en Despeja la X.
                  </div>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
