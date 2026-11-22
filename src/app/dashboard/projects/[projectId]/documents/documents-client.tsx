"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, Download, FolderOpen, RefreshCw, Search } from "lucide-react";
import { Cells, Eyebrow, Notice, SecHead, StatusBadge } from "@/components/portal-ui";
import { useToast, ToastViewport } from "@/components/toast";
import { daysBetween } from "@/lib/format-date-es";
import type { PortalDocument, PortalPhase } from "@/types/portal";
import { getSignedDocumentUrlAction } from "../../../actions";

/**
 * Documentos (fase 2): un índice en rejilla con filetes (los grupos con su recuento) en
 * lugar de una lista llena de secciones vacías; debajo, el grupo abierto. De cada grupo
 * se enseña primero lo vigente. Las descargas siguen firmándose al momento (60 s).
 * Pantalla tranquila: sin coreografía ni Saffron; el grupo abierto se invierte en Jet.
 */

interface DocumentsClientProps {
  documents: PortalDocument[];
  phases: PortalPhase[];
  projectId: string;
  projectName: string;
  /** Fecha del servidor (YYYY-MM-DD) para «Lo último». */
  today: string;
}

const GROUPS = [
  "Contrato y documentación inicial",
  "Estado actual",
  "Distribución",
  "Materiales",
  "Cocina",
  "Baños",
  "Electricidad",
  "Interiorismo",
  "Renders",
  "Presupuestos",
  "Obra",
  "Entrega"
];

/** Lo vigente primero; lo sustituido, al final (dentro de cada estado, lo más reciente arriba). */
const STATUS_RANK: Record<string, number> = { Aprobado: 0, "Revisión": 1, Borrador: 2, Obsoleto: 3 };

const RECENT_DAYS = 7;
const GROUP_PANEL_ID = "doc-grupo";

const BTN_SECONDARY =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-control-line px-4 text-sm font-semibold text-ink hover:border-jet hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45";

const bytesFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes === 0) return "0\u00a0B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${bytesFmt.format(bytes / Math.pow(1024, i))}\u00a0${sizes[i]}`;
}

/** «application/pdf» → «PDF» (solo si la extensión es corta y legible). */
function formatLabel(mime: string | null | undefined): string {
  const sub = (mime || "").split("/")[1] || "";
  return sub && sub.length <= 4 ? sub.toUpperCase() : "";
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** «2026-11-02…» → «2 nov 2026», para la línea técnica (sin construir un Date). */
function shortDate(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return "";
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

/** «2.1» → «v2.1»; «v3» se queda igual. */
function versionLabel(version: string | null | undefined): string {
  const v = (version || "").trim();
  if (!v) return "";
  return /^v/i.test(v) ? v : `v${v}`;
}

export function DocumentsClient({
  documents,
  phases,
  projectId,
  projectName,
  today,
}: DocumentsClientProps) {
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  // Grupo abierto bajo el índice (por defecto, el primero con documentos)
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Estado de carga individual para las firmas criptográficas de descarga
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Toast (sustituye a los alert() del navegador)
  const { toast, showToast, dismissToast } = useToast();

  // Manejador de descargas seguras mediante firmado de URL on-demand
  const handleDownload = async (doc: PortalDocument) => {
    setLoadingDocId(doc.id);
    try {
      // Generar URL firmada efímera por 60 segundos
      const signedUrl = await getSignedDocumentUrlAction(doc.storage_path);

      // Abrir en nueva pestaña o forzar descarga
      if (typeof window !== "undefined") {
        window.open(signedUrl, "_blank");
      }
    } catch (err) {
      console.error(err);
      showToast("No se pudo preparar la descarga del archivo. Escríbenos desde Reuniones si persiste.", "error");
    } finally {
      setLoadingDocId(null);
    }
  };

  // Algoritmo semántico inteligente de agrupación
  const getDocumentGroup = (doc: PortalDocument) => {
    const phase = phases.find(p => p.id === doc.phase_id);
    const titleLower = doc.title.toLowerCase();

    // 1. Contrato y documentación inicial
    if (doc.category === 'Contrato' || titleLower.includes('contrato') || titleLower.includes('encargo') || titleLower.includes('nota de encargo') || (phase && phase.phase_number === 'Fase 0')) {
      return 'Contrato y documentación inicial';
    }

    // 2. Estado actual
    if (titleLower.includes('estado actual') || titleLower.includes('actual') || titleLower.includes('levantamiento') || titleLower.includes('medicion inicial') || titleLower.includes('plano de estado')) {
      return 'Estado actual';
    }

    // 3. Distribución
    if (titleLower.includes('distribucion') || titleLower.includes('tabiqueria') || titleLower.includes('cotas') || (phase && phase.phase_number === 'Fase 1')) {
      return 'Distribución';
    }

    // 4. Materiales
    if (titleLower.includes('material') || titleLower.includes('acabado') || titleLower.includes('porcelanico') || titleLower.includes('pavimento') || titleLower.includes('suelo') || (phase && phase.phase_number === 'Fase 2')) {
      return 'Materiales';
    }

    // 5. Cocina
    if (titleLower.includes('cocina') || titleLower.includes('electrodomestico') || (phase && phase.phase_number === 'Fase 3')) {
      return 'Cocina';
    }

    // 6. Baños
    if (titleLower.includes('baño') || titleLower.includes('armario') || titleLower.includes('vestidor') || titleLower.includes('sanitario') || (phase && phase.phase_number === 'Fase 4')) {
      return 'Baños';
    }

    // 7. Electricidad
    if (titleLower.includes('electricidad') || titleLower.includes('iluminacion') || titleLower.includes('enchufe') || titleLower.includes('mecanismo') || titleLower.includes('luz') || (phase && phase.phase_number === 'Fase 5')) {
      return 'Electricidad';
    }

    // 8. Interiorismo
    if (titleLower.includes('interiorismo') || titleLower.includes('mueble') || titleLower.includes('decoracion') || titleLower.includes('textil') || (phase && (phase.phase_number === 'Fase 2.1' || phase.phase_number === 'Fase 6'))) {
      return 'Interiorismo';
    }

    // 9. Renders
    if (titleLower.includes('render') || titleLower.includes('imagen 3d') || titleLower.includes('vista 3d') || titleLower.includes('perspectiva') || (phase && phase.phase_number === 'Fase 7')) {
      return 'Renders';
    }

    // 10. Presupuestos
    if (doc.category === 'Presupuesto' || titleLower.includes('presupuesto') || titleLower.includes('partida') || titleLower.includes('mediciones') || (phase && phase.phase_number === 'Fase 8')) {
      return 'Presupuestos';
    }

    // 11. Obra
    if (doc.category === 'Acta' || titleLower.includes('obra') || titleLower.includes('acta') || titleLower.includes('visita') || titleLower.includes('seguimiento') || (phase && phase.phase_number === 'Fase 9')) {
      return 'Obra';
    }

    // 12. Entrega
    if (titleLower.includes('entrega') || titleLower.includes('garantia') || titleLower.includes('llave') || titleLower.includes('manual') || titleLower.includes('final') || (phase && phase.phase_number === 'Fase 10')) {
      return 'Entrega';
    }

    // Fallbacks
    if (phase) {
      if (phase.stage === 'project') return 'Distribución';
      if (phase.stage === 'construction') return 'Obra';
      if (phase.stage === 'handover') return 'Entrega';
    }

    return 'Contrato y documentación inicial';
  };

  // Clasificar y agrupar los documentos (los que coinciden con la búsqueda)
  const query = searchQuery.trim().toLowerCase();
  const searching = query !== "";
  const filteredDocs = documents.filter((doc) => doc.title.toLowerCase().includes(query));

  const groupedDocuments: Record<string, PortalDocument[]> = {};
  GROUPS.forEach((g) => {
    groupedDocuments[g] = [];
  });
  filteredDocs.forEach((doc) => {
    const grp = getDocumentGroup(doc);
    // Fallback a Contrato si fallase
    (groupedDocuments[grp] ?? groupedDocuments["Contrato y documentación inicial"]).push(doc);
  });
  GROUPS.forEach((g) => {
    groupedDocuments[g].sort((a, b) => (STATUS_RANK[a.status] ?? 2) - (STATUS_RANK[b.status] ?? 2));
  });

  const fullGroups = GROUPS.filter((g) => groupedDocuments[g].length > 0);
  const emptyGroups = GROUPS.filter((g) => groupedDocuments[g].length === 0);
  const currentGroup = openGroup && groupedDocuments[openGroup]?.length ? openGroup : fullGroups[0] ?? null;

  const recentDocs = documents
    .filter((d) => d.created_at && daysBetween(d.created_at.slice(0, 10), today) <= RECENT_DAYS)
    .slice(0, 3);
  const newest = [...documents].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const vigentes = documents.filter((d) => d.status === "Aprobado").length;

  // Huecos para cerrar la última fila de la rejilla (2 columnas en móvil, 3 desde sm)
  const fill2 = (2 - (fullGroups.length % 2)) % 2;
  const fill3 = (3 - (fullGroups.length % 3)) % 3;
  const fillers = Array.from({ length: Math.max(fill2, fill3) }, (_, i) => i);

  const plural = (n: number) => (n === 1 ? "documento" : "documentos");

  const openGroupAt = (group: string) => {
    setOpenGroup(group);
    // Si el grupo abierto queda fuera de la vista (móvil), se lleva hasta él sin animar
    requestAnimationFrame(() => {
      const el = document.getElementById(GROUP_PANEL_ID);
      if (el && el.getBoundingClientRect().top > window.innerHeight - 160) el.scrollIntoView({ block: "start" });
    });
  };

  const phaseLabel = (doc: PortalDocument) => {
    const phase = phases.find((p) => p.id === doc.phase_id);
    return phase ? `${phase.phase_number} · ${phase.name}` : "Diseño general";
  };

  const docList = (docs: PortalDocument[]) => (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {docs.map((doc) => {
        const old = doc.status === "Obsoleto";
        const busy = loadingDocId === doc.id;
        const tech = [versionLabel(doc.version), shortDate(doc.created_at)].filter(Boolean).join(" · ");
        const caption = [phaseLabel(doc), [formatLabel(doc.mime_type), formatBytes(doc.file_size)].filter(Boolean).join("\u00a0")]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={doc.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 px-4 pb-4 pt-3.5 sm:px-5">
            <p className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1">
              <span className="cell-k mr-1">{doc.category}</span>
              <StatusBadge kind="documento" status={doc.status} />
            </p>
            <p
              className={`col-span-2 mt-2 break-words text-base leading-[1.3] sm:col-span-1 ${
                old ? "font-medium text-ink-mute" : "font-semibold text-ink"
              }`}
            >
              {old ? <s className="decoration-1">{doc.title}</s> : doc.title}
            </p>
            <div className="mt-1.5 min-w-0 space-y-0.5">
              {tech && <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-mute tabular-nums">{tech}</p>}
              <p className="text-xs font-medium text-ink-mute">{caption}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDownload(doc)}
              disabled={loadingDocId !== null}
              className={`${BTN_SECONDARY} sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:self-center`}
            >
              {busy ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              {busy ? "Preparando…" : "Descargar"}
              <span className="sr-only">
                {" "}
                {doc.title}
                {doc.version ? `, ${versionLabel(doc.version)}` : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-12">
      {/* Cabecera y búsqueda */}
      <header className="space-y-3">
        <Link
          href={`/dashboard/projects/${projectId}/mas`}
          className="-ml-1.5 -mt-2 flex min-h-11 w-fit items-center gap-1 pr-2 text-sm font-semibold text-ink lg:hidden"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Más
        </Link>
        <Eyebrow>{projectName}</Eyebrow>
        <h1 className="display-portal text-ink">Documentos</h1>
        <p className="max-w-[60ch] text-[15px] leading-[1.6] text-ink-soft">
          Todo el expediente de tu casa, ordenado por temas: planos, contratos, licencias y presupuestos. De cada tema te
          enseñamos primero lo que está vigente.
        </p>
        {documents.length > 0 && (
          <div className="space-y-6 pt-3">
            <Cells
              items={[
                { k: "Documentos", v: documents.length },
                { k: "Vigentes", v: vigentes },
                { k: "Último", v: newest ? shortDate(newest.created_at) : "—" },
              ]}
            />
            <form role="search" className="relative max-w-xl" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="doc-q" className="sr-only">
                Buscar en tus documentos
              </label>
              <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-ink-mute" aria-hidden />
              <input
                id="doc-q"
                type="search"
                autoComplete="off"
                placeholder="Buscar por nombre"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block h-12 w-full rounded-md border-[1.5px] border-control-line bg-white pl-11 pr-3.5 text-base text-ink transition-colors placeholder:text-ink-mute hover:border-jet"
              />
            </form>
          </div>
        )}
      </header>

      {documents.length === 0 ? (
        <Notice tone="default" title="Aún no hay documentos" icon={<FolderOpen aria-hidden />}>
          El estudio irá subiendo aquí los planos, contratos, licencias y presupuestos de tu obra.
        </Notice>
      ) : searching ? (
        /* Resultados de la búsqueda, por grupos (solo los que tienen coincidencias) */
        <section aria-labelledby="doc-res" className="space-y-6">
          <SecHead
            id="doc-res"
            title="Resultados"
            action={
              <span className="text-xs font-semibold text-ink-mute tabular-nums" aria-live="polite">
                {filteredDocs.length} {plural(filteredDocs.length)}
              </span>
            }
          />
          {filteredDocs.length === 0 ? (
            <Notice tone="default" title="Sin resultados">
              No hay documentos cuyo nombre contenga «{searchQuery.trim()}».
            </Notice>
          ) : (
            fullGroups.map((group) => (
              <div key={group} className="space-y-2.5">
                <Eyebrow bare>{group}</Eyebrow>
                {docList(groupedDocuments[group])}
              </div>
            ))
          )}
        </section>
      ) : (
        <>
          {/* Lo último */}
          {recentDocs.length > 0 && (
            <section aria-labelledby="doc-ult" className="space-y-4">
              <SecHead
                id="doc-ult"
                title="Lo último"
                action={<span className="text-xs font-semibold text-ink-mute">Últimos {RECENT_DAYS} días</span>}
              />
              {docList(recentDocs)}
            </section>
          )}

          {/* Índice en rejilla: los grupos con su recuento */}
          <section aria-labelledby="doc-idx" className="space-y-4">
            <SecHead
              id="doc-idx"
              title="Índice"
              action={
                <span className="text-xs font-semibold text-ink-mute tabular-nums">
                  {fullGroups.length} {fullGroups.length === 1 ? "tema" : "temas"}
                </span>
              }
            />
            <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
              {fullGroups.map((group) => {
                const n = groupedDocuments[group].length;
                const active = group === currentGroup;
                return (
                  <li key={group} className="flex">
                    <button
                      type="button"
                      aria-expanded={active}
                      aria-controls={GROUP_PANEL_ID}
                      onClick={() => openGroupAt(group)}
                      className={`relative flex min-h-[88px] flex-1 flex-col px-3.5 py-3 text-left transition-colors duration-[140ms] focus-visible:shadow-[inset_0_0_0_3px_var(--ring)] ${
                        active ? "bg-jet text-whitesmoke" : "bg-card text-ink hover:bg-zinc-50"
                      }`}
                    >
                      <span className="line-clamp-3 text-[15px] font-semibold leading-[1.3]">{group}</span>
                      <span className="mt-auto flex items-baseline gap-1.5 pt-2">
                        <span className="text-[32px] font-light leading-none tracking-[-0.01em] tabular-nums">{n}</span>
                        <span className={`text-xs font-medium ${active ? "text-zinc-300" : "text-ink-mute"}`}>{plural(n)}</span>
                        {active && <ChevronDown className="ml-auto size-4 self-center" aria-hidden />}
                      </span>
                    </button>
                  </li>
                );
              })}
              {fillers.map((i) => (
                <li
                  key={`hueco-${i}`}
                  aria-hidden
                  className={`bg-card ${i < fill2 ? "block" : "hidden"} ${i < fill3 ? "sm:block" : "sm:hidden"}`}
                />
              ))}
            </ul>
            {emptyGroups.length > 0 && (
              <p className="text-sm leading-[1.6] text-ink-soft">
                <span className="font-semibold text-ink">Sin documentos todavía:</span> {emptyGroups.join(" · ")}
              </p>
            )}
          </section>

          {/* El grupo abierto */}
          {currentGroup && (
            <section id={GROUP_PANEL_ID} aria-labelledby="doc-grupo-t" className="scroll-mt-24 space-y-4">
              <SecHead
                id="doc-grupo-t"
                title={currentGroup}
                action={
                  <span className="text-xs font-semibold text-ink-mute tabular-nums">
                    {groupedDocuments[currentGroup].length} {plural(groupedDocuments[currentGroup].length)}
                  </span>
                }
              />
              {docList(groupedDocuments[currentGroup])}
              {groupedDocuments[currentGroup].some((d) => d.status === "Obsoleto") && (
                <Notice tone="default" title="Versiones sustituidas">
                  Guardamos las versiones sustituidas para que veas cómo ha cambiado tu proyecto. La que vale es siempre la
                  vigente.
                </Notice>
              )}
            </section>
          )}
        </>
      )}

      {/* Toast Notification flotante */}
      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
