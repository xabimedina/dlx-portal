"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldAlert } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { establishSession } from "@/lib/firebase/session";
import { EMAIL_FOR_SIGN_IN_KEY } from "@/lib/firebase/email-link";
import { AccessShell } from "@/components/access-shell";
import { StateBadge } from "@/components/portal-ui";

type Status =
  | { kind: "working" }
  | { kind: "need-email" } // el enlace se abrió en otro dispositivo: confirmar email
  | { kind: "error"; message: string };

/**
 * Destino del enlace de acceso por email (Firebase email link sign-in).
 * Completa el inicio de sesión, crea la cookie de sesión del servidor y
 * redirige al dashboard. Si el enlace se abre en un dispositivo distinto al
 * que lo pidió, Firebase exige confirmar el email tecleándolo una vez.
 *
 * Diseño (fase 2): la misma portada Jet que /login (logotipo, línea del método y
 * titular) y, en la zona clara, el estado: verificando (en curso), confirmar el correo
 * (campo con borde de control y botón píldora Jet) o el enlace que no sirve (aviso
 * neutro y «Pedir un enlace nuevo»). Pantalla tranquila: solo gira el indicador de carga.
 */
export default function AccesoPage() {
  const [status, setStatus] = useState<Status>({ kind: "working" });
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startedRef = useRef(false);
  // Si el acceso no se completa, el foco pasa al titular del aviso (teclado y lector de pantalla)
  const enfocar = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);

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
    } catch (err) {
      console.error("Error completando el acceso por enlace:", err);
      const code = (err as { code?: string } | null)?.code;
      if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") {
        setStatus({
          kind: "error",
          message: "Este enlace ya se usó o ha caducado. Pide uno nuevo desde la página de acceso.",
        });
      } else if (code === "auth/invalid-email") {
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
    <AccessShell
      titleId="acceso-titulo"
      action={
        <Link
          href="/"
          className="-mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-zinc-200 hover:bg-white/10 hover:text-whitesmoke"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al inicio
        </Link>
      }
      footerNote="¿No consigues entrar? Ponte en contacto con tu gestor en Despeja la X."
    >
      {status.kind === "working" && (
        /* Estado: verificando el enlace (en curso) */
        <section role="status" aria-live="polite" aria-labelledby="acceso-verificando">
          <StateBadge tone="progress" icon={<Loader2 className="animate-spin" aria-hidden />}>
            Verificando el enlace
          </StateBadge>
          <h2 id="acceso-verificando" className="mt-4 text-2xl leading-[1.1] tracking-[0.02em] text-ink">
            Completando tu acceso
          </h2>
          <p className="mt-3 text-base leading-[1.55] text-ink [text-wrap:pretty]">
            Estamos comprobando tu enlace de acceso. En un momento entras al portal.
          </p>
        </section>
      )}

      {status.kind === "need-email" && (
        /* Estado: el enlace se abrió en otro dispositivo; confirmar el correo */
        <section aria-labelledby="acceso-confirmar">
          <h2 id="acceso-confirmar" className="text-2xl leading-[1.1] tracking-[0.02em] text-ink">
            Confirma tu correo
          </h2>
          <p id="confirmar-ayuda" className="mt-3 text-base leading-[1.55] text-ink [text-wrap:pretty]">
            Has abierto el enlace en un dispositivo distinto al que lo pidió. Por seguridad, confirma el correo al que
            se envió.
          </p>

          <form onSubmit={handleConfirmEmail} className="mt-6">
            <label htmlFor="confirm-email" className="block text-sm font-semibold text-ink">
              Correo electrónico
            </label>
            <input
              id="confirm-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="confirmar-ayuda"
              required
              autoFocus
              className="mt-2 block h-13 w-full rounded-md border-[1.5px] border-control-line bg-white px-4 text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-mute"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-3.5 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-jet px-7 text-[15px] font-semibold text-whitesmoke hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-80"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Entrando…
                </>
              ) : (
                <>
                  Confirmar y entrar <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </button>

            <p className="mt-3.5 flex gap-2 text-sm leading-[1.5] text-ink-soft">
              <Mail className="mt-0.5 size-4 shrink-0 text-ink-mute" aria-hidden />
              <span>Es el mismo correo con el que pediste el enlace.</span>
            </p>
          </form>
        </section>
      )}

      {status.kind === "error" && (
        /* Estado: el enlace no sirve (aviso neutro: en el portal no hay rojo fuera del formulario) */
        <section aria-labelledby="acceso-error">
          <StateBadge tone="quiet" icon={<ShieldAlert aria-hidden />}>
            Acceso sin completar
          </StateBadge>
          <h2
            id="acceso-error"
            tabIndex={-1}
            ref={enfocar}
            className="mt-4 text-2xl leading-[1.1] tracking-[0.02em] text-ink outline-none focus-visible:[box-shadow:none]"
          >
            No hemos podido completar tu acceso
          </h2>
          <p className="mt-3 text-base leading-[1.55] text-ink [text-wrap:pretty]">{status.message}</p>
          <Link
            href="/login"
            className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-jet px-7 text-[15px] font-semibold text-whitesmoke hover:bg-zinc-700"
          >
            Pedir un enlace nuevo <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      )}
    </AccessShell>
  );
}
