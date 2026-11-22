"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowDownUp, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, SlidersHorizontal, X,
} from "lucide-react";
import type { Profile } from "@/lib/firebase/profile";
import type { PortalMeeting, PortalPhase, PortalPhoto, PortalWeeklyUpdate } from "@/types/portal";
import { PhotoImage } from "@/components/photo-image";
import { Eyebrow, Notice } from "@/components/portal-ui";
import { CLOSING_WEEK_NUMBER, weekLabel } from "@/lib/week-label";
import { formatDateEs, formatDayMonthEs } from "@/lib/format-date-es";
import { cn } from "@/lib/utils";

/**
 * Fotos (fase 2): filtros con el pulgar (chips con recuento en lugar de selects), fotos
 * agrupadas por semana (o por el acta o la decisión a la que van adjuntas) y un visor a
 * pantalla completa para pasar de foto sin salir. Pantalla tranquila: sin coreografía de
 * entrada; solo transiciones de 140/220 ms y un fundido de 220 ms al cambiar de foto.
 */

const TODAS = "todas";
const SIN_ESTANCIA = "__sin-estancia__";
/** Fotos por tanda de «Cargar más» (se muestran semanas enteras). */
const LOTE = 24;
/** A partir de aquí una semana se pliega: muestra TOPE − 1 fotos y la pieza «+N». */
const TOPE_GRUPO = 9;

type Filtros = { room: string; phase: string; week: string };
type Opcion = { value: string; label: string; count: number };

interface Grupo {
  key: string;
  titulo: string;
  fecha: string | null;
  enlace: { href: string; texto: string } | null;
  fotos: PortalPhoto[];
}

interface PhotosClientProps {
  photos: PortalPhoto[];
  phases: PortalPhase[];
  weeklyUpdates: PortalWeeklyUpdate[];
  meetings?: PortalMeeting[];
  projectId: string;
  projectName?: string;
  profile: Profile;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const instante = (iso: string) => new Date(iso).getTime() || 0;
const dosCifras = (n: number) => String(n).padStart(2, "0");

function cumple(p: PortalPhoto, f: Filtros): boolean {
  if (f.room !== TODAS && (f.room === SIN_ESTANCIA ? !!p.room : p.room !== f.room)) return false;
  if (f.phase !== TODAS && p.phase_id !== f.phase) return false;
  if (f.week !== TODAS && p.weekly_update_id !== f.week) return false;
  return true;
}

export function PhotosClient({
  photos,
  phases,
  weeklyUpdates,
  meetings = [],
  projectId,
  projectName,
  profile,
}: PhotosClientProps) {
  void profile;
  const base = `/dashboard/projects/${projectId}`;

  // --- Filtros, orden y paginación progresiva ---
  const [filtros, setFiltros] = useState<Filtros>({ room: TODAS, phase: TODAS, week: TODAS });
  const [sortOrder, setSortOrder] = useState<"recientes" | "antiguas">("recientes");
  const [visibleCount, setVisibleCount] = useState<number>(LOTE);
  const [masFiltros, setMasFiltros] = useState(false);
  const [desplegados, setDesplegados] = useState<Set<string>>(() => new Set());
  // --- Visor ---
  const [visorId, setVisorId] = useState<string | null>(null);

  const cambiarFiltro = (dim: keyof Filtros, value: string) => {
    setFiltros((f) => ({ ...f, [dim]: value }));
    setVisibleCount(LOTE);
  };
  const quitarFiltros = () => {
    setFiltros({ room: TODAS, phase: TODAS, week: TODAS });
    setVisibleCount(LOTE);
  };

  const partePorId = useMemo(() => new Map(weeklyUpdates.map((w) => [w.id, w])), [weeklyUpdates]);
  const actaPorId = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const fasePorId = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);

  /**
   * Etiqueta honesta de cada foto. El modelo no distingue render ni referencia: todas son
   * fotos que sube el estudio desde sus visitas («Foto de obra»). Solo las de una fase de
   * Entrega (la que recoge las «fotografías finales») se dicen «Foto final».
   */
  const etiqueta = useCallback(
    (p: PortalPhoto, corta = false) => {
      const final = fasePorId.get(p.phase_id ?? "")?.stage === "handover";
      if (corta) return final ? "Final" : "Obra";
      const tipo = final ? "Foto final" : "Foto de obra";
      return p.room ? `${tipo} · ${p.room}` : tipo;
    },
    [fasePorId],
  );

  /** Procedencia de la foto (nace adjunta a un parte, acta o decisión) = su grupo en la galería. */
  const grupoDe = useCallback(
    (p: PortalPhoto): Omit<Grupo, "fotos"> => {
      const parte = p.weekly_update_id ? partePorId.get(p.weekly_update_id) : undefined;
      if (parte) {
        const semana = weekLabel(parte.week_number);
        return {
          key: `parte:${parte.id}`,
          titulo: semana,
          fecha: formatDayMonthEs(parte.created_at) || null,
          enlace: {
            href: `${base}/construction`,
            texto: parte.week_number === CLOSING_WEEK_NUMBER ? "Leer el parte de cierre" : `Leer el parte de la ${semana.toLowerCase()}`,
          },
        };
      }
      const acta = p.meeting_id ? actaPorId.get(p.meeting_id) : undefined;
      if (acta) {
        return {
          key: `acta:${acta.id}`,
          titulo: `Acta del ${formatDayMonthEs(acta.meeting_date)}`,
          fecha: null,
          enlace: { href: `${base}/meetings`, texto: "Leer el acta" },
        };
      }
      if (p.decision_id) {
        return { key: "decisiones", titulo: "Decisiones", fecha: null, enlace: { href: `${base}/decisions`, texto: "Ver las decisiones" } };
      }
      const fase = p.phase_id ? fasePorId.get(p.phase_id) : undefined;
      if (fase) return { key: `fase:${fase.id}`, titulo: fase.phase_number, fecha: null, enlace: null };
      return { key: "proyecto", titulo: "Proyecto", fecha: null, enlace: null };
    },
    [partePorId, actaPorId, fasePorId, base],
  );

  // --- Opciones de los chips, con recuento según el resto de filtros ---
  const opcionesEstancia = useMemo<Opcion[]>(() => {
    const total = new Map<string, number>();
    let sinEstancia = 0;
    photos.forEach((p) => (p.room ? total.set(p.room, (total.get(p.room) ?? 0) + 1) : sinEstancia++));
    const estancias = [...total.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .map(([room]) => room);
    return [TODAS, ...estancias, ...(sinEstancia ? [SIN_ESTANCIA] : [])].map((value) => ({
      value,
      label: value === TODAS ? "Todas" : value === SIN_ESTANCIA ? "Sin estancia" : value,
      count: photos.filter((p) => cumple(p, { ...filtros, room: value })).length,
    }));
  }, [photos, filtros]);

  const opcionesFase = useMemo<Opcion[]>(() => {
    const conFotos = [...phases]
      .sort((a, b) => a.order_index - b.order_index)
      .filter((f) => photos.some((p) => p.phase_id === f.id));
    if (conFotos.length < 2) return [];
    return [
      { value: TODAS, label: "Todas" },
      ...conFotos.map((f) => ({ value: f.id, label: `${f.phase_number} · ${f.name}` })),
    ].map((o) => ({ ...o, count: photos.filter((p) => cumple(p, { ...filtros, phase: o.value })).length }));
  }, [phases, photos, filtros]);

  const opcionesSemana = useMemo<Opcion[]>(() => {
    const conFotos = [...weeklyUpdates]
      .sort((a, b) => b.week_number - a.week_number)
      .filter((w) => photos.some((p) => p.weekly_update_id === w.id));
    if (conFotos.length < 2) return [];
    return [
      { value: TODAS, label: "Todas" },
      ...conFotos.map((w) => ({ value: w.id, label: weekLabel(w.week_number) })),
    ].map((o) => ({ ...o, count: photos.filter((p) => cumple(p, { ...filtros, week: o.value })).length }));
  }, [weeklyUpdates, photos, filtros]);

  // --- Filtrado, orden y grupos ---
  const filtradas = useMemo(() => {
    return photos
      .filter((p) => cumple(p, filtros))
      .sort((a, b) =>
        sortOrder === "recientes" ? instante(b.created_at) - instante(a.created_at) : instante(a.created_at) - instante(b.created_at),
      );
  }, [photos, filtros, sortOrder]);

  const grupos = useMemo(() => {
    const porClave = new Map<string, Grupo>();
    for (const p of filtradas) {
      const g = grupoDe(p);
      const existente = porClave.get(g.key);
      if (existente) existente.fotos.push(p);
      else porClave.set(g.key, { ...g, fotos: [p] });
    }
    return [...porClave.values()];
  }, [filtradas, grupoDe]);

  // Paginación progresiva por semanas enteras: se enseñan grupos hasta cubrir el lote
  const { gruposVisibles, restantes } = useMemo(() => {
    const visibles: Grupo[] = [];
    let mostradas = 0;
    for (const g of grupos) {
      if (mostradas >= visibleCount) break;
      visibles.push(g);
      mostradas += g.fotos.length;
    }
    return { gruposVisibles: visibles, restantes: filtradas.length - mostradas };
  }, [grupos, visibleCount, filtradas.length]);

  // Cabecera: «15 fotos · 3 partes · 1 reunión»
  const resumen = useMemo(() => {
    const partes = new Set(photos.map((p) => p.weekly_update_id).filter((id): id is string => !!id && partePorId.has(id)));
    const actas = new Set(photos.map((p) => p.meeting_id).filter((id): id is string => !!id && actaPorId.has(id)));
    return [
      plural(photos.length, "foto", "fotos"),
      partes.size ? plural(partes.size, "parte", "partes") : null,
      actas.size ? plural(actas.size, "reunión", "reuniones") : null,
    ].filter(Boolean).join(" · ");
  }, [photos, partePorId, actaPorId]);

  const filtrosExtra = (filtros.phase !== TODAS ? 1 : 0) + (filtros.week !== TODAS ? 1 : 0);
  const hayFiltros = filtros.room !== TODAS || filtrosExtra > 0;
  const hayMasFiltros = opcionesFase.length > 0 || opcionesSemana.length > 0;

  const desplegar = (g: Grupo) => {
    setDesplegados((s) => new Set(s).add(g.key));
    // La pieza «+N» desaparece: el foco pasa a la primera foto que estaba plegada
    const primera = g.fotos[TOPE_GRUPO - 1];
    if (primera) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-foto="${primera.id}"]`)?.focus());
  };

  const indiceVisor = visorId ? filtradas.findIndex((p) => p.id === visorId) : -1;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <header className="space-y-3">
        <Link
          href={`${base}/mas`}
          className="-ml-1 -mb-1 flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-ink hover:underline hover:underline-offset-4 lg:hidden"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Más
        </Link>
        {projectName && <Eyebrow>{projectName}</Eyebrow>}
        <h1 className="display-portal text-ink [text-wrap:balance]">Fotos</h1>
        {photos.length > 0 && <p className="text-sm font-medium text-ink-soft">{resumen}</p>}
        <p className="max-w-[56ch] text-sm leading-[1.55] text-ink-soft">
          La bitácora visual de tu hogar: las fotos que el estudio toma en cada visita. Filtra por estancia, fase o
          semana y abre cualquiera para verla en grande.
        </p>
      </header>

      {photos.length === 0 ? (
        <Notice title="Aún no hay fotos" icon={<ImageIcon aria-hidden />}>
          El estudio irá subiendo aquí las fotos de cada visita, junto a su parte o su acta.
        </Notice>
      ) : (
        <>
          {/* Filtros con el pulgar */}
          <section aria-label="Filtros de fotos" className="space-y-2.5">
            <Chips
              name="fotos-estancia"
              label="Filtrar por estancia"
              options={opcionesEstancia}
              value={filtros.room}
              onChange={(v) => cambiarFiltro("room", v)}
            />

            <div className="flex items-center justify-between gap-3 border-t border-border pt-1">
              {hayMasFiltros ? (
                <button
                  type="button"
                  aria-expanded={masFiltros}
                  aria-controls="fotos-mas-filtros"
                  onClick={() => setMasFiltros((v) => !v)}
                  className="-ml-2.5 inline-flex min-h-11 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-ink hover:bg-zinc-100"
                >
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Más filtros
                  {filtrosExtra > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-jet px-1.5 text-xs font-bold text-whitesmoke">
                      {filtrosExtra}
                      <span className="sr-only"> activo{filtrosExtra === 1 ? "" : "s"}</span>
                    </span>
                  )}
                  <ChevronDown className={cn("size-4 transition-transform", masFiltros && "rotate-180")} aria-hidden />
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setSortOrder((o) => (o === "recientes" ? "antiguas" : "recientes"))}
                aria-label={`Orden: ${sortOrder === "recientes" ? "más recientes" : "más antiguas"} primero. Cambiar orden`}
                className="-mr-2.5 inline-flex min-h-11 items-center gap-2 rounded-full px-2.5 text-sm font-semibold text-ink hover:bg-zinc-100"
              >
                {sortOrder === "recientes" ? "Más recientes primero" : "Más antiguas primero"}
                <ArrowDownUp className="size-4" aria-hidden />
              </button>
            </div>

            {hayMasFiltros && masFiltros && (
              <div id="fotos-mas-filtros" className="space-y-3 pb-1">
                {opcionesFase.length > 0 && (
                  <div className="space-y-2">
                    <p id="fotos-fase-t" className="eyebrow eyebrow-bare">Fase</p>
                    <Chips
                      name="fotos-fase"
                      labelledBy="fotos-fase-t"
                      options={opcionesFase}
                      value={filtros.phase}
                      onChange={(v) => cambiarFiltro("phase", v)}
                    />
                  </div>
                )}
                {opcionesSemana.length > 0 && (
                  <div className="space-y-2">
                    <p id="fotos-semana-t" className="eyebrow eyebrow-bare">Semana</p>
                    <Chips
                      name="fotos-semana"
                      labelledBy="fotos-semana-t"
                      options={opcionesSemana}
                      value={filtros.week}
                      onChange={(v) => cambiarFiltro("week", v)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className={cn("flex items-center justify-between gap-3", !hayFiltros && "sr-only")}>
              <p role="status" className="text-sm text-ink-soft">
                {hayFiltros
                  ? `${filtradas.length} de ${plural(photos.length, "foto", "fotos")}`
                  : plural(photos.length, "foto", "fotos")}
              </p>
              {hayFiltros && (
                <button
                  type="button"
                  onClick={quitarFiltros}
                  className="-mr-2.5 inline-flex min-h-11 items-center rounded-full px-2.5 text-sm font-semibold text-ink underline decoration-zinc-300 underline-offset-4 hover:decoration-ink"
                >
                  Quitar filtros
                </button>
              )}
            </div>
          </section>

          {filtradas.length === 0 ? (
            <Notice title="Sin resultados">Ninguna fotografía coincide con los filtros aplicados.</Notice>
          ) : (
            <div>
              {gruposVisibles.map((g, gi) => {
                const plegado = g.fotos.length > TOPE_GRUPO && !desplegados.has(g.key);
                const fotos = plegado ? g.fotos.slice(0, TOPE_GRUPO - 1) : g.fotos;
                const ocultas = g.fotos.length - fotos.length;
                const tituloId = `fotos-grupo-${gi}`;
                return (
                  <section key={g.key} aria-labelledby={tituloId} className={gi === 0 ? undefined : "pt-9"}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 id={tituloId} className="eyebrow font-sans">
                        {[g.titulo, g.fecha].filter(Boolean).join(" · ")}
                      </h2>
                      <p className="shrink-0 text-xs font-medium text-ink-mute">{plural(g.fotos.length, "foto", "fotos")}</p>
                    </div>
                    <div className="mt-3.5 grid grid-cols-2 gap-2 md:grid-cols-4">
                      {fotos.map((photo, i) => {
                        const grande = i === 0;
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            data-foto={photo.id}
                            onClick={() => setVisorId(photo.id)}
                            aria-label={`Abrir en el visor: ${photo.caption || etiqueta(photo)}`}
                            className={cn(
                              "group relative block overflow-hidden rounded-lg bg-zinc-100",
                              grande ? "col-span-2 aspect-[4/3] md:row-span-2 md:aspect-square" : "aspect-square",
                            )}
                          >
                            <PhotoImage photo={photo} mode="gallery" fill className="object-cover" tag={etiqueta(photo, !grande)} />
                            <span aria-hidden className="pointer-events-none absolute inset-0 z-40 bg-jet/0 transition-colors group-hover:bg-jet/15" />
                          </button>
                        );
                      })}
                      {ocultas > 0 && (
                        <button
                          type="button"
                          onClick={() => desplegar(g)}
                          aria-label={`Ver ${plural(ocultas, "foto más", "fotos más")} de ${g.titulo}`}
                          className="grid aspect-square place-items-center rounded-lg bg-jet font-heading text-2xl font-semibold tracking-[0.02em] text-whitesmoke hover:bg-zinc-700"
                        >
                          +{ocultas}
                        </button>
                      )}
                      {g.enlace && (
                        <Link
                          href={g.enlace.href}
                          className="flex aspect-square flex-col justify-between rounded-lg border border-border bg-[#eceaeb] p-3.5 text-ink hover:border-control-line"
                        >
                          <FileText className="size-5 text-ink-mute" aria-hidden />
                          <span className="text-sm font-semibold leading-[1.35]">
                            {g.enlace.texto} <ArrowRight className="inline size-4 align-[-3px]" aria-hidden />
                          </span>
                        </Link>
                      )}
                    </div>
                  </section>
                );
              })}

              {/* Carga progresiva */}
              {restantes > 0 && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + LOTE)}
                  className="mt-8 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-control-line px-5 text-sm font-semibold text-ink hover:border-jet hover:bg-zinc-100"
                >
                  <ImageIcon className="size-4" aria-hidden />
                  Cargar más fotos ({restantes} restantes)
                </button>
              )}
            </div>
          )}
        </>
      )}

      {indiceVisor >= 0 && (
        <VisorFotos
          fotos={filtradas}
          indice={indiceVisor}
          onIr={setVisorId}
          onCerrar={() => setVisorId(null)}
          etiqueta={etiqueta}
          grupoDe={grupoDe}
          grupos={grupos}
        />
      )}
    </div>
  );
}

/** Chips de un filtro (radios nativos: flechas del teclado y lector de pantalla gratis). */
function Chips({
  name,
  label,
  labelledBy,
  options,
  value,
  onChange,
}: {
  name: string;
  label?: string;
  labelledBy?: string;
  options: Opcion[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className="-mx-4 -my-1.5 flex gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="group relative inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-control-line bg-white px-4 text-sm font-medium text-ink after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[''] hover:border-jet has-[:checked]:border-jet has-[:checked]:bg-jet has-[:checked]:text-whitesmoke has-[:focus-visible]:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
          <span className="text-xs font-semibold text-ink-mute tabular-nums group-has-[:checked]:text-zinc-300">{o.count}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Visor a pantalla completa (Jet): contador, anterior y siguiente (botones, flechas del
 * teclado y deslizar), etiqueta honesta, semana, pie y tira de miniaturas del mismo grupo.
 * Escape o tocar fuera de la foto lo cierra; el foco queda dentro y vuelve a la foto al salir.
 */
function VisorFotos({
  fotos,
  indice,
  onIr,
  onCerrar,
  etiqueta,
  grupoDe,
  grupos,
}: {
  fotos: PortalPhoto[];
  indice: number;
  onIr: (id: string) => void;
  onCerrar: () => void;
  etiqueta: (p: PortalPhoto, corta?: boolean) => string;
  grupoDe: (p: PortalPhoto) => Omit<Grupo, "fotos">;
  grupos: Grupo[];
}) {
  const foto = fotos[indice];
  const dialogoRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const tiraRef = useRef<HTMLOListElement>(null);
  const figuraRef = useRef<HTMLElement>(null);
  const toque = useRef<number | null>(null);
  // Proporción real de la imagen cargada (por si el ancho y alto guardados no cuadran)
  const [natural, setNatural] = useState<{ id: string; ratio: number } | null>(null);

  const hayAnterior = indice > 0;
  const haySiguiente = indice < fotos.length - 1;
  const anterior = useCallback(() => { if (indice > 0) onIr(fotos[indice - 1].id); }, [indice, fotos, onIr]);
  const siguiente = useCallback(() => { if (indice < fotos.length - 1) onIr(fotos[indice + 1].id); }, [indice, fotos, onIr]);

  // Al abrir: foco en «Cerrar» y sin scroll de fondo. Al cerrar: el foco vuelve a la foto.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    cerrarRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = overflow;
      previo?.focus?.();
    };
  }, []);

  // Teclado: Escape cierra, flechas pasan de foto, Tab no sale del visor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrar();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        anterior();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        siguiente();
      } else if (e.key === "Tab" && dialogoRef.current) {
        const focos = [...dialogoRef.current.querySelectorAll<HTMLElement>("button, [href]")];
        if (focos.length === 0) return;
        const primero = focos[0];
        const ultimo = focos[focos.length - 1];
        const activo = document.activeElement;
        if (!dialogoRef.current.contains(activo)) {
          e.preventDefault();
          primero.focus();
        } else if (e.shiftKey && activo === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && activo === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anterior, siguiente, onCerrar]);

  // Precarga de la anterior y la siguiente: pasar de foto no espera a la red
  useEffect(() => {
    [fotos[indice - 1], fotos[indice + 1]].forEach((f) => {
      if (f?.image_url) new Image().src = f.image_url;
    });
  }, [indice, fotos]);

  useEffect(() => {
    const img = figuraRef.current?.querySelector("img");
    const id = fotos[indice]?.id;
    if (!img || !id) return;
    const medir = () => {
      if (img.naturalWidth && img.naturalHeight) setNatural({ id, ratio: img.naturalWidth / img.naturalHeight });
    };
    if (img.complete) medir();
    img.addEventListener("load", medir);
    return () => img.removeEventListener("load", medir);
  }, [indice, fotos]);

  // La miniatura actual, siempre a la vista en la tira
  useEffect(() => {
    tiraRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [indice]);

  if (!foto) return null;

  const grupo = grupoDe(foto);
  const tira = grupos.find((g) => g.key === grupo.key)?.fotos ?? [foto];
  const proporcion =
    natural?.id === foto.id ? natural.ratio : foto.width && foto.height ? foto.width / foto.height : 4 / 3;
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  const total = fotos.length;

  // En <body>: dentro de <main> (z-10) el visor quedaría bajo la cabecera fija y su «Cerrar», tapado
  return createPortal(
    <div
      ref={dialogoRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="visor-pie"
      onClick={onCerrar}
      className="dark fixed inset-0 z-[120] flex animate-dlx-fade flex-col bg-zinc-950 text-whitesmoke"
    >
      {/* Barra: contador y cerrar */}
      <div onClick={parar} className="mx-auto flex h-15 w-full max-w-5xl shrink-0 items-center justify-between px-4 sm:px-6">
        <p className="font-heading text-base font-semibold tracking-[0.04em] tabular-nums">
          <span aria-hidden>
            {dosCifras(indice + 1)}
            <span className="text-zinc-400"> / {dosCifras(total)}</span>
          </span>
          <span className="sr-only">Foto {indice + 1} de {total}</span>
        </p>
        <button
          ref={cerrarRef}
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el visor"
          className="-mr-2 grid size-11 place-items-center rounded-full text-whitesmoke hover:bg-white/10"
        >
          <X className="size-6" aria-hidden />
        </button>
      </div>

      {/* Escenario: la caja toma la proporción de la foto y cabe entera en el hueco */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center [container-type:size] md:px-6">
        <figure
          ref={figuraRef}
          onClick={parar}
          onTouchStart={(e) => { toque.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const x0 = toque.current;
            toque.current = null;
            const x1 = e.changedTouches[0]?.clientX;
            if (x0 == null || x1 == null) return;
            if (x1 - x0 > 50) anterior();
            else if (x0 - x1 > 50) siguiente();
          }}
          className="relative m-0 overflow-hidden bg-zinc-900 md:rounded-lg"
          style={{ width: `min(100cqw, calc(100cqh * ${proporcion}))`, aspectRatio: String(proporcion) }}
        >
          {/* Una foto nueva entra con el fundido de 220 ms de PhotoImage, nada más */}
          <PhotoImage key={foto.id} photo={foto} mode="detail" fill className="object-contain" tag={etiqueta(foto)} />
        </figure>
      </div>

      {/* Controles y datos */}
      <div onClick={parar} className={cn("mx-auto w-full max-w-5xl shrink-0 px-4 pt-3.5 sm:px-6", tira.length < 2 && "pb-[calc(24px+env(safe-area-inset-bottom))]")}>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={anterior}
            aria-disabled={!hayAnterior}
            aria-label={hayAnterior ? `Foto anterior: ${indice} de ${total}` : "Estás en la primera foto"}
            className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-control-line text-whitesmoke hover:bg-white/10 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <p className="eyebrow eyebrow-bare block min-w-0 truncate text-center">
            {[grupo.titulo, grupo.fecha].filter(Boolean).join(" · ")}
          </p>
          <button
            type="button"
            onClick={siguiente}
            aria-disabled={!haySiguiente}
            aria-label={haySiguiente ? `Foto siguiente: ${indice + 2} de ${total}` : "Estás en la última foto"}
            className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-control-line text-whitesmoke hover:bg-white/10 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <div aria-live="polite" className="mt-3.5">
          <p id="visor-pie" className="text-lg leading-snug text-whitesmoke [text-wrap:pretty]">
            {foto.caption || "Sin pie de foto."}
          </p>
          {formatDateEs(foto.created_at) && (
            <p className="mt-1 text-[13px] text-zinc-400">Subida el {formatDateEs(foto.created_at)}</p>
          )}
        </div>
      </div>

      {/* Tira de miniaturas del mismo grupo */}
      {tira.length > 1 && (
        <div
          onClick={parar}
          className="mx-auto mt-4 w-full max-w-5xl shrink-0 border-t border-border pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]"
        >
          <ol ref={tiraRef} aria-label={`Fotos de ${grupo.titulo}`} className="flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
            {tira.map((t) => {
              const actual = t.id === foto.id;
              const n = fotos.indexOf(t) + 1;
              return (
                <li key={t.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onIr(t.id)}
                    aria-current={actual ? "true" : undefined}
                    aria-label={`Foto ${n}${t.room ? `: ${t.room}` : ""}${actual ? ", la que estás viendo" : ""}`}
                    className={cn(
                      "relative block size-15 overflow-hidden rounded-md border-2 transition-opacity",
                      actual ? "border-whitesmoke opacity-100" : "border-transparent opacity-55 hover:opacity-85",
                    )}
                  >
                    <PhotoImage photo={t} mode="gallery" fill className="object-cover" />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>,
    document.body,
  );
}
