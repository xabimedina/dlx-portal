"use client";

/**
 * Maqueta 3D del proyecto: envuelve el módulo `src/lib/visor3d` y pinta su
 * interfaz (§6.1–6.2 del handoff). Lienzo claro (papel); en escritorio el panel de
 * estancias va dentro del lienzo como en la demo, en móvil debajo y en el
 * flujo de la página. Nada se puede descargar (§3.4.7): sin enlaces a los
 * ficheros, imágenes como fondo CSS, sin menú contextual ni arrastre.
 *
 * Usa three: cargarlo solo con `next/dynamic(..., { ssr: false })`.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Camera, Scan, X } from "lucide-react";
import {
  createVisor3D, ErrorWebGL, CORTE_INICIAL, CORTE_MAX, CORTE_MIN,
  type Capa, type EstanciaVisor, type ImagenVisor, type Modo, type Visor3D,
} from "@/lib/visor3d/visor";
import { polyStats } from "@/lib/visor3d/geometria";
import type { FaseModelo, ModeloWeb } from "@/lib/model3d/validar-modelo-web";
import "./maqueta-3d.css";

export interface Maqueta3DProps {
  /** URLs de las capas GLB; al principio de la obra solo hay conservado */
  modelos: Partial<Record<Capa, string>>;
  /** modelo_web.json ya validado */
  datos: ModeloWeb;
  imagenes: ImagenVisor[];
  /** Carpeta de los decodificadores Draco (por defecto /draco/) */
  draco?: string;
  /** Lo que va a la izquierda de los controles (título de la sección) */
  cabecera?: ReactNode;
  /** Ocupa toda la altura del contenedor (página propia) en vez de una altura fija dentro de otra página */
  pantallaCompleta?: boolean;
}

// En el orden de la obra: cómo está, qué se derriba, cómo quedará
const MODOS: { id: Modo; label: string }[] = [
  { id: "actual", label: "Actual" },
  { id: "derribos", label: "Derribos" },
  { id: "reformado", label: "Reformado" },
];
const NOMBRE_ESTADO: Record<Modo, string> = { actual: "Estado actual", derribos: "Derribos", reformado: "Estado reformado" };
// Derribos se mira sobre la distribución de hoy
const faseDe = (m: Modo): FaseModelo => (m === "reformado" ? "reformado" : "actual");
const fmt1 = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = (n: number) => String(n).padStart(2, "0");
const etiquetaImagen = (img: ImagenVisor) => `${img.tipo === "foto" ? "Foto" : "Render"} ${pad2(img.n)}`;
const fondo = (url: string) => ({ backgroundImage: `url(${JSON.stringify(url)})` });
const sinMenu = (e: { preventDefault: () => void }) => e.preventDefault();

/** Comprueba si una imagen firmada se puede cargar (las URLs caducan a la hora) */
function useCargaImagen(url: string | null): "sin-url" | "cargando" | "ok" | "error" {
  const [estado, setEstado] = useState<{ url: string | null; valor: "cargando" | "ok" | "error" }>({ url: null, valor: "cargando" });
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    const img = new Image();
    img.onload = () => { if (vivo) setEstado({ url, valor: "ok" }); };
    img.onerror = () => { if (vivo) setEstado({ url, valor: "error" }); };
    img.src = url;
    return () => { vivo = false; };
  }, [url]);
  if (!url) return "sin-url";
  return estado.url === url ? estado.valor : "cargando";
}

export function Maqueta3D({ modelos, datos, imagenes, draco = "/draco/", cabecera, pantallaCompleta = false }: Maqueta3DProps) {
  const lienzoRef = useRef<HTMLDivElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const carrilRef = useRef<HTMLDivElement>(null);
  const visorRef = useRef<Visor3D | null>(null);

  const [intento, setIntento] = useState(0);
  const [listo, setListo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("actual");
  const [sel, setSel] = useState<EstanciaVisor | null>(null);
  const [corte, setCorte] = useState(CORTE_INICIAL);
  const [abierta, setAbierta] = useState<ImagenVisor | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null);

  const abiertaRef = useRef<ImagenVisor | null>(null);
  const selRef = useRef<EstanciaVisor | null>(null);
  useEffect(() => { abiertaRef.current = abierta; }, [abierta]);
  useEffect(() => { selRef.current = sel; }, [sel]);

  // Montaje del visor (y desmontaje completo: la página se abre y se cierra muchas veces)
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    let visor: Visor3D;
    try {
      visor = createVisor3D(contenedor, {
        modelos, datos, imagenes, draco,
        movil: window.matchMedia("(max-width: 1023px)").matches,
        // El carril de corte (derecha) tapa el lienzo siempre; el panel (izquierda), solo en escritorio
        margenes: () => {
          const p = panelRef.current, r = carrilRef.current, c = contenedorRef.current;
          if (!c) return { izquierda: 0, arriba: 0, abajo: 0 };
          const lienzo = c.getBoundingClientRect();
          return {
            izquierda: p && p.offsetParent !== null ? Math.max(0, p.getBoundingClientRect().right - lienzo.left + 16) : 0,
            derecha: r ? Math.max(0, lienzo.right - r.getBoundingClientRect().left + 8) : 0,
            arriba: 0,
            abajo: 0,
          };
        },
      });
    } catch (err) {
      console.error(err);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el fallo de WebGL solo se conoce al crear el visor
      setError(err instanceof ErrorWebGL
        ? "Este navegador no puede mostrar la maqueta 3D (WebGL no disponible). Prueba con Chrome, Safari o Firefox actualizados."
        : "No se pudo cargar la maqueta. Recarga la página; si sigue fallando, avísanos.");
      return;
    }
    visorRef.current = visor;
    let avisoId = 0;
    let temporizador = 0;
    let imagenActual: ImagenVisor | null = null;
    const quitar = [
      visor.on("listo", () => setListo(true)),
      visor.on("progreso", setProgreso),
      visor.on("estado", setModo),
      visor.on("estancia", setSel),
      visor.on("corte", setCorte),
      visor.on("imagen", (img) => {
        imagenActual = img;
        if (img) {
          setAbierta(img);
          requestAnimationFrame(() => setMostrar(true));
        } else {
          // Fundido inverso y fuera, salvo que se haya abierto otra entretanto
          setMostrar(false);
          window.setTimeout(() => { if (!imagenActual) setAbierta(null); }, 230);
        }
      }),
      visor.on("aviso", (texto) => {
        setAviso({ texto, id: ++avisoId });
        window.clearTimeout(temporizador);
        temporizador = window.setTimeout(() => setAviso(null), 2800);
      }),
      visor.on("error", (err) => {
        console.error(err);
        setError("No se pudo cargar la maqueta. Recarga la página; si sigue fallando, avísanos.");
      }),
    ];

    const ro = new ResizeObserver(() => visor.relayout());
    if (panelRef.current) ro.observe(panelRef.current);

    return () => {
      ro.disconnect();
      quitar.forEach((q) => q());
      window.clearTimeout(temporizador);
      visor.destroy();
      visorRef.current = null;
      setListo(false);
      setProgreso(0);
      setModo("actual");
      setSel(null);
      setCorte(CORTE_INICIAL);
      setAbierta(null);
      setMostrar(false);
    };
  }, [modelos, datos, imagenes, draco, intento]);

  // Esc cierra la imagen; otro Esc quita la selección
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !visorRef.current) return;
      if (abiertaRef.current) visorRef.current.cerrarImagen();
      else if (selRef.current) visorRef.current.seleccionar(null, { volar: false });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const fase = faseDe(modo);
  // m² de Revit si vienen; si no, los del contorno (igual que el visor)
  const estancias = useMemo(
    () => datos.fases[fase].estancias.map((e) => ({ id: e.id, nombre: e.nombre, area: e.area_m2 ?? polyStats(e.contorno).area })),
    [datos, fase],
  );
  const imagenesSel = useMemo(
    () => (sel ? imagenes.filter((i) => i.estado === fase && i.estancia === sel.id).sort((a, b) => a.n - b.n) : []),
    [imagenes, fase, sel],
  );

  const reintentar = () => {
    setError(null);
    setIntento((n) => n + 1);
  };
  const v = () => visorRef.current;

  const panel = (variante: "lienzo" | "pagina") => (
    <PanelEstancias
      variante={variante}
      modo={modo}
      estancias={estancias}
      sel={sel}
      imagenes={imagenesSel}
      onEstancia={(id) => v()?.seleccionar(id, { volar: true })}
      onImagen={(id) => v()?.abrirImagen(id)}
    />
  );

  const nombreEstancia = (img: ImagenVisor) =>
    datos.fases[img.estado].estancias.find((e) => e.id === img.estancia)?.nombre ?? img.estancia;

  // Al principio de la obra solo hay estado actual: el reformado llega en versiones posteriores
  const hayReformado = !!modelos.demolido || !!modelos.nuevo || datos.fases.reformado.estancias.length > 0;
  const disponibilidad: Record<Modo, { ok: boolean; motivo?: string }> = {
    actual: { ok: true },
    derribos: { ok: !!modelos.demolido, motivo: hayReformado ? "Esta reforma no derriba nada" : "Los derribos aparecerán cuando el estudio diseñe la reforma" },
    reformado: { ok: hayReformado, motivo: "El reformado aparecerá cuando el estudio lo diseñe" },
  };

  return (
    <div className={pantallaCompleta ? "m3d flex h-full flex-col gap-3" : "m3d space-y-3"} onContextMenu={sinMenu}>
      {/* Controles */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        {cabecera ? <div className="min-w-0">{cabecera}</div> : null}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Estado del proyecto" className="flex rounded-full border border-zinc-200 bg-white p-[3px] dark:border-zinc-800 dark:bg-zinc-900">
              {MODOS.map((m) => {
                const { ok: disponible, motivo } = disponibilidad[m.id];
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={modo === m.id}
                    aria-disabled={!disponible}
                    disabled={!disponible}
                    title={disponible ? undefined : motivo}
                    onClick={() => v()?.setEstado(m.id)}
                    className={`rounded-full px-3 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors sm:px-3.5 ${
                      modo === m.id
                        ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : disponible
                          ? "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          : "cursor-not-allowed text-zinc-300 dark:text-zinc-700"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => v()?.vistaGeneral()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Vista general"
            >
              <Scan className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Vista general</span>
            </button>
          </div>
          {!hayReformado && (
            <p className="text-[11px] text-zinc-500">Tu vivienda tal como está hoy. El reformado aparecerá aquí cuando lo diseñemos.</p>
          )}
        </div>
      </div>

      {/* Lienzo */}
      <div
        ref={lienzoRef}
        className={`m3d-frame relative overflow-hidden rounded-3xl bg-[#f1efeb] text-[#1e201e] select-none ${
          pantallaCompleta ? "min-h-[240px] flex-1" : "h-[56vh] min-h-[340px] lg:h-[70vh] lg:min-h-[480px]"
        }`}
        style={{ fontFamily: "var(--m3d-body)" }}
      >
        <div ref={contenedorRef} className="absolute inset-0 touch-none" aria-label="Maqueta 3D de la vivienda" />

        {/* Panel de estancias dentro del lienzo (escritorio) */}
        <div ref={panelRef} className="absolute bottom-4 left-4 top-4 z-10 hidden w-[260px] lg:flex">
          {panel("lienzo")}
        </div>

        {/* Carril de corte */}
        <div ref={carrilRef} className="absolute right-2.5 top-3 z-10 flex min-w-[52px] flex-col items-center gap-1.5 rounded-full border border-[var(--m3d-line)] bg-[var(--m3d-surface)] px-1.5 pb-2 pt-2.5 backdrop-blur-md lg:right-4 lg:top-1/2 lg:-translate-y-1/2">
          <span className="whitespace-nowrap font-heading text-[11px] font-semibold tracking-[0.04em] text-[var(--m3d-jet-950)] tabular-nums">
            {corte < 2.95 ? `${fmt2(corte)} m` : "Sin corte"}
          </span>
          <div className="m3d-cut">
            <input
              type="range"
              min={CORTE_MIN}
              max={CORTE_MAX}
              step={0.05}
              value={Math.round(corte * 20) / 20}
              onChange={(e) => v()?.setCorte(parseFloat(e.target.value))}
              aria-label="Altura del plano de corte en metros"
            />
          </div>
          <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-[var(--m3d-jet-500)]">Corte</span>
        </div>

        {/* Leyenda (Derribos y Reformado) */}
        {modo !== "actual" && (
          <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1.5 rounded-full border border-[var(--m3d-line)] bg-[var(--m3d-surface)] px-3 py-2 text-[10.5px] text-[var(--m3d-jet-700)] backdrop-blur-md lg:bottom-4 lg:left-[292px] lg:text-[11.5px]">
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-3.5 rounded-sm bg-white outline outline-1 -outline-offset-1 outline-[var(--m3d-jet-400)]" />Se conserva</span>
            {modo === "derribos" ? (
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-3.5 rounded-sm bg-[rgba(235,167,156,.55)] outline outline-1 -outline-offset-1 outline-dashed outline-[#c4513f]" />Se derriba</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-3.5 rounded-sm bg-[var(--m3d-saffron)]" />Obra nueva</span>
            )}
          </div>
        )}

        {/* Aviso */}
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute left-1/2 top-4 z-20 max-w-[calc(100%-32px)] -translate-x-1/2 truncate rounded-full bg-[#1e201e] px-3.5 py-2 text-[12.5px] font-medium text-[#f5f3f4] transition-opacity duration-200 ${aviso ? "opacity-100" : "opacity-0"}`}
        >
          {aviso?.texto}
        </div>

        {/* Imagen a pantalla del lienzo */}
        {abierta && (
          <ImagenAbierta
            imagen={abierta}
            estancia={nombreEstancia(abierta)}
            mostrar={mostrar}
            onCerrar={() => v()?.cerrarImagen()}
          />
        )}

        {/* Carga y errores */}
        {(!listo || error) && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#f1efeb] p-6 text-center">
            {error ? (
              <>
                <p className="max-w-sm text-sm leading-relaxed text-[var(--m3d-jet-700)]">{error}</p>
                <button
                  type="button"
                  onClick={reintentar}
                  className="rounded-full border border-[var(--m3d-line-strong)] bg-white px-4 py-2 text-xs font-medium text-[#1e201e] hover:bg-[var(--m3d-hover)]"
                >
                  Reintentar
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--m3d-jet-500)]">Cargando maqueta…</span>
                <span className="h-0.5 w-32 overflow-hidden rounded-full bg-[var(--m3d-line)]">
                  <span className="block h-full bg-[var(--m3d-saffron)] transition-[width] duration-200" style={{ width: `${Math.round(progreso * 100)}%` }} />
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ayuda (escritorio) */}
      <p className={`hidden text-right text-[11px] text-zinc-500 ${pantallaCompleta ? "" : "lg:block"}`}>
        Arrastra para orbitar · rueda o pellizco para acercar · dos dedos o botón derecho para desplazar
      </p>

      {/* Panel de estancias en la página (móvil y tableta) */}
      <div className={pantallaCompleta ? "max-h-[38%] shrink-0 overflow-y-auto lg:hidden" : "lg:hidden"}>{panel("pagina")}</div>
    </div>
  );
}

export default Maqueta3D;

interface PanelProps {
  variante: "lienzo" | "pagina";
  modo: Modo;
  estancias: { id: string; nombre: string; area: number | null }[];
  sel: EstanciaVisor | null;
  imagenes: ImagenVisor[];
  onEstancia: (id: string) => void;
  onImagen: (id: string) => void;
}

function PanelEstancias({ variante, modo, estancias, sel, imagenes, onEstancia, onImagen }: PanelProps) {
  const enLienzo = variante === "lienzo";
  const listaRef = useRef<HTMLUListElement>(null);

  // En móvil, la estancia elegida se desliza a la vista dentro de la fila de chips
  useEffect(() => {
    if (enLienzo || !sel) return;
    listaRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(sel.id)}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [enLienzo, sel]);

  const eyebrow = `text-[10px] font-medium uppercase tracking-[0.16em] ${enLienzo ? "text-[var(--m3d-jet-500)]" : "text-zinc-500"}`;
  const fase = faseDe(modo);

  return (
    <section
      aria-label="Estancias"
      className={
        enLienzo
          ? "flex w-full flex-col overflow-hidden rounded-xl border border-[var(--m3d-line)] bg-[var(--m3d-surface)] backdrop-blur-md"
          : "rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      <div className="flex items-baseline justify-between gap-2 px-4 pb-2 pt-3.5">
        <span className={eyebrow}>Estancias</span>
        <span className={`text-[11px] ${enLienzo ? "text-[var(--m3d-jet-500)]" : "text-zinc-500"}`}>{NOMBRE_ESTADO[modo]}</span>
      </div>

      <ul
        ref={listaRef}
        className={enLienzo ? "flex flex-col gap-0.5 px-2 pb-1.5" : "m3d-chips flex gap-1.5 overflow-x-auto px-3 pb-3"}
      >
        {estancias.map((e) => {
          const on = sel?.id === e.id && sel.fase === fase;
          return (
            <li key={e.id} className={enLienzo ? "" : "flex-none"}>
              <button
                type="button"
                data-id={e.id}
                onClick={() => onEstancia(e.id)}
                aria-pressed={on}
                className={
                  enLienzo
                    ? `flex w-full items-center justify-between gap-2 rounded-md border-l-2 py-2 pl-3 pr-2.5 text-left text-[13px] font-medium transition-colors ${on ? "border-[var(--m3d-saffron)] bg-[rgba(30,32,30,.06)]" : "border-transparent hover:bg-[var(--m3d-hover)]"}`
                    : `flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? "border-zinc-800 bg-zinc-800 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"}`
                }
              >
                <span>{e.nombre}</span>
                {e.area !== null && (
                  <span className={`text-xs tabular-nums ${enLienzo ? "text-[var(--m3d-jet-500)]" : on ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500"}`}>
                    {fmt1(e.area)} m²
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!sel ? (
        <p className={`px-4 pb-3.5 pt-1 text-xs leading-relaxed ${enLienzo ? "text-[var(--m3d-jet-500)]" : "text-zinc-500"}`}>
          Toca una estancia, aquí o en la maqueta, para volar hasta ella.
        </p>
      ) : (
        <div className={`m3d-scroll flex min-h-0 flex-col gap-1 overflow-y-auto border-t px-4 pb-4 pt-3.5 ${enLienzo ? "border-[var(--m3d-line)]" : "border-zinc-200 dark:border-zinc-800"}`}>
          <span className={eyebrow}>Estancia seleccionada</span>
          <h3 className={`mt-0.5 font-heading text-xl font-semibold uppercase leading-none tracking-[0.02em] ${enLienzo ? "" : "text-zinc-900 dark:text-white"}`}>
            {sel.nombre}
          </h3>
          <div className={`text-xs tabular-nums ${enLienzo ? "text-[var(--m3d-jet-500)]" : "text-zinc-500"}`}>
            {fmt1(sel.area)} m² · {NOMBRE_ESTADO[modo]}
          </div>
          {sel.nota && (
            <p className={`mb-3 mt-2 text-[12.5px] leading-relaxed ${enLienzo ? "text-[var(--m3d-jet-700)]" : "text-zinc-600 dark:text-zinc-400"}`}>{sel.nota}</p>
          )}
          <span className={`${eyebrow} mt-1`}>{fase === "actual" ? "Fotos de la visita" : "Renders"}</span>
          {imagenes.length === 0 ? (
            <p className={`text-xs leading-relaxed ${enLienzo ? "text-[var(--m3d-jet-500)]" : "text-zinc-500"}`}>Todavía no hay imágenes de esta estancia.</p>
          ) : (
            <div className={`mt-1.5 grid gap-2 ${enLienzo ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-4"}`}>
              {imagenes.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onImagen(img.id)}
                  className={`flex min-w-0 flex-col overflow-hidden rounded-lg border text-left transition-transform hover:-translate-y-px ${enLienzo ? "border-[var(--m3d-line)] bg-white" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"}`}
                >
                  {img.thumbUrl ? (
                    <span role="img" aria-label={`${etiquetaImagen(img)} de ${sel.nombre}`} className="m3d-img block aspect-[3/2] w-full bg-cover bg-center" style={fondo(img.thumbUrl)} />
                  ) : (
                    <span className="m3d-hatch grid aspect-[3/2] w-full place-items-center"><Camera className="h-3.5 w-3.5" aria-hidden /></span>
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5 px-2 pb-2 pt-1.5">
                    <span className={`font-heading text-[11px] font-semibold uppercase tracking-[0.06em] ${enLienzo ? "" : "text-zinc-800 dark:text-zinc-200"}`}>{etiquetaImagen(img)}</span>
                    {img.camara && (
                      <span className={`truncate text-[10px] ${enLienzo ? "text-[var(--m3d-jet-500)]" : "text-zinc-500"}`}>{img.titulo ?? img.camara}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ImagenAbierta({ imagen, estancia, mostrar, onCerrar }: { imagen: ImagenVisor; estancia: string; mostrar: boolean; onCerrar: () => void }) {
  const carga = useCargaImagen(imagen.url);
  const tipo = imagen.tipo === "foto" ? "Foto de la visita" : "Render";
  return (
    <div className={`m3d-fade absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[rgba(30,32,30,.94)] p-3 text-[#f5f3f4] sm:p-5 ${mostrar ? "show" : ""}`}>
      <div className="flex w-full max-w-[900px] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--m3d-jet-400)]">
            {tipo} {pad2(imagen.n)}{imagen.camara ? ` · cámara ${imagen.camara}` : ""}
          </span>
          <strong className="truncate font-heading text-sm font-semibold uppercase tracking-[0.02em]">
            {estancia}{imagen.titulo ? ` · ${imagen.titulo}` : ""}
          </strong>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--m3d-dark-line-strong)] px-3.5 py-2 text-xs font-medium hover:bg-[var(--m3d-jet-700)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Volver a la maqueta
        </button>
      </div>
      <div className="relative w-full max-w-[900px] flex-1 overflow-hidden rounded-lg border border-[var(--m3d-dark-line-strong)] bg-[#262826]">
        {carga === "sin-url" ? (
          <div className="m3d-hatch absolute inset-0 grid place-items-center p-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <h4 className="font-heading text-2xl font-semibold uppercase leading-none text-[#f5f3f4] sm:text-3xl">{imagen.titulo ?? estancia}</h4>
              <p className="max-w-[42ch] text-[12.5px] text-[var(--m3d-jet-300)]">Aquí irá la imagen. La maqueta ya está en su punto de vista.</p>
            </div>
          </div>
        ) : carga === "error" ? (
          <div className="absolute inset-0 grid place-items-center p-4 text-center">
            <p className="max-w-[42ch] text-[12.5px] text-[var(--m3d-jet-300)]">El enlace de la imagen ha caducado por seguridad. Recarga la página para volver a verla.</p>
          </div>
        ) : (
          <div
            role="img"
            aria-label={`${tipo} de ${estancia}`}
            className={`m3d-img absolute inset-0 bg-contain bg-center bg-no-repeat transition-opacity duration-300 ${carga === "ok" ? "opacity-100" : "opacity-0"}`}
            style={imagen.url ? fondo(imagen.url) : undefined}
          />
        )}
      </div>
    </div>
  );
}
