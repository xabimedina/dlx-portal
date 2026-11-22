"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, ChevronDown, ChevronUp, SquareCheck } from "lucide-react";
import type { PortalDocument, PortalPhase, PortalPhoto } from "@/types/portal";
import { validateDecisionAction, requestDecisionReviewAction, getSignedDocumentUrlAction } from "../../../actions";
import { useToast, ToastViewport } from "@/components/toast";
import { Eyebrow, SecHead, StatusBadge, statusOf } from "@/components/portal-ui";
import { PhotoImage } from "@/components/photo-image";
import { cn } from "@/lib/utils";
import {
  type Decision,
  type Grupo,
  diaMes,
  entradilla,
  esEditable,
  etiquetaFoto,
  grupoDe,
  ordenarDecididas,
  ordenarPendientes,
} from "./decision-utils";
import {
  DocumentoVinculado,
  FotosDecision,
  Historial,
  MetaLinea,
  Plazo,
  Recomendacion,
  Registro,
  RespuestaForm,
} from "./decision-parts";
import { PhotoViewer } from "./photo-viewer";

interface DecisionsClientProps {
  initialDecisions: Decision[];
  phases: PortalPhase[];
  documents: PortalDocument[];
  /** Solo las fotos adjuntas a una decisión, ya con URL firmada. */
  photos?: PortalPhoto[];
  projectName: string;
  /** Hoy (aaaa-mm-dd, Madrid), calculado en el servidor para pintar igual en los dos lados. */
  today: string;
  /** Hay una decisión pendiente nueva para quien mira: se reproduce la entrada de las tarjetas. */
  nuevo: boolean;
}

type FiltroEstado = "todas" | Grupo;
type RegistroEstado = { id: string; title: string; tipo: "validada" | "revision"; origen: "pendientes" | "decididas"; n: number };

const SIN_FASE = "sin-fase";
/** En «Todas», las cerradas más antiguas que estas quedan plegadas. */
const CERRADAS_VISIBLES = 3;

export function DecisionsClient({
  initialDecisions,
  phases,
  documents,
  photos = [],
  projectName,
  today,
  nuevo,
}: DecisionsClientProps) {
  // Filtros (chips): estado y fase
  const [estado, setEstado] = useState<FiltroEstado>("todas");
  const [fase, setFase] = useState<string>("todas");

  // Comentario escrito por decisión
  const [clientComments, setClientComments] = useState<Record<string, string>>({});

  // Acciones, confirmación y errores
  const [isPending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);
  const [registro, setRegistro] = useState<RegistroEstado | null>(null);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();

  // Visor de fotos
  const [visor, setVisor] = useState<{ decisionId: string; index: number } | null>(null);

  // La coreografía se decide una vez (servidor) y no se repite al refrescar tras votar
  const [animarEntrada] = useState(nuevo);

  const phaseById = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);
  const faseDe = (d: Decision) => d.phase_id || SIN_FASE;
  const etiquetaFase = (id: string) => {
    const p = phaseById.get(id);
    return p ? `${p.phase_number} · ${p.name}` : "Diseño general";
  };

  // Fotos por decisión, en el orden en que el estudio las subió (A, B…)
  const fotosDe = useMemo(() => {
    const map = new Map<string, PortalPhoto[]>();
    const enOrden = [...photos].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    for (const ph of enOrden) {
      if (!ph.decision_id) continue;
      map.set(ph.decision_id, [...(map.get(ph.decision_id) ?? []), ph]);
    }
    return map;
  }, [photos]);

  // Enlaces profundos (#decision-<id>): abre la decisión (y su grupo plegado) y la muestra
  useEffect(() => {
    const abrir = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith("decision-")) return;
      const el = document.getElementById(hash);
      if (!el) return;
      for (let p: HTMLElement | null = el; p; p = p.parentElement) {
        if (p instanceof HTMLDetailsElement) p.open = true;
      }
      const propia = el.querySelector("details");
      if (propia) propia.open = true;
      el.scrollIntoView({ block: "start" });
    };
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);

  // ── Acciones (las mismas de siempre) ────────────────────────────────────────────
  const handleValidateDecision = (decision: Decision, origen: RegistroEstado["origen"]) => {
    const comment = clientComments[decision.id] || "";
    setActingId(decision.id);
    startTransition(async () => {
      try {
        await validateDecisionAction(decision.id, comment);
        setRegistro((r) => ({ id: decision.id, title: decision.title, tipo: "validada", origen, n: (r?.n ?? 0) + 1 }));
      } catch (err) {
        console.error(err);
        showToast("No se pudo validar la decisión.", "error");
      } finally {
        setActingId(null);
      }
    });
  };

  const handleRequestReview = (decision: Decision, origen: RegistroEstado["origen"]) => {
    const comment = clientComments[decision.id] || "";
    if (!comment.trim()) {
      showToast("Escribe primero el motivo por el que pides la revisión.", "error");
      return;
    }
    setActingId(decision.id);
    startTransition(async () => {
      try {
        await requestDecisionReviewAction(decision.id, comment);
        setRegistro((r) => ({ id: decision.id, title: decision.title, tipo: "revision", origen, n: (r?.n ?? 0) + 1 }));
      } catch (err) {
        console.error(err);
        showToast("No se pudo enviar la solicitud de revisión.", "error");
      } finally {
        setActingId(null);
      }
    });
  };

  const handleDownload = async (doc: PortalDocument) => {
    setDescargandoId(doc.id);
    try {
      const url = doc.storage_path ? await getSignedDocumentUrlAction(doc.storage_path) : doc.file_url;
      window.open(url, "_blank", "noopener");
    } catch (err) {
      console.error(err);
      showToast("No se pudo preparar la descarga del archivo. Inténtalo de nuevo en un momento.", "error");
    } finally {
      setDescargandoId(null);
    }
  };

  // ── Filtrado y recuentos (cada filtro cuenta con el otro aplicado) ──────────────
  const porFase = initialDecisions.filter((d) => fase === "todas" || faseDe(d) === fase);
  const porEstado = initialDecisions.filter((d) => estado === "todas" || grupoDe(d.status) === estado);
  const filtradas = porFase.filter((d) => estado === "todas" || grupoDe(d.status) === estado);

  const cuentaEstado = (g: FiltroEstado) => porFase.filter((d) => g === "todas" || grupoDe(d.status) === g).length;
  const chipsEstado: Array<{ value: FiltroEstado; label: string; count: number }> = [
    { value: "todas", label: "Todas", count: cuentaEstado("todas") },
    { value: "pendientes", label: "Pendientes", count: cuentaEstado("pendientes") },
    { value: "esperando", label: "Esperando al estudio", count: cuentaEstado("esperando") },
    { value: "cerradas", label: "Cerradas", count: cuentaEstado("cerradas") },
  ];

  const fasesConDecisiones = [...new Set(initialDecisions.map(faseDe))].sort((a, b) => {
    const oa = phaseById.get(a)?.order_index ?? Number.MAX_SAFE_INTEGER;
    const ob = phaseById.get(b)?.order_index ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });
  const chipsFase = [
    { value: "todas", label: "Todas las fases", count: porEstado.length },
    ...fasesConDecisiones.map((id) => ({
      value: id,
      label: etiquetaFase(id),
      count: porEstado.filter((d) => faseDe(d) === id).length,
    })),
  ];

  const pendientes = ordenarPendientes(filtradas.filter((d) => grupoDe(d.status) === "pendientes"));
  const decididas = ordenarDecididas(filtradas.filter((d) => grupoDe(d.status) !== "pendientes"));
  const esperando = decididas.filter((d) => grupoDe(d.status) === "esperando");
  const cerradas = decididas.filter((d) => grupoDe(d.status) === "cerradas");
  const plegadas = estado === "todas" ? cerradas.slice(CERRADAS_VISIBLES) : [];
  const visibles = [...esperando, ...(estado === "todas" ? cerradas.slice(0, CERRADAS_VISIBLES) : cerradas)];

  const todasPendientes = initialDecisions.filter((d) => d.status === "Pendiente");
  const registroEn = (origen: RegistroEstado["origen"]) =>
    registro && registro.origen === origen ? (
      <Registro key={`${registro.id}-${registro.n}`} tipo={registro.tipo} title={registro.title} />
    ) : null;

  // ── Piezas de una decisión ──────────────────────────────────────────────────────
  const cuerpo = (decision: Decision, opts: { ahora?: boolean; densa?: boolean; origen: RegistroEstado["origen"] }) => {
    const fotos = fotosDe.get(decision.id) ?? [];
    const linkedDoc = decision.document_id ? documents.find((d) => d.id === decision.document_id) : undefined;
    const descartada = decision.status === "Cancelado";
    return (
      <>
        {decision.description && (
          <p className={cn("text-pretty text-base leading-[1.6]", descartada ? "text-ink-mute" : "text-ink-soft")}>
            {decision.description}
          </p>
        )}
        <FotosDecision
          photos={fotos}
          title={decision.title}
          densa={opts.densa}
          onOpen={(index) => setVisor({ decisionId: decision.id, index })}
          className="mt-5"
        />
        {decision.studio_recommendation && !descartada && (
          <Recomendacion texto={decision.studio_recommendation} className="mt-5" />
        )}
        {linkedDoc && (
          <DocumentoVinculado
            doc={linkedDoc}
            busy={descargandoId === linkedDoc.id}
            onDownload={() => handleDownload(linkedDoc)}
            className="mt-5"
          />
        )}
        <Historial decision={decision} className="mt-5" />
        {esEditable(decision.status) && (
          <RespuestaForm
            decision={decision}
            value={clientComments[decision.id] || ""}
            onChange={(value) => setClientComments((c) => ({ ...c, [decision.id]: value }))}
            disabled={isPending}
            acting={actingId === decision.id}
            ahora={opts.ahora}
            onValidate={() => handleValidateDecision(decision, opts.origen)}
            onReview={() => handleRequestReview(decision, opts.origen)}
          />
        )}
      </>
    );
  };

  const tarjetaPendiente = (decision: Decision, index: number) => {
    const destacada = index === 0;
    const fotos = fotosDe.get(decision.id) ?? [];
    const miniatura = fotos[0];
    // La pieza «ahora»: el plazo de la más urgente o, si no tiene plazo, su «tu elección»
    const ahoraEnPlazo = destacada && !!decision.due_date;
    const ahoraEnEleccion = destacada && !decision.due_date;
    return (
      <article
        key={decision.id}
        id={`decision-${decision.id}`}
        aria-labelledby={`decision-${decision.id}-t`}
        style={{ "--i": index } as React.CSSProperties}
        className={cn(
          "scroll-mt-24 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(51,53,51,0.06)]",
          "in-[.novedad]:animate-dlx-rise in-[.novedad]:[animation-delay:calc(var(--i)*var(--stagger))]",
          destacada ? "p-[18px] sm:p-6" : "p-4 sm:p-5",
        )}
      >
        {destacada ? (
          <>
            <MetaLinea fase={etiquetaFase(faseDe(decision))} priority={decision.priority} />
            <h2 id={`decision-${decision.id}-t`} className="mt-2 text-balance text-[22px] leading-[1.15] text-ink">
              {decision.title}
            </h2>
            <StatusBadge kind="decision" status={decision.status} className="mt-3" />
            <Plazo due={decision.due_date} today={today} ahora={ahoraEnPlazo} className="mt-3" />
            <div className="mt-4">{cuerpo(decision, { ahora: ahoraEnEleccion, origen: "pendientes" })}</div>
          </>
        ) : (
          <>
            <div className={cn("grid items-start gap-3.5", miniatura && "grid-cols-[96px_minmax(0,1fr)]")}>
              {miniatura && (
                <button
                  type="button"
                  onClick={() => setVisor({ decisionId: decision.id, index: 0 })}
                  aria-label={`Ver en grande: ${miniatura.caption || `foto de «${decision.title}»`}`}
                  className="block rounded-md text-left"
                >
                  <span className="relative block aspect-square overflow-hidden rounded-md border border-border bg-zinc-100">
                    <PhotoImage
                      photo={miniatura}
                      mode="gallery"
                      fill
                      className="object-cover"
                      alt={miniatura.caption || `Foto de la decisión «${decision.title}»`}
                    />
                  </span>
                  {/* A 96 px la etiqueta sobre la foto se cortaría: va debajo, igual de honesta */}
                  {etiquetaFoto(miniatura) && (
                    <span className="mt-1.5 block text-xs font-semibold uppercase leading-[1.3] tracking-[0.06em] text-ink-soft">
                      {etiquetaFoto(miniatura)}
                    </span>
                  )}
                </button>
              )}
              <div className="min-w-0">
                <MetaLinea fase={etiquetaFase(faseDe(decision))} priority={decision.priority} />
                <h2 id={`decision-${decision.id}-t`} className="mt-1.5 text-balance text-lg leading-[1.2] text-ink">
                  {decision.title}
                </h2>
                <StatusBadge kind="decision" status={decision.status} className="mt-2.5" />
                <Plazo due={decision.due_date} today={today} className="mt-2.5" />
              </div>
            </div>
            {/* El navegador abre solo un <details> si el enlace (#decision-…) apunta dentro: no es un desajuste */}
            <details className="group/d" suppressHydrationWarning>
              <summary
                className={cn(
                  "mt-4 flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-control-line px-6 text-sm font-semibold text-ink hover:bg-zinc-100 sm:w-fit [&::-webkit-details-marker]:hidden",
                  miniatura && "sm:ml-[110px]",
                )}
              >
                <span className="group-open/d:hidden">Ver y decidir</span>
                <ArrowRight className="size-4 group-open/d:hidden" aria-hidden />
                <span className="hidden group-open/d:inline">Plegar</span>
                <ChevronUp className="hidden size-4 group-open/d:block" aria-hidden />
              </summary>
              <div className="mt-5">{cuerpo(decision, { origen: "pendientes" })}</div>
            </details>
          </>
        )}
      </article>
    );
  };

  const filaDecidida = (decision: Decision) => {
    const s = statusOf("decision", decision.status);
    const fecha = decision.status === "Validada" ? diaMes(decision.validated_at) : "";
    return (
      <li key={decision.id} id={`decision-${decision.id}`} className="scroll-mt-24 border-b border-border">
        <details className="group/f" suppressHydrationWarning>
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-[1.4] text-ink">{decision.title}</p>
              {decision.client_response && (
                <p className="mt-0.5 line-clamp-1 text-sm leading-[1.5] text-ink-soft">{decision.client_response}</p>
              )}
              <StatusBadge
                kind="decision"
                status={decision.status}
                label={fecha ? `${s.label} · ${fecha}` : undefined}
                className="mt-2.5"
              />
            </div>
            <ChevronDown className="size-5 text-ink-mute transition-transform group-open/f:rotate-180" aria-hidden />
          </summary>
          <div className="pb-6">
            <MetaLinea fase={etiquetaFase(faseDe(decision))} priority={decision.priority} className="mb-3" />
            {cuerpo(decision, { densa: true, origen: "decididas" })}
          </div>
        </details>
      </li>
    );
  };

  const fotosVisor = visor ? fotosDe.get(visor.decisionId) ?? [] : [];
  const tituloVisor = visor ? initialDecisions.find((d) => d.id === visor.decisionId)?.title ?? "" : "";
  const mostrarPendientes = estado === "todas" || estado === "pendientes";
  const mostrarDecididas = estado !== "pendientes";
  const hayRegistroPendiente = registro?.origen === "pendientes";

  return (
    <div>
      {/* Cabecera */}
      <header>
        <Eyebrow>{projectName}</Eyebrow>
        <h1 className="display-portal mt-3.5 text-balance text-ink">Decisiones</h1>
        <p className="mt-3.5 max-w-[56ch] text-pretty text-base leading-[1.6] text-ink-soft">
          {initialDecisions.length === 0
            ? "Aquí eliges acabados, calidades o luminarias que te propone el estudio y das tu aprobación para que la obra avance."
            : entradilla(todasPendientes)}
        </p>
      </header>

      {initialDecisions.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-quiet-line px-6 py-10 text-center">
          <SquareCheck className="mx-auto size-6 text-ink-mute" aria-hidden />
          <p className="mt-3 text-base font-semibold text-ink">Aún no hay decisiones</p>
          <p className="mx-auto mt-1 max-w-[40ch] text-sm leading-[1.55] text-ink-soft">
            Cuando el estudio necesite que elijas algo, aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Filtros: chips con recuento en lugar de desplegables */}
          <div className="mt-6 space-y-2.5">
            <Chips legend="Filtrar las decisiones por estado" name="decision-estado" options={chipsEstado} value={estado} onChange={(v) => setEstado(v as FiltroEstado)} />
            {chipsFase.length > 2 && (
              <Chips legend="Filtrar las decisiones por fase" name="decision-fase" options={chipsFase} value={fase} onChange={setFase} scroll />
            )}
          </div>

          {/* Pendientes de ti: primero, la más urgente desplegada */}
          {mostrarPendientes && (pendientes.length > 0 || hayRegistroPendiente) && (
            <section
              aria-label="Pendientes de ti"
              className={cn("mt-6 space-y-4", animarEntrada && !registro && "novedad")}
            >
              {registroEn("pendientes")}
              {pendientes.map(tarjetaPendiente)}
            </section>
          )}

          {/* Ya decididas: lista tranquila, cada fila se despliega */}
          {mostrarDecididas && (decididas.length > 0 || registro?.origen === "decididas") && (
            <section aria-labelledby="dec-hechas" className="mt-12">
              <SecHead id="dec-hechas" title="Ya decididas" />
              {registro?.origen === "decididas" && <div className="mt-4">{registroEn("decididas")}</div>}
              <ul>{visibles.map(filaDecidida)}</ul>
              {plegadas.length > 0 && (
                <details className="group/mas" suppressHydrationWarning>
                  <summary className="mt-1 inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-ink hover:underline hover:underline-offset-4 [&::-webkit-details-marker]:hidden">
                    <span className="group-open/mas:hidden">
                      Ver {plegadas.length === 1 ? "la cerrada anterior" : `las ${plegadas.length} cerradas anteriores`}
                    </span>
                    <span className="hidden group-open/mas:inline">Ocultar las cerradas anteriores</span>
                    <ChevronDown className="size-4 transition-transform group-open/mas:rotate-180" aria-hidden />
                  </summary>
                  <ul>{plegadas.map(filaDecidida)}</ul>
                </details>
              )}
            </section>
          )}

          {/* Sin resultados con estos filtros */}
          {filtradas.length === 0 && !registro && (
            <div className="mt-6 rounded-xl border border-dashed border-quiet-line px-6 py-10 text-center">
              <p className="text-base font-semibold text-ink">Ninguna decisión coincide con los filtros aplicados</p>
              <button
                type="button"
                onClick={() => {
                  setEstado("todas");
                  setFase("todas");
                }}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-control-line px-6 text-sm font-semibold text-ink hover:bg-zinc-100"
              >
                Ver todas
              </button>
            </div>
          )}
        </>
      )}

      {visor && fotosVisor.length > 0 && (
        <PhotoViewer
          key={`${visor.decisionId}-${visor.index}`}
          photos={fotosVisor}
          start={visor.index}
          title={tituloVisor}
          onClose={() => setVisor(null)}
        />
      )}

      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

/** Chips de filtro: radios reales en píldoras, Jet al elegir, con su recuento. */
function Chips({
  legend,
  name,
  options,
  value,
  onChange,
  scroll,
}: {
  legend: string;
  name: string;
  options: Array<{ value: string; label: string; count: number }>;
  value: string;
  onChange: (value: string) => void;
  /** Una sola fila con desplazamiento lateral (las fases tienen nombres largos). */
  scroll?: boolean;
}) {
  return (
    <fieldset className={cn("min-w-0", scroll && "-mx-4 sm:mx-0")}>
      <legend className="sr-only">{legend}</legend>
      <div
        className={cn(
          "flex gap-2",
          scroll ? "overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden" : "flex-wrap",
        )}
      >
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex min-h-11 shrink-0 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold",
                "has-[:focus-visible]:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]",
                checked ? "border-jet bg-jet text-whitesmoke" : "border-control-line text-ink hover:bg-zinc-100",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
              <span className={cn("tabular-nums text-[13px] font-semibold", checked ? "text-zinc-300" : "text-ink-mute")}>
                {o.count}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
