import React from "react";
import Link from "next/link";
import {
  ArrowRight, Box, Check, ChevronDown, ChevronRight, Download, FileText, SquareCheck, Users
} from "lucide-react";
import { getPhases, getMeetings, getDecisions, getDocuments, getModel3dPublished } from "@/lib/firebase/db";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { AccessRestricted } from "@/components/access-restricted";
import { Cells, Eyebrow, Notice, StatusBadge, statusOf } from "@/components/portal-ui";
import { MarcarVisto } from "@/components/novedad";
import { esNovedad } from "@/lib/novedad";
import { getPhaseState, type PhaseState } from "@/lib/phase-status";
import { getPhaseDelay, todayIso } from "@/lib/phase-delay";
import { phaseStatusClientLabel } from "@/lib/phase-status-client";
import { getActivePhase } from "@/lib/status-headline";
import { isConfirmedMeeting } from "@/lib/actions-aggregator";
import { formatDateEs, formatDayMonthEs } from "@/lib/format-date-es";
import { etiquetaVersion } from "@/lib/model3d/maqueta";
import { cn } from "@/lib/utils";
import type { PhaseStatus, PortalDecision, PortalDocument, PortalMeeting, PortalPhase } from "@/types/portal";
import { Arcos, Etapa, Fila, Filas, KY, Nudo, Segmento, Trazo, type TipoSegmento } from "./camino-ui";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

// ─── Derivaciones (todas a partir de campos reales de la fase) ─────────────────────

/** Numeral de dos cifras para el hilo: «Fase 9» → «09». */
function numeroFase(fase: PortalPhase): string {
  const texto = (fase.phase_number ?? "").trim();
  const cifras = /\d+/.exec(texto);
  if (cifras) return cifras[0].padStart(2, "0");
  return texto || String(fase.order_index ?? 0).padStart(2, "0");
}

const ETAPAS: Record<string, string> = { project: "Proyecto", construction: "Obra", handover: "Entrega" };
const nombreEtapa = (stage: string | null | undefined) => ETAPAS[stage ?? ""] ?? "Fases";

/** «fase 09» o «fases 00–08». */
function rango(fases: PortalPhase[]): string {
  const a = numeroFase(fases[0]);
  const b = numeroFase(fases[fases.length - 1]);
  return fases.length === 1 || a === b ? `fase ${a}` : `fases ${a}–${b}`;
}

/** Estados históricos laxos («En Curso», «Completado»…) → literal del modelo, para el tono del badge. */
const LITERALES: readonly string[] = [
  "No iniciada", "En desarrollo", "Pendiente de revisión cliente", "Pendiente de cambios",
  "Validada", "Bloqueada", "Finalizada",
] satisfies PhaseStatus[];
const LITERAL_POR_ESTADO: Record<PhaseState, PhaseStatus> = {
  complete: "Finalizada",
  current: "En desarrollo",
  blocked: "Bloqueada",
  pending: "No iniciada",
};
function EstadoFase({ status }: { status: string | null | undefined }) {
  const literal = LITERALES.includes(status ?? "") ? (status as string) : LITERAL_POR_ESTADO[getPhaseState(status)];
  return <StatusBadge kind="fase" status={literal} label={phaseStatusClientLabel(status)} />;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «19 sep» (este año) o «21 may 2027»: para las celdas del cuadro técnico. */
function fechaCorta(iso: string | null | undefined, hoy: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  const texto = `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]}`;
  return m[1] === hoy.slice(0, 4) ? texto : `${texto} ${m[1]}`;
}

/** «19 de septiembre» (este año) o «21 de mayo de 2027». */
function fechaLarga(iso: string | null | undefined, hoy: string): string {
  if (!iso) return "";
  return iso.slice(0, 4) === hoy.slice(0, 4) ? formatDayMonthEs(iso) : formatDateEs(iso);
}

const dias = (n: number) => (n === 1 ? "1 día" : `${n} días`);
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Fase de ahora: la apuntada por current_phase_id (criterio de Inicio). Si esa ya
 * está cerrada, la primera que sigue abierta; si todas lo están, ninguna.
 */
function faseActiva(ordenadas: PortalPhase[], currentPhaseId: string | null): PortalPhase | null {
  const marcada = getActivePhase(ordenadas, currentPhaseId);
  const activa = ordenadas.find((p) => p.id === marcada?.id) ?? null;
  if (activa && getPhaseState(activa.status) !== "complete") return activa;
  return (
    ordenadas.find((p) => getPhaseState(p.status) === "current") ??
    ordenadas.find((p) => getPhaseState(p.status) !== "complete") ??
    null
  );
}

// ─── El hilo como lista de filas ───────────────────────────────────────────────────

type Rol = "hecha" | "ahora" | "porLlegar";
type FilaHilo =
  | { tipo: "etapa"; clave: string; texto: string }
  | { tipo: "pliegue"; clave: string; texto: string; fases: PortalPhase[] }
  | { tipo: "fase"; clave: string; fase: PortalPhase; rol: Rol };

/**
 * Etapas (Proyecto, Obra, Entrega) con sus fases. Las fases hechas del principio
 * van plegadas cuando son tres o más, para que la de ahora quede arriba.
 */
function construirFilas(ordenadas: PortalPhase[], activa: PortalPhase | null): FilaHilo[] {
  const filas: FilaHilo[] = [];
  const iActiva = activa ? ordenadas.indexOf(activa) : -1;

  let plegadas = 0;
  while (plegadas < iActiva && getPhaseState(ordenadas[plegadas].status) === "complete") plegadas++;
  if (plegadas < 3) plegadas = 0;

  let etapaPrevia: string | null = null;
  if (plegadas) {
    const fases = ordenadas.slice(0, plegadas);
    const etapa = fases[0].stage;
    // Si el pliegue cubre una etapa entera, lleva su nombre; si no, «Completadas»
    const etapaEntera = fases.every((f) => f.stage === etapa) && ordenadas[plegadas]?.stage !== etapa;
    filas.push({
      tipo: "pliegue",
      clave: "pliegue",
      fases,
      texto: `${etapaEntera ? nombreEtapa(etapa) : "Completadas"} · ${rango(fases)}`,
    });
    etapaPrevia = etapaEntera ? etapa : null;
  }

  for (let i = plegadas; i < ordenadas.length; i++) {
    const fase = ordenadas[i];
    if (fase.stage !== etapaPrevia) {
      let j = i;
      while (j + 1 < ordenadas.length && ordenadas[j + 1].stage === fase.stage) j++;
      filas.push({ tipo: "etapa", clave: `etapa-${fase.id}`, texto: `${nombreEtapa(fase.stage)} · ${rango(ordenadas.slice(i, j + 1))}` });
      etapaPrevia = fase.stage;
    }
    const rol: Rol = fase === activa ? "ahora" : getPhaseState(fase.status) === "complete" ? "hecha" : "porLlegar";
    filas.push({ tipo: "fase", clave: fase.id, fase, rol });
  }
  return filas;
}

const tieneNudo = (f: FilaHilo) => f.tipo !== "etapa";
const kyDe = (f: FilaHilo) => (f.tipo === "pliegue" ? KY.pliegue : f.tipo === "fase" && f.rol === "ahora" ? KY.ahora : KY.fase);

// El nudo de ahora se posa cuando el trazo llega a él (o enseguida, si no hay trazo)
const POSARSE = "animate-[dlx-settle_var(--dur-slow)_var(--ease-out)_both] motion-reduce:animate-none";
const POSARSE_TRAS_TRAZO = "animate-[dlx-settle_var(--dur-slow)_var(--ease-out)_var(--dur-draw)_both] motion-reduce:animate-none";

// ─── Página ────────────────────────────────────────────────────────────────────────

export default async function ClientProjectPhasesPage({ params }: PageProps) {
  const { projectId } = await params;

  const pageAccess = await getProjectPageAccess(projectId);
  if (pageAccess.mode === "denied") {
    return (
      <AccessRestricted
        message={
          pageAccess.profile.role === 'client'
            ? "No tienes autorización para acceder a las fases de este proyecto de obra."
            : "No se ha encontrado el proyecto seleccionado."
        }
      />
    );
  }
  const { project } = pageAccess;

  // ¿Hay maqueta publicada? Solo para el enlace a su página; si falla, la página sigue sin él
  const maquetaPromesa = getModel3dPublished(projectId).catch((err) => {
    console.error("Error consultando la maqueta 3D:", err);
    return null;
  });

  let phases: PortalPhase[] = [];
  let meetings: PortalMeeting[] = [];
  let decisions: PortalDecision[] = [];
  let documents: PortalDocument[] = [];

  try {
    const [phasesData, meetingsData, decisionsData, documentsData] = await Promise.all([
      getPhases(projectId),
      getMeetings(projectId),
      getDecisions(projectId),
      getDocuments(projectId),
    ]);
    phases = phasesData || [];
    meetings = meetingsData || [];
    decisions = decisionsData || [];
    documents = documentsData || [];
  } catch (err) {
    console.error("Error al obtener datos en la vista cliente de fases:", err);
  }

  // Las actas borrador no existen para el cliente
  meetings = meetings.filter(isConfirmedMeeting);
  const maqueta = await maquetaPromesa;

  // Formateador de bytes
  const formatBytes = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const hoy = todayIso();
  const base = `/dashboard/projects/${projectId}`;
  const ordenadas = [...phases].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const ultima = ordenadas[ordenadas.length - 1];
  const activa = faseActiva(ordenadas, project.current_phase_id);

  // «Momento de producto»: el trazo se dibuja hasta el nudo de ahora cuando cambia la fase activa
  const versionCamino = activa ? `${activa.id}:${activa.status}` : null;
  const nuevo = await esNovedad("camino", versionCamino);

  // ── Portada: dónde estás ──
  const numActiva = activa ? numeroFase(activa) : null;
  const estadoActiva = activa ? getPhaseState(activa.status) : null;
  const enCurso = estadoActiva === "current" || estadoActiva === "blocked";
  const retrasoActiva = activa ? getPhaseDelay(activa, hoy) : null;
  const hechas = ordenadas.filter((p) => getPhaseState(p.status) === "complete").length;
  const todasHechas = ordenadas.length > 0 && hechas === ordenadas.length;

  const titular = activa ? activa.name : todasHechas ? "Todas las fases, completadas" : "El camino";
  const entradilla = activa
    ? `Fase ${numActiva} · ${minuscula(phaseStatusClientLabel(activa.status))}${
        enCurso && activa.start_date ? ` desde el ${fechaLarga(activa.start_date, hoy)}` : ""
      }`
    : ordenadas.length
      ? `${ordenadas.length} fases, de la primera idea a la entrega de tus llaves.`
      : "Desde la primera idea en el papel hasta la entrega de tus llaves.";
  const fantasma = numActiva ?? (ultima ? numeroFase(ultima) : null);

  const celdas: Array<{ k: string; v: React.ReactNode }> = [];
  if (activa && enCurso && activa.start_date) celdas.push({ k: "Desde", v: fechaCorta(activa.start_date, hoy) });
  if (activa?.target_end_date) {
    celdas.push({ k: "Fin de fase (objetivo)", v: fechaCorta(activa.target_end_date, hoy) });
    celdas.push({
      k: "Plazo",
      v: retrasoActiva && !retrasoActiva.closed ? (
        `${dias(retrasoActiva.days)} más`
      ) : (
        <span className="inline-flex items-center gap-1.5"><Check className="size-4" aria-hidden />Al día</span>
      ),
    });
  }
  if (ordenadas.length) celdas.push({ k: "Fases completadas", v: `${hechas} de ${ordenadas.length}` });
  if (project.estimated_end_date && project.status !== "Finalizado") {
    celdas.push({ k: "Entrega estimada", v: fechaCorta(project.estimated_end_date, hoy) });
  }
  const celdasPortada = celdas.slice(0, 3);

  // ── Lo que va con cada fase: decisiones, reuniones y documentos, como filas ──
  const relacionesDe = (faseId: string, compacta: boolean) => {
    const pendientes = decisions.filter((d) => d.phase_id === faseId && d.status === "Pendiente");
    const respondidas = decisions.filter((d) => d.phase_id === faseId && (d.status === "Votado" || d.status === "Validada"));
    const reuniones = meetings.filter((m) => m.phase_id === faseId);
    const docs = documents.filter((d) => d.phase_id === faseId);
    return [
      ...pendientes.map((dec) => (
        <Fila
          key={dec.id}
          compacta={compacta}
          href={`${base}/decisions`}
          icono={<SquareCheck />}
          titulo={dec.title}
          detalle={
            <>
              <span className="font-semibold text-ink">Te toca decidir</span>
              {dec.due_date && <> · antes del {fechaLarga(dec.due_date, hoy)}</>}
            </>
          }
          final={<ChevronRight />}
        />
      )),
      ...reuniones.map((meet) => (
        <Fila
          key={meet.id}
          compacta={compacta}
          href={`${base}/meetings`}
          icono={<Users />}
          titulo={meet.title}
          detalle={`Reunión · ${fechaLarga(meet.meeting_date, hoy)}`}
          final={<ChevronRight />}
        />
      )),
      ...docs.map((doc) => (
        <Fila
          key={doc.id}
          compacta={compacta}
          href={doc.file_url}
          externo
          icono={<FileText />}
          titulo={doc.title}
          detalle={[statusOf("documento", doc.status).label, doc.version, doc.file_size ? formatBytes(doc.file_size) : null]
            .filter(Boolean)
            .join(" · ")}
          final={<Download />}
        />
      )),
      ...respondidas.map((dec) => (
        <Fila
          key={dec.id}
          compacta={compacta}
          icono={<Check />}
          titulo={dec.title}
          detalle={
            dec.client_response ? (
              <>Elegiste: <span className="font-semibold text-ink-soft">{dec.client_response}</span></>
            ) : (
              statusOf("decision", dec.status).label
            )
          }
        />
      )),
    ];
  };

  // ── Filas del hilo ──
  const filaFase = (fase: PortalPhase, rol: "hecha" | "porLlegar", segmento?: TipoSegmento) => {
    const relaciones = relacionesDe(fase.id, true);
    const retraso = getPhaseDelay(fase, hoy);
    const meta =
      rol === "hecha"
        ? fase.end_date
          ? `Terminada el ${fechaLarga(fase.end_date, hoy)}`
          : ""
        : [
            fase.target_end_date ? `Objetivo · ${fechaLarga(fase.target_end_date, hoy)}` : null,
            retraso && !retraso.closed ? `${dias(retraso.days)} más de lo previsto` : null,
            fase === ultima && fase.stage === "handover" && project.estimated_end_date && project.status !== "Finalizado"
              ? `Llaves · fecha estimada · ${fechaLarga(project.estimated_end_date, hoy)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");
    return (
      <div key={fase.id} className="relative pb-3 pl-12 pt-3.5">
        {segmento && <Segmento tipo={segmento} ky={KY.fase} />}
        <Nudo tipo={rol} ky={KY.fase} />
        <div className="grid grid-cols-[30px_minmax(0,1fr)] items-baseline">
          <span className="numeral leading-[1.3]">{numeroFase(fase)}</span>
          <div className="min-w-0">
            <h3 className="font-sans text-base font-semibold normal-case leading-[1.3] tracking-normal text-ink">{fase.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <EstadoFase status={fase.status} />
              {meta && <span className="text-[13px] leading-[1.4] text-ink-mute">{meta}</span>}
            </div>
            {rol === "porLlegar" && fase.description && (
              <p className="mt-2 max-w-[62ch] text-sm leading-[1.55] text-ink-soft">{fase.description}</p>
            )}
            {relaciones.length > 0 && <Filas className="mt-3">{relaciones}</Filas>}
          </div>
        </div>
      </div>
    );
  };

  const filaAhora = (fase: PortalPhase, segmento: TipoSegmento | undefined, conTrazo: boolean) => {
    const relaciones = relacionesDe(fase.id, false);
    const retraso = getPhaseDelay(fase, hoy);
    return (
      <div key={fase.id} className="relative pb-3 pl-12 pt-2">
        {segmento && <Segmento tipo={segmento} ky={KY.ahora} />}
        <Arcos ky={KY.ahora} />
        <Nudo
          tipo="ahora"
          ky={KY.ahora}
          numeral={numeroFase(fase)}
          className={nuevo ? (conTrazo ? POSARSE_TRAS_TRAZO : POSARSE) : undefined}
        />
        <article
          aria-labelledby="camino-ahora"
          className="rounded-xl border border-zinc-200 bg-white p-[18px] shadow-[0_2px_8px_rgba(30,32,30,0.08)]"
        >
          <div className="flex min-h-[26px] flex-wrap items-center gap-x-2.5 gap-y-2">
            <EstadoFase status={fase.status} />
            {retraso && !retraso.closed ? (
              <span className="text-[13px] font-semibold leading-[1.4] text-ink">{dias(retraso.days)} más de lo previsto</span>
            ) : fase.target_end_date ? (
              <span className="text-[13px] leading-[1.4] text-ink-mute">Objetivo · {fechaLarga(fase.target_end_date, hoy)}</span>
            ) : null}
          </div>
          <h3 id="camino-ahora" className="mt-3 text-balance text-2xl leading-[1.1] tracking-[0.02em] text-ink">
            {fase.name}
          </h3>
          {fase.description && <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-ink">{fase.description}</p>}
          {getPhaseState(fase.status) === "current" && (
            <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.5] text-ink-mute">
              Estamos centrados en cerrar esta fase para pasar a la siguiente. Puedes seguir el avance en el{" "}
              <Link href={`${base}/construction`} className="font-semibold text-ink underline decoration-1 underline-offset-4">
                Diario de obra
              </Link>
              {relaciones.length > 0 ? " o revisar aquí abajo lo que va con ella." : "."}
            </p>
          )}
          {relaciones.length > 0 && <Filas className="mt-4">{relaciones}</Filas>}
        </article>
      </div>
    );
  };

  const pliegue = (fila: Extract<FilaHilo, { tipo: "pliegue" }>) => {
    const n = fila.fases.length;
    return (
      <details key={fila.clave} className="group/pliegue">
        <summary className="relative block cursor-pointer list-none pb-1.5 pl-12 pt-3 [&::-webkit-details-marker]:hidden">
          <Nudo tipo="hecha" ky={KY.pliegue} />
          <span className="eyebrow eyebrow-bare flex min-h-5">{fila.texto}</span>
          <span className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="group-open/pliegue:hidden">Ver las {n} fases completadas</span>
            <span className="hidden group-open/pliegue:inline">Plegar las {n} fases</span>
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform duration-[var(--dur-base)] group-open/pliegue:rotate-180"
            />
          </span>
        </summary>
        {fila.fases.map((f) => filaFase(f, "hecha"))}
      </details>
    );
  };

  const filas = construirFilas(ordenadas, activa);
  const iPrimero = filas.findIndex(tieneNudo);
  let iFin = filas.findIndex((f) => f.tipo === "fase" && f.rol === "ahora");
  if (iFin < 0) {
    for (let i = filas.length - 1; i >= 0; i--) if (tieneNudo(filas[i])) { iFin = i; break; }
  }
  const previas = iPrimero > 0 ? filas.slice(0, iPrimero) : [];
  const recorridas = iPrimero >= 0 && iFin > iPrimero ? filas.slice(iPrimero, iFin) : [];
  const fin = iFin >= 0 ? filas[iFin] : null;
  const despues = iFin >= 0 ? filas.slice(iFin + 1) : [];
  let iUltimoDespues = -1;
  despues.forEach((f, i) => { if (tieneNudo(f)) iUltimoDespues = i; });
  const conTrazo = recorridas.length > 0 && fin !== null;

  const pintar = (fila: FilaHilo, segmento?: TipoSegmento) => {
    if (fila.tipo === "etapa") return <Etapa key={fila.clave} segmento={segmento === "completo"}>{fila.texto}</Etapa>;
    if (fila.tipo === "pliegue") return pliegue(fila);
    if (fila.rol === "ahora") return filaAhora(fila.fase, segmento, conTrazo);
    return filaFase(fila.fase, fila.rol, segmento);
  };

  const etiquetaMaqueta = maqueta ? etiquetaVersion(maqueta) : "";

  return (
    <div>
      {/* ============ Portada: dónde estás (banda Jet) ============ */}
      <section
        aria-labelledby="camino-titulo"
        className="dark relative -mx-4 -mt-8 overflow-hidden bg-jet px-4 pb-5 pt-8 text-whitesmoke sm:mx-0 sm:mt-0 sm:rounded-xl sm:px-8 sm:pb-6"
      >
        <div className="sm:grid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] sm:gap-6">
          <div className="sm:pb-6">
            <Eyebrow>El camino · {project.name}</Eyebrow>
            <h1 id="camino-titulo" className="display-portal mt-3.5 text-balance text-whitesmoke">
              {titular}
            </h1>
            <p className="mt-2.5 max-w-[46ch] text-base leading-[1.55] text-zinc-200">{entradilla}</p>
          </div>
          {/* Zona del dibujo: la textura y el numeral fantasma, nunca bajo el texto */}
          {fantasma && (
            <div
              aria-hidden
              className="relative -mx-4 mt-3.5 h-[150px] overflow-hidden sm:-mr-8 sm:-mt-8 sm:ml-0 sm:h-auto sm:min-h-[210px]"
            >
              <div className="tex-nudos absolute inset-y-0 left-[104px] right-0 sm:left-0" />
              <p className="pointer-events-none absolute left-[112px] top-0.5 select-none whitespace-nowrap font-heading text-[248px] font-semibold leading-[0.8] tracking-[-0.02em] text-transparent [-webkit-text-stroke:1.5px_rgb(245_243_244/0.26)] sm:left-8 sm:top-8 sm:text-[280px]">
                {fantasma}
              </p>
            </div>
          )}
        </div>
        {celdasPortada.length > 0 && (
          <Cells items={celdasPortada} className="[&>div]:flex [&>div]:flex-col [&_dd]:mt-auto [&_dd]:pt-1.5" />
        )}
      </section>

      {/* ============ El hilo: las fases, de la idea a las llaves ============ */}
      <section aria-labelledby="camino-hilo" className="pt-6">
        <h2 id="camino-hilo" className="sr-only">Las fases de tu proyecto, de la idea a las llaves</h2>

        {filas.length === 0 ? (
          <Notice title="Todavía no hay fases">
            El estudio está preparando el plan de tu proyecto. Aquí verás cada fase, de la primera idea a la entrega de tus llaves.
          </Notice>
        ) : (
          <div className={cn("relative", nuevo && "novedad")}>
            {previas.map((f) => pintar(f))}
            {recorridas.length > 0 && fin && (
              <div className="relative">
                <Trazo desde={kyDe(recorridas[0])} hasta={kyDe(fin)} dibujar={nuevo} />
                {recorridas.map((f) => pintar(f))}
              </div>
            )}
            {fin && pintar(fin, iUltimoDespues >= 0 ? "desdeNudo" : undefined)}
            {despues.map((f, i) =>
              pintar(f, f.tipo !== "etapa" && i === iUltimoDespues ? "hastaNudo" : "completo"),
            )}
          </div>
        )}

        {/* Tu maqueta 3D: panel Jet para lo que hay que mirar (tiene página propia a pantalla completa) */}
        {maqueta && (
          <Link
            href={`${base}/maqueta`}
            className="dark group/maqueta mt-9 block rounded-xl bg-jet p-5 text-whitesmoke transition-[translate,box-shadow] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(30,32,30,0.16)] sm:p-6"
          >
            <span className="flex flex-wrap items-center gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-900 text-whitesmoke">
                <Box className="size-5" aria-hidden />
              </span>
              {etiquetaMaqueta && (
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold leading-[1.4]">{etiquetaMaqueta}</span>
              )}
            </span>
            <span className="mt-[18px] block font-heading text-xl font-semibold uppercase leading-[1.15] tracking-[0.02em]">
              Tu maqueta 3D
            </span>
            <span className="mt-2 block max-w-[46ch] text-sm leading-[1.55] text-zinc-200">
              Cómo está tu vivienda, qué se derriba y cómo quedará.
            </span>
            <span className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold">
              Abrir la maqueta
              <ArrowRight className="size-4 transition-transform group-hover/maqueta:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        )}
      </section>

      <MarcarVisto id="camino" version={versionCamino} />
    </div>
  );
}
