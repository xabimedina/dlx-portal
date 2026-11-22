"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Mail, MailCheck } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { sendSignInLinkToEmail } from "firebase/auth";
import { EMAIL_FOR_SIGN_IN_KEY } from "@/lib/firebase/email-link";
import { BrandLogo } from "@/components/brand-logo";
import { StateBadge } from "@/components/portal-ui";

/**
 * Acceso sin contraseña (email link de Firebase): el cliente escribe su email
 * y recibe un enlace de un solo uso que completa la página /acceso.
 *
 * Diseño (fase 2): portada Jet con el logotipo y la línea del método (la textura de
 * marcos solo detrás del dibujo) y el acceso en zona clara: campo con borde de control,
 * botón píldora Jet y el estado «enlace enviado». Pantalla tranquila: nada se anima al
 * cargar. El rojo solo aparece en el error del formulario.
 */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Al llegar a «enlace enviado», el foco pasa al titular (teclado y lector de pantalla)
  const enfocar = useCallback((el: HTMLHeadingElement | null) => el?.focus(), []);

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
    } catch (err) {
      // Mensaje idéntico exista o no el correo, para no revelar qué emails
      // están autorizados; solo los errores de formato se detallan.
      if ((err as { code?: string } | null)?.code === "auth/invalid-email") {
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
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      {/* ── Portada Jet ── */}
      <section
        aria-labelledby="acceso-titulo"
        className="dark flex flex-col bg-jet px-4 pt-4 pb-8 text-whitesmoke sm:px-6 lg:sticky lg:top-0 lg:h-dvh lg:px-12 lg:pt-8 lg:pb-12"
      >
        <div className="flex items-center justify-between gap-3">
          <BrandLogo className="h-7 sm:h-8" />
          <Link
            href="/"
            className="-mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-zinc-200 hover:bg-white/10 hover:text-whitesmoke"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver al inicio
          </Link>
        </div>

        <div className="lg:my-auto">
          {/* Zona del dibujo: la textura de marcos vive solo aquí, detrás de la línea del método
              (proyecto, obra, llaves). Decorativa y quieta. */}
          <div aria-hidden className="tex-marcos -mx-4 mt-5 flex h-36 items-center px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:h-52 lg:px-12">
            <svg viewBox="0 0 350 62" className="h-auto w-full max-w-[350px] overflow-visible lg:max-w-[440px]" focusable="false">
              <path d="M0 14 H236" stroke="#f5f3f4" strokeWidth="3" strokeLinecap="round" fill="none" />
              <path d="M246 14 H332" stroke="#8c9089" strokeWidth="2" strokeDasharray="5 5" fill="none" />
              <g fill="#f5f3f4">
                {[14, 32, 50, 68, 86, 104, 122, 140, 158].map((cx) => (
                  <circle key={cx} cx={cx} cy="14" r="4" />
                ))}
              </g>
              <circle cx="236" cy="14" r="9" fill="#333533" stroke="#f5f3f4" strokeWidth="2" />
              <circle cx="342" cy="14" r="6" fill="#333533" stroke="#8c9089" strokeWidth="2" />
              <g fontFamily="Montserrat, system-ui, sans-serif" fontSize="12" fontWeight="600" letterSpacing="1.7" fill="#9da19a">
                <text x="86" y="44" textAnchor="middle">PROYECTO</text>
                <text x="236" y="44" textAnchor="middle">OBRA</text>
                <text x="350" y="44" textAnchor="end">LLAVES</text>
              </g>
            </svg>
          </div>

          <div className="mt-4 space-y-3 lg:mt-8">
            <p className="eyebrow">Portal de clientes</p>
            <h1 id="acceso-titulo" className="display-portal text-whitesmoke [text-wrap:balance]">
              Tu casa, fase a fase
            </h1>
          </div>
        </div>
      </section>

      {/* ── Acceso por enlace ── */}
      <main className="flex flex-1 flex-col px-4 sm:px-6 lg:px-12">
        <div className="mx-auto w-full max-w-md pt-7 lg:my-auto lg:pt-12">
          {linkSent ? (
            /* Estado: enlace enviado */
            <section role="status" aria-live="polite" aria-labelledby="acceso-enviado">
              <StateBadge tone="done" icon={<MailCheck aria-hidden />}>
                Enlace enviado
              </StateBadge>
              <h2
                id="acceso-enviado"
                tabIndex={-1}
                ref={enfocar}
                className="mt-4 text-2xl leading-[1.1] tracking-[0.02em] text-ink outline-none"
              >
                Revisa tu correo
              </h2>
              <p className="mt-3 text-base leading-[1.55] text-ink [text-wrap:pretty]">
                Si <strong className="font-semibold [overflow-wrap:anywhere]">{email.trim().toLowerCase()}</strong> está dado
                de alta, te hemos enviado un enlace para entrar al portal. Ábrelo desde este dispositivo para acceder
                directamente.
              </p>
              <p className="mt-2 flex gap-2 text-sm leading-[1.5] text-ink-soft">
                <Mail className="mt-0.5 size-4 shrink-0 text-ink-mute" aria-hidden />
                <span>Revisa también la carpeta de spam.</span>
              </p>
              <button
                type="button"
                onClick={() => { setLinkSent(false); setSuccessMsg(null); }}
                className="mt-6 inline-flex min-h-11 items-center rounded-full border border-control-line px-5 text-sm font-semibold text-ink hover:border-jet hover:bg-zinc-100"
              >
                ¿No te llega? Vuelve a intentarlo
              </button>
            </section>
          ) : (
            <section aria-label="Acceso por correo">
              <p className="text-base leading-[1.55] text-ink [text-wrap:pretty]">
                Sin contraseñas: escribe tu correo y te enviamos un enlace de acceso seguro.
              </p>

              <form onSubmit={handleSubmit} className="mt-6">
                {/* Mensajes: el rojo, solo para el error del formulario */}
                {errorMsg && (
                  <div
                    role="alert"
                    className="mb-5 flex gap-3 rounded-lg border border-danger-ink/30 bg-danger-surface px-4 py-3.5 text-sm leading-[1.5] text-danger-ink"
                  >
                    <AlertCircle className="mt-0.5 size-[18px] shrink-0" aria-hidden />
                    <p className="font-medium">{errorMsg}</p>
                  </div>
                )}
                {successMsg && (
                  <div role="status" className="mb-5 rounded-lg border border-border bg-[#eceaeb] px-4 py-3.5 text-sm text-ink">
                    {successMsg}
                  </div>
                )}

                <label htmlFor="email" className="block text-sm font-semibold text-ink">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby="email-ayuda"
                  required
                  className="mt-2 block h-13 w-full rounded-md border-[1.5px] border-control-line bg-white px-4 text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-mute"
                />

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-3.5 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-jet px-7 text-[15px] font-semibold text-whitesmoke hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-80"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Enviando…
                    </>
                  ) : (
                    <>
                      Enviarme el enlace de acceso <ArrowRight className="size-4" aria-hidden />
                    </>
                  )}
                </button>

                <p id="email-ayuda" className="mt-3.5 flex gap-2 text-sm leading-[1.5] text-ink-soft">
                  <Mail className="mt-0.5 size-4 shrink-0 text-ink-mute" aria-hidden />
                  <span>Usa el correo con el que el estudio te dio de alta en tu obra.</span>
                </p>
              </form>
            </section>
          )}
        </div>

        <footer className="mx-auto mt-auto w-full max-w-md pt-10 pb-8">
          <div className="border-t border-border pt-4">
            <p className="text-sm leading-[1.5] text-ink-soft">
              ¿No consigues entrar? Ponte en contacto con tu gestor en Despeja la X.
            </p>
            <p className="eyebrow mt-4">Tu hogar, listo y sin sorpresas.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
