"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, ChevronDown, CircleHelp, HardHat, Info, X } from "lucide-react";
import { PhotoImage } from "@/components/photo-image";
import { Cells, Eyebrow, Notice, SecHead } from "@/components/portal-ui";
import { CLOSING_WEEK_NUMBER, weekLabel } from "@/lib/week-label";
import { gremiosDeAsistentes } from "@/lib/attendees";
import { formatDateEs } from "@/lib/format-date-es";
import { cn } from "@/lib/utils";
import type { PortalPhoto, PortalWeeklyUpdate } from "@/types/portal";
import styles from "./construction.module.css";

interface ConstructionClientProps {
  /** Partes de obra, de más reciente a más antiguo (por semana). */
  updates: PortalWeeklyUpdate[];
  photos: PortalPhoto[];
  projectId: string;
  /** Fecha de llaves estimada por el estudio (YYYY-MM-DD), o null si no la hay. */
  llavesIso: string | null;
  /** El último parte es nuevo para quien mira: se dibuja el rotulador. */
  nuevo: boolean;
}

// ─── Formato ─────────────────────────────────────────────────────────────────────

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-22…" → "22 nov" (o "22 nov 2026"). Se trocea el texto, sin Date (como lib/format-date-es). */
function fechaCorta(value?: string | null, conAnio = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((value || "").trim());
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  if (!m || !mes) return "";
  return `${Number(m[3])} ${mes}${conAnio ? ` ${m[1]}` : ""}`;
}

/** Un texto del parte en líneas (el estudio escribe una tarea por línea, a veces con guion). */
function lineas(texto?: string | null): string[] {
  return (texto || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•·*]\s+/, "").trim())
    .filter(Boolean);
}

const etiquetaCorta = (week: number) => (week === CLOSING_WEEK_NUMBER ? "Cierre" : `S${week}`);
const delParte = (week: number) =>
  week === CLOSING_WEEK_NUMBER ? "el parte de cierre" : `el parte de la semana ${week}`;
const pct = (v: number) => Math.min(100, Math.max(0, Number(v) || 0));

/**
 * La frase que tranquiliza («…y no afecta a la fecha de entrega.») va en negrita, como en
 * la propuesta. Solo se resalta si el propio texto del estudio la dice; no se añade nada.
 */
const CALMA =
  /(no afecta|sin afectar|no cambia|no retrasa|sin retraso|no supone|sin coste|sin impacto|se mantiene|mantenemos|seguimos en plazo|(?:ya |queda |está )resuelt[oa]|bajo control)/i;

function conCalmaEnNegrita(texto: string): ReactNode {
  const frases = texto.split(/(?<=[.!?…])\s+/);
  return frases.map((frase, i) => {
    const sep = i < frases.length - 1 ? " " : "";
    const m = CALMA.exec(frase);
    if (!m) return <React.Fragment key={i}>{frase}{sep}</React.Fragment>;
    return (
      <React.Fragment key={i}>
        {frase.slice(0, m.index)}
        <strong className="font-semibold">{frase.slice(m.index)}</strong>
        {sep}
      </React.Fragment>
    );
  });
}

/** Lo que dice la cifra respecto al parte anterior, solo con los datos de los partes. */
function deltaAvance(ultimo: PortalWeeklyUpdate, anterior?: PortalWeeklyUpdate) {
  const caption = `según ${delParte(ultimo.week_number)}`;
  if (!anterior) return { strong: "Primer parte de la obra", caption, desde: 0 };
  const d = Math.round(pct(ultimo.progress_percentage) - pct(anterior.progress_percentage));
  const seguida = ultimo.week_number === anterior.week_number + 1;
  const strong =
    d > 0
      ? seguida ? `+${d} puntos esta semana` : `+${d} puntos desde la semana ${anterior.week_number}`
      : d === 0
        ? seguida ? "Igual que la semana anterior" : `Igual que en la semana ${anterior.week_number}`
        : `−${Math.abs(d)} puntos respecto a la semana ${anterior.week_number}`;
  return { strong, caption, desde: pct(anterior.progress_percentage) };
}

/** «En obra»: un gremio por su nombre; varios, por su número. */
function enObra(gremios: string[]): string | null {
  if (gremios.length === 0) return null;
  return gremios.length === 1 ? gremios[0] : `${gremios.length} gremios`;
}

// ─── Pantalla ────────────────────────────────────────────────────────────────────

export function ConstructionClient({ updates, photos, projectId, llavesIso, nuevo }: ConstructionClientProps) {
  // Visor de fotos ampliado
  const [lightboxPhoto, setLightboxPhoto] = useState<PortalPhoto | null>(null);
  // Partes anteriores desplegados
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});

  const ultimo = updates[0];
  const anteriores = updates.slice(1);
  const fotosDe = (updateId: string) => photos.filter((p) => p.weekly_update_id === updateId);

  const intro = (
    <p className="max-w-xl text-sm leading-[1.6] text-ink-soft">
      El parte que te deja tu arquitecto de Despeja la X tras cada visita de obra: lo que se ha hecho, lo que viene y
      las fotos de los avances.
    </p>
  );

  if (!ultimo) {
    return (
      <div>
        <header className="space-y-3">
          <Eyebrow>Seguimiento semanal</Eyebrow>
          <h1 className="display-portal text-ink">Diario de obra</h1>
          {intro}
        </header>
        <div className="mt-8 rounded-xl border border-border bg-card px-6 py-10 text-center">
          <HardHat className="mx-auto size-6 text-ink-mute" aria-hidden />
          <p className="mt-3 text-[15px] font-semibold text-ink">Aún no hay partes de obra publicados</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-[1.55] text-ink-soft">
            Cuando empiece la obra, tu arquitecto publicará aquí el parte de cada visita, con sus fotos.
          </p>
        </div>
      </div>
    );
  }

  const gremios = gremiosDeAsistentes(ultimo.attendees);
  const delta = deltaAvance(ultimo, anteriores[0]);
  const fotosUltimo = fotosDe(ultimo.id);
  const enObraUltimo = enObra(gremios);

  return (
    <div>
      {/* ── Cabecera: el parte más reciente, como la ficha de un cuadro técnico ── */}
      <header className="space-y-3">
        <Eyebrow>Diario de obra</Eyebrow>
        <h1 className="display-portal text-ink [text-wrap:balance]">{ultimo.title}</h1>
        {intro}
      </header>
      <Cells
        className="mt-6"
        items={[
          { k: "Parte", v: weekLabel(ultimo.week_number) },
          { k: "Fecha", v: fechaCorta(ultimo.created_at) || "—" },
          ...(enObraUltimo ? [{ k: "En obra", v: enObraUltimo }] : []),
        ]}
      />

      {/* ── Avance real: la cifra cartel y la regla con el rotulador de esta semana ── */}
      <section aria-labelledby="obra-avance" className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <div className="shrink-0">
            <p id="obra-avance" className="cell-k">Avance real</p>
            <p className="kpi mt-3 text-[92px] leading-[0.86] tracking-[-0.03em] text-ink sm:text-[112px]">
              {ultimo.progress_percentage}
              <span className="relative top-1.5 ml-1 align-top text-[22px] font-medium tracking-normal text-ink-soft">%</span>
            </p>
          </div>
          <p className="min-w-0 pb-1 text-right">
            <span className="block text-[15px] font-semibold leading-[1.35] text-ink">{delta.strong}</span>
            <span className="block text-[13px] leading-[1.4] text-ink-mute">{delta.caption}</span>
          </p>
        </div>
        <ReglaAvance
          partes={[...updates].reverse()}
          ultimo={ultimo}
          desde={delta.desde}
          llavesIso={llavesIso}
          nuevo={nuevo}
        />
      </section>

      {/* ── El parte: cuadro técnico numerado ── */}
      <section aria-labelledby="obra-parte" className="mt-12">
        <SecHead id="obra-parte" title="El parte" />
        {ultimo.summary && <p className="mt-4 text-base leading-[1.6] text-ink">{ultimo.summary}</p>}
        <CuadroParte update={ultimo} gremios={gremios} projectId={projectId} nivel="h3" />
      </section>

      {/* ── Fotos del parte ── */}
      {fotosUltimo.length > 0 && (
        <section aria-labelledby="obra-fotos" className="mt-12">
          <SecHead
            id="obra-fotos"
            title="Fotos del parte"
            action={
              <span className="shrink-0 text-[13px] text-ink-mute">
                {fotosUltimo.length} {fotosUltimo.length === 1 ? "foto" : "fotos"}
              </span>
            }
          />
          <div className="mt-4">
            <FotosParte fotos={fotosUltimo} destacada onAbrir={setLightboxPhoto} />
          </div>
        </section>
      )}

      {/* ── Semanas anteriores: filas tranquilas que se despliegan ── */}
      {anteriores.length > 0 && (
        <section aria-labelledby="obra-antes" className="mt-12">
          <SecHead id="obra-antes" title="Semanas anteriores" />
          <ol>
            {anteriores.map((u) => {
              const abierto = !!abiertos[u.id];
              const gremiosU = gremiosDeAsistentes(u.attendees);
              const enObraU = enObra(gremiosU);
              const fotosU = fotosDe(u.id);
              return (
                <li key={u.id} className="border-b border-border last:border-b-0">
                  <h3 className="font-sans normal-case tracking-normal">
                    <button
                      type="button"
                      aria-expanded={abierto}
                      aria-controls={`parte-${u.id}`}
                      onClick={() => setAbiertos((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                      className="grid min-h-14 w-full grid-cols-[48px_minmax(0,1fr)_auto_20px] items-center gap-x-2.5 py-2 text-left"
                    >
                      <span className="numeral text-sm text-ink">{etiquetaCorta(u.week_number)}</span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold leading-[1.3] text-ink">{u.title}</span>
                        <span className="block text-[13px] font-normal leading-[1.4] text-ink-mute">
                          Parte del {fechaCorta(u.created_at)}
                          {fotosU.length > 0 && ` · ${fotosU.length} ${fotosU.length === 1 ? "foto" : "fotos"}`}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-ink-soft">{u.progress_percentage} %</span>
                      <ChevronDown
                        aria-hidden
                        className={cn("size-5 text-ink-mute transition-transform duration-[220ms]", abierto && "rotate-180")}
                      />
                    </button>
                  </h3>
                  <div id={`parte-${u.id}`} hidden={!abierto} className="pb-8 pt-1 sm:pl-[58px]">
                    <Cells
                      items={[
                        { k: "Fecha", v: fechaCorta(u.created_at) || "—" },
                        { k: "Avance", v: `${u.progress_percentage} %` },
                        ...(enObraU ? [{ k: "En obra", v: enObraU }] : []),
                      ]}
                    />
                    {u.summary && <p className="mt-4 text-[15px] leading-[1.6] text-ink">{u.summary}</p>}
                    <CuadroParte update={u} gremios={gremiosU} projectId={projectId} nivel="h4" />
                    {fotosU.length > 0 && (
                      <div className="mt-5">
                        <FotosParte fotos={fotosU} onAbrir={setLightboxPhoto} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {lightboxPhoto && <VisorFoto photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />}
    </div>
  );
}

// ─── Regla de avance ─────────────────────────────────────────────────────────────

/**
 * Filete de 0 a 100 %, barra Jet hasta el parte anterior y, encima, el rotulador Saffron con lo
 * avanzado en el último parte (la única pieza Saffron de la pantalla). Un nudo por parte.
 */
function ReglaAvance({
  partes,
  ultimo,
  desde,
  llavesIso,
  nuevo,
}: {
  /** De más antiguo a más reciente. */
  partes: PortalWeeklyUpdate[];
  ultimo: PortalWeeklyUpdate;
  desde: number;
  llavesIso: string | null;
  nuevo: boolean;
}) {
  const hasta = pct(ultimo.progress_percentage);
  const ini = Math.min(pct(desde), hasta);
  const marca = hasta - ini;

  // Etiquetas de los nudos sin pisarse: siempre la del último y, hacia atrás, las que quepan
  const conEtiqueta = new Set<string>();
  let ultimaX = Infinity;
  for (const p of [...partes].reverse()) {
    const x = pct(p.progress_percentage);
    if (p.id === ultimo.id || ultimaX - x >= 7) {
      conEtiqueta.add(p.id);
      ultimaX = x;
    }
  }

  const llaves = llavesIso ? fechaCorta(llavesIso, true) : "";
  const descripcion =
    `Avance real por parte: ${partes.map((p) => `${weekLabel(p.week_number).toLowerCase()}, ${p.progress_percentage} %`).join("; ")}.` +
    (llaves ? ` Llaves: fecha estimada el ${formatDateEs(llavesIso)}.` : "");

  return (
    <div className={cn("mt-6", nuevo && ["novedad", styles.novedad])}>
      <div role="img" aria-label={descripcion}>
        {llaves && (
          <p aria-hidden className="mb-1 text-right text-xs font-semibold leading-tight text-ink-soft">
            Llaves · estimada · {llaves}
          </p>
        )}
        <div aria-hidden className="relative mx-[7px] h-[30px]">
          {/* cotas de arranque y de llaves */}
          <span className="absolute left-0 top-2 h-3.5 w-px -translate-x-1/2 rotate-45 bg-ink" />
          <span className="absolute right-0 top-2 h-3.5 w-px translate-x-1/2 rotate-45 bg-ink" />
          <span className="absolute right-0 top-1 h-[22px] w-px translate-x-1/2 bg-ink" />
          {/* filete de 0 a 100 % y barra hasta el parte anterior */}
          <span className="absolute inset-x-0 top-[14px] h-0.5 bg-ink" />
          <span className="absolute left-0 top-3 h-1.5 bg-ink" style={{ width: `${ini}%` }} />
          {/* el rotulador: lo de este parte */}
          {marca > 0 && (
            <svg
              className="absolute top-[9px] h-3 overflow-visible mix-blend-multiply"
              style={{ left: `${ini}%`, width: `${marca}%` }}
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
            >
              <path className={cn(styles.marcador, "stroke-saffron")} d="M0 6H100" strokeWidth={12} pathLength={100} fill="none" />
            </svg>
          )}
          {/* nudos: un parte por semana; el último, disco Jet */}
          {partes.map((p) =>
            p.id === ultimo.id ? null : (
              <span
                key={p.id}
                className="absolute top-[15px] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-whitesmoke"
                style={{ left: `${pct(p.progress_percentage)}%` }}
              />
            ),
          )}
          <span
            className="absolute top-[15px] size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-whitesmoke bg-ink"
            style={{ left: `${hasta}%` }}
          />
        </div>
        <div aria-hidden className="relative mx-[7px] h-5">
          {partes
            .filter((p) => conEtiqueta.has(p.id))
            .map((p) => (
              <span
                key={p.id}
                className={cn(
                  "numeral absolute top-1.5 -translate-x-1/2 whitespace-nowrap text-xs",
                  p.id === ultimo.id ? "text-ink" : "text-ink-mute",
                )}
                style={{ left: `${pct(p.progress_percentage)}%` }}
              >
                {etiquetaCorta(p.week_number)}
              </span>
            ))}
        </div>
      </div>
      {marca > 0 && <p className="mt-3 text-[13px] leading-[1.45] text-ink-soft">Marcado en amarillo: lo avanzado con este parte.</p>}
    </div>
  );
}

// ─── El parte como cuadro técnico ────────────────────────────────────────────────

function CuadroParte({
  update,
  gremios,
  projectId,
  nivel,
}: {
  update: PortalWeeklyUpdate;
  gremios: string[];
  projectId: string;
  nivel: "h3" | "h4";
}) {
  const Titulo = nivel;
  const filas: Array<{ key: string; titulo: string; cuerpo: ReactNode }> = [];

  const hechos = lineas(update.current_work);
  if (hechos.length > 0) {
    filas.push({
      key: "hechos",
      titulo: "Trabajos realizados",
      cuerpo: (
        <ul>
          {hechos.map((l, i) => (
            <li key={i} className="flex gap-2.5 py-1 text-[15px] leading-[1.45] text-ink">
              <Check aria-hidden className="mt-[3px] size-4 shrink-0 text-ink-mute" />
              {l}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (update.issues) {
    filas.push({
      key: "incidencias",
      titulo: "Incidencias",
      cuerpo: (
        <Notice title="Detectada en la visita" icon={<Info aria-hidden />}>
          {lineas(update.issues).map((l, i) => (
            <p key={i} className={i > 0 ? "mt-1.5" : undefined}>{conCalmaEnNegrita(l)}</p>
          ))}
        </Notice>
      ),
    });
  }

  if (update.decisions_needed) {
    filas.push({
      key: "decisiones",
      titulo: "Decisiones necesarias",
      cuerpo: (
        <Notice title="Necesitamos tu respuesta" icon={<CircleHelp aria-hidden />}>
          {lineas(update.decisions_needed).map((l, i) => (
            <p key={i} className={i > 0 ? "mt-1.5" : undefined}>{l}</p>
          ))}
          <Link
            href={`/dashboard/projects/${projectId}/decisions`}
            className="-mb-2 inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4"
          >
            Ir a tus decisiones
          </Link>
        </Notice>
      ),
    });
  }

  const siguientes = lineas(update.next_steps);
  if (siguientes.length > 0) {
    filas.push({
      key: "siguientes",
      titulo: "Próximos pasos",
      cuerpo: (
        <ul>
          {siguientes.map((l, i) => (
            <li key={i} className="flex gap-3 py-1 text-[15px] leading-[1.45] text-ink">
              <span aria-hidden className="mx-[3px] mt-1.5 size-2.5 shrink-0 rounded-full border-[1.5px] border-zinc-400" />
              {l}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (gremios.length > 0) {
    filas.push({
      key: "en-obra",
      titulo: "En obra",
      cuerpo: (
        <ul className="flex flex-wrap gap-1.5" aria-label="Gremios en la visita">
          {gremios.map((g) => (
            <li
              key={g}
              className="rounded-md bg-done-surface px-2.5 py-1 text-xs font-semibold uppercase leading-[1.4] tracking-[0.04em] text-done-ink"
            >
              {g}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (filas.length === 0) return null;

  return (
    <ol className="mt-6 border-t-[1.5px] border-ink">
      {filas.map((f, i) => (
        <li
          key={f.key}
          className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-2 border-b border-border pb-5 pt-[18px] sm:grid-cols-[40px_240px_minmax(0,1fr)] sm:gap-x-4"
        >
          <span className="numeral pt-[3px] text-[15px] text-ink">{String(i + 1).padStart(2, "0")}</span>
          <Titulo className="text-lg leading-[1.2] text-ink">{f.titulo}</Titulo>
          <div className="col-start-2 mt-3 min-w-0 sm:col-start-3 sm:mt-0">{f.cuerpo}</div>
        </li>
      ))}
    </ol>
  );
}

// ─── Fotos ───────────────────────────────────────────────────────────────────────

/** Cada foto dice lo que es: foto de obra, y de qué estancia. */
const tagLargo = (f: PortalPhoto) => (f.room ? `Foto de obra · ${f.room}` : "Foto de obra");
const tagCorto = (f: PortalPhoto) => (f.room ? `Obra · ${f.room}` : "Foto de obra");

function FotoBoton({
  foto,
  grande = false,
  onAbrir,
}: {
  foto: PortalPhoto;
  grande?: boolean;
  onAbrir: (f: PortalPhoto) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(foto)}
      aria-label={`Ampliar la foto: ${foto.caption || tagLargo(foto)}`}
      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-zinc-100"
    >
      <PhotoImage photo={foto} mode="gallery" fill className="object-cover" tag={grande ? tagLargo(foto) : tagCorto(foto)} />
      <span aria-hidden className="pointer-events-none absolute inset-0 z-20 transition-colors group-hover:bg-jet/10" />
    </button>
  );
}

/**
 * Fotos de un parte. En el último, la primera grande y cuatro al lado; en los anteriores,
 * una rejilla. Carga progresiva: el resto, al pedirlas.
 */
function FotosParte({
  fotos,
  destacada = false,
  onAbrir,
}: {
  fotos: PortalPhoto[];
  destacada?: boolean;
  onAbrir: (f: PortalPhoto) => void;
}) {
  const [todas, setTodas] = useState(false);
  const inicial = destacada ? 5 : 4;
  const visibles = todas ? fotos : fotos.slice(0, inicial);

  const rejilla = (lista: PortalPhoto[], className?: string) =>
    lista.length > 0 && (
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
        {lista.map((f) => (
          <FotoBoton key={f.id} foto={f} onAbrir={onAbrir} />
        ))}
      </div>
    );

  return (
    <>
      {destacada ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <FotoBoton foto={visibles[0]} grande onAbrir={onAbrir} />
            {visibles.length > 1 && (
              <div className="grid grid-cols-2 content-start gap-2">
                {visibles.slice(1, 5).map((f) => (
                  <FotoBoton key={f.id} foto={f} onAbrir={onAbrir} />
                ))}
              </div>
            )}
          </div>
          {rejilla(visibles.slice(5), "mt-2")}
        </>
      ) : (
        rejilla(visibles)
      )}
      {fotos.length > inicial && (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          aria-expanded={todas}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-control-line px-5 text-sm font-semibold text-ink hover:border-ink hover:bg-zinc-100 sm:w-auto"
        >
          {todas ? "Ver menos" : `Ver las ${fotos.length} fotos`}
        </button>
      )}
    </>
  );
}

/** Visor de fotos ampliado. Se cierra con la X, tocando fuera o con Escape. */
function VisorFoto({ photo, onClose }: { photo: PortalPhoto; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subida = formatDateEs(photo.created_at);

  // En <body>: dentro de <main> (z-10) el visor quedaba bajo la cabecera y su botón de cerrar, tapado
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || tagLargo(photo)}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-jet/95 p-4 backdrop-blur-md"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar la foto"
        autoFocus
        className="absolute right-4 top-4 z-[130] inline-flex size-11 items-center justify-center rounded-full border border-[#9da19a] text-whitesmoke hover:bg-white/10"
      >
        <X className="size-5" aria-hidden />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[65vh] w-full max-w-4xl items-center justify-center overflow-hidden rounded-xl bg-zinc-950 md:h-[72vh]"
      >
        <PhotoImage photo={photo} mode="detail" fill className="object-contain" tag={tagLargo(photo)} />
      </div>

      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl px-1 pt-4 text-whitesmoke">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-300">{photo.room || "Obra"}</p>
        <p className="mt-1.5 max-w-xl text-sm leading-[1.55]">{photo.caption || "Sin pie de foto descriptivo."}</p>
        {subida && <p className="mt-1 text-[13px] text-zinc-300">Subida el {subida}</p>}
      </div>
    </div>,
    document.body,
  );
}
