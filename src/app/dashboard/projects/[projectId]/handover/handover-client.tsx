"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown, BookOpen, ChevronLeft, ChevronRight, Clock, Download, FileText, Folder,
  Image as ImageIcon, Key, Mail, Phone, RefreshCw, ShieldCheck, X,
} from "lucide-react";
import { PhotoImage } from "@/components/photo-image";
import { Cells, Eyebrow, Notice, SecHead, StateBadge, StatusBadge } from "@/components/portal-ui";
import { useToast, ToastViewport } from "@/components/toast";
import { getPhaseState } from "@/lib/phase-status";
import { CLOSING_WEEK_NUMBER } from "@/lib/week-label";
import { formatDateEs } from "@/lib/format-date-es";
import type { PortalDocument, PortalPhase, PortalPhoto, PortalProject, PortalWeeklyUpdate } from "@/types/portal";
import { getSignedDocumentUrlAction } from "../../../actions";

/**
 * Entrega (fase 2): el día de las llaves. Portada con la foto final (o una banda Jet si
 * aún no hay), el mensaje del estudio, un índice de lo que se entrega, la posventa en un
 * panel Jet y, debajo, cada apartado. Todo sale del modelo: nada de garantías, manuales
 * ni fechas inventadas. El único Saffron es la palabra «casa» del titular, sobre Jet.
 * Pantalla tranquila: sin coreografía de entrada.
 */

interface HandoverClientProps {
  project: PortalProject;
  phases: PortalPhase[];
  documents: PortalDocument[];
  photos: PortalPhoto[];
  weeklyUpdates?: PortalWeeklyUpdate[];
}

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

function formatLabel(mime: string | null | undefined): string {
  const sub = (mime || "").split("/")[1] || "";
  return sub && sub.length <= 4 ? sub.toUpperCase() : "";
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function shortDate(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return "";
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

function versionLabel(version: string | null | undefined): string {
  const v = (version || "").trim();
  if (!v) return "";
  return /^v/i.test(v) ? v : `v${v}`;
}

export function HandoverClient({
  project,
  phases,
  documents,
  photos,
  weeklyUpdates = [],
}: HandoverClientProps) {
  const [lightboxPhoto, setLightboxPhoto] = useState<PortalPhoto | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();

  // El visor se cierra con Escape
  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxPhoto(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPhoto]);

  // La entrega se activa solo cuando el proyecto llega de verdad a esa etapa
  const isHandoverActive = project.current_stage === "handover" || project.status === "Finalizado";

  // Manejador de descargas seguras mediante firmado de URL on-demand
  const handleDownload = async (doc: PortalDocument) => {
    setLoadingDocId(doc.id);
    try {
      const signedUrl = await getSignedDocumentUrlAction(doc.storage_path);
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

  // ------------------------------------------------------------------
  // Todo se deriva del modelo: nada de garantías, manuales, consejos ni
  // fechas inventadas. El parte de Cierre de obra (week_number 999) aporta
  // warranty_info / recommendations; el resto son documentos y fotos reales.
  // ------------------------------------------------------------------

  const closingUpdate = weeklyUpdates.find((w) => w.week_number === CLOSING_WEEK_NUMBER) || null;
  const warrantyInfo: string | null = closingUpdate?.warranty_info || null;
  const recommendations: string | null = closingUpdate?.recommendations || null;

  // Fecha de entrega derivada: end_date de la última fase de etapa entrega
  // completada; en su defecto, la fecha del parte de Cierre. Si no puede
  // derivarse, se dice honestamente «Entrega en preparación».
  const deliveryDate: string | null = (() => {
    const handoverPhases = phases
      .filter((p) => p.stage === "handover" && getPhaseState(p.status) === "complete" && p.end_date)
      .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)));
    if (handoverPhases[0]?.end_date) return handoverPhases[0].end_date;
    if (closingUpdate?.created_at) return closingUpdate.created_at;
    return null;
  })();
  // «Ya estás en casa» solo si la entrega consta (obra finalizada o fecha derivable)
  const delivered = project.status === "Finalizado" || !!deliveryDate;

  // Expediente final: documentos de entrega del proyecto
  const finalDocs = documents.filter(d =>
    d.title.toLowerCase().includes("entrega") ||
    d.title.toLowerCase().includes("as-built") ||
    d.title.toLowerCase().includes("final de obra") ||
    d.title.toLowerCase().includes("llaves")
  );

  // Reportaje final: fotos de la fase de entrega
  const finalPhotos = photos.filter(ph => ph.phase_id === phases.find(p => p.stage === "handover")?.id);
  const coverPhoto = finalPhotos[0] ?? null;

  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  // Índice de lo que se entrega: «Garantías» y «Mantenimiento» solo si el parte de
  // Cierre trae contenido real.
  const indexCells = [
    { href: "#entrega-expediente", icon: Folder, title: "Expediente final", meta: plural(finalDocs.length, "documento", "documentos") },
    warrantyInfo ? { href: "#entrega-garantias", icon: ShieldCheck, title: "Garantías", meta: "Plazos y coberturas" } : null,
    recommendations ? { href: "#entrega-mantenimiento", icon: BookOpen, title: "Mantenimiento", meta: "Cómo cuidar tu casa" } : null,
    { href: "#entrega-fotos", icon: ImageIcon, title: "Fotos finales", meta: plural(finalPhotos.length, "foto", "fotos") },
  ].filter(Boolean) as Array<{ href: string; icon: typeof Folder; title: string; meta: string }>;

  const backLink = (
    <Link
      href={`/dashboard/projects/${project.id}/mas`}
      className="-ml-1.5 -mt-2 flex min-h-11 w-fit items-center gap-1 pr-2 text-sm font-semibold text-ink lg:hidden"
    >
      <ChevronLeft className="size-5" aria-hidden />
      Más
    </Link>
  );

  // ====================================================================
  // ESCENARIO A: EL PROYECTO AÚN NO ESTÁ EN FASE DE ENTREGA
  // ====================================================================
  if (!isHandoverActive) {
    const proximos = [
      { icon: Folder, title: "Expediente final", meta: "Acta de entrega, certificado final de obra y planos as-built" },
      { icon: ShieldCheck, title: "Garantías", meta: "Plazos y coberturas de tu vivienda" },
      { icon: BookOpen, title: "Mantenimiento", meta: "Cómo cuidar cada acabado" },
      { icon: ImageIcon, title: "Fotos finales", meta: "El reportaje de tu casa terminada" },
    ];
    return (
      <div className="space-y-12">
        <header className="space-y-3">
          {backLink}
          <Eyebrow>{project.name}</Eyebrow>
          <h1 className="display-portal text-ink">Entrega</h1>
          <p className="max-w-[60ch] text-[15px] leading-[1.6] text-ink-soft">
            El hito final: el acta de entrega de llaves, el expediente con los planos as-built, las garantías y cómo cuidar tu
            casa.
          </p>
        </header>

        <section aria-labelledby="entrega-pronto" className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100 text-ink-soft">
              <Key className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-2">
              <h2 id="entrega-pronto" className="text-xl leading-[1.15] tracking-[0.02em] text-ink">
                Se abre con la entrega de llaves
              </h2>
              <p className="text-sm leading-[1.6] text-ink-soft">
                Ahora estamos con el avance de tu obra. Cuando terminemos los acabados y la limpieza final, abriremos aquí la
                entrega: podrás descargar las garantías, los manuales y los planos as-built definitivos.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {proximos.map((p) => (
              <li key={p.title} className="grid min-h-16 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 py-3">
                <p.icon className="size-5 text-ink-mute" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug text-ink">{p.title}</span>
                  <span className="block text-xs font-medium text-ink-mute">{p.meta}</span>
                </span>
                <StateBadge tone="quiet">Por llegar</StateBadge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  // ====================================================================
  // ESCENARIO B: EL PROYECTO YA ESTÁ EN FASE DE ENTREGA
  // ====================================================================
  return (
    <div className="space-y-12">
      {/* Portada: la foto final con velo Jet, o una banda Jet si aún no hay foto */}
      <div className="space-y-3">
        {backLink}
        <section
          aria-labelledby="entrega-titulo"
          className={`relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-xl ${coverPhoto ? "" : "dark bg-jet"}`}
        >
          {coverPhoto && (
            <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
              <PhotoImage
                photo={coverPhoto}
                mode="detail"
                fill
                className="object-cover"
                tag={coverPhoto.room ? `Foto final · ${coverPhoto.room}` : "Foto final"}
              />
              <span
                aria-hidden
                className="absolute inset-0 z-20 bg-[linear-gradient(to_top,rgba(51,53,51,0.7)_0,rgba(51,53,51,0.7)_48%,transparent_82%)]"
              />
            </div>
          )}
          <div
            className={
              coverPhoto
                ? "absolute inset-x-0 bottom-0 z-40 space-y-3.5 px-4 pb-6 sm:px-8 sm:pb-8"
                : "space-y-3.5 px-5 py-9 sm:px-8 sm:py-12"
            }
          >
            <Eyebrow className="text-whitesmoke before:opacity-70">
              {delivered
                ? deliveryDate
                  ? `Entrega · ${formatDateEs(deliveryDate)}`
                  : "Entrega"
                : "Entrega en preparación"}
            </Eyebrow>
            <h1 id="entrega-titulo" className="display-portal max-w-[16ch] text-whitesmoke [text-wrap:balance]">
              {delivered ? "Ya estás en " : "Preparamos la entrega de tu "}
              <span className="text-saffron">casa</span>
            </h1>
            <p className="text-sm font-medium leading-normal text-whitesmoke/85">
              {[project.name, project.address].filter(Boolean).join(" · ")}
            </p>
          </div>
        </section>
      </div>

      {/* Mensaje del estudio y cuadro de la entrega */}
      <section aria-label="Mensaje del estudio" className="space-y-6">
        <div className="max-w-[60ch] space-y-3">
          <p className="text-[17px] leading-[1.6] text-ink">
            Aquí queda, ordenado, todo lo de tu casa: los papeles, las garantías y cómo cuidarla. Gracias por confiar en
            nosotros; seguimos aquí para lo que necesites.
          </p>
          <p className="text-sm font-semibold text-ink-soft">Estudio Despeja la X</p>
        </div>
        <Cells
          items={[
            { k: "Entrega", v: deliveryDate ? shortDate(deliveryDate) : "En preparación" },
            { k: "Documentos", v: finalDocs.length },
            { k: "Fotos finales", v: finalPhotos.length },
          ]}
        />
      </section>

      {/* Índice de lo que se entrega */}
      <nav aria-labelledby="entrega-indice" className="space-y-3.5">
        <Eyebrow>
          <span id="entrega-indice">Lo que te entregamos</span>
        </Eyebrow>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
          {indexCells.map((c, i) => (
            <li
              key={c.href}
              className={`flex ${i === indexCells.length - 1 && indexCells.length % 2 === 1 ? "col-span-2 sm:col-span-1" : ""}`}
            >
              <a
                href={c.href}
                className="flex min-h-[124px] flex-1 flex-col bg-card p-3.5 text-ink transition-colors duration-[140ms] hover:bg-zinc-50 focus-visible:shadow-[inset_0_0_0_3px_var(--ring)]"
              >
                <span className="flex items-center justify-between">
                  <c.icon className="size-5" aria-hidden />
                  <ArrowDown className="size-4 text-ink-mute" aria-hidden />
                </span>
                <span className="mt-3.5 text-base font-semibold leading-[1.3]">{c.title}</span>
                <span className="mt-auto pt-1 text-sm leading-[1.45] text-ink-soft">{c.meta}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Posventa: panel Jet */}
      <aside aria-labelledby="entrega-posventa" className="dark rounded-xl bg-jet px-5 pb-2 pt-6 text-whitesmoke sm:px-7">
        <h2 id="entrega-posventa" className="text-xl leading-[1.15] tracking-[0.02em]">
          Posventa
        </h2>
        <p className="mt-2 max-w-[60ch] text-sm leading-[1.6] text-zinc-300">
          Empieza la garantía. Durante el primer año tienes un servicio posventa prioritario: si algo no funciona como debe
          (una bisagra que se descuelga, la presión del agua, un mecanismo o un repaso), cuéntanoslo y organizamos una visita
          de repaso con la constructora.
        </p>
        <ul className="mt-4 divide-y divide-white/15 border-t border-white/15">
          <li>
            <a href="mailto:postventa@despejalax.es" className="grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 py-3">
              <span className="grid size-11 place-items-center rounded-md bg-whitesmoke text-jet">
                <Mail className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="cell-k block">Correo</span>
                <span className="mt-1 block break-all text-base font-semibold leading-snug">postventa@despejalax.es</span>
              </span>
              <ChevronRight className="size-4 text-zinc-300" aria-hidden />
            </a>
          </li>
          <li>
            <a href="tel:+34960999888" className="grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 py-3">
              <span className="grid size-11 place-items-center rounded-md bg-whitesmoke text-jet">
                <Phone className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="cell-k block">Teléfono</span>
                <span className="mt-1 block text-base font-semibold leading-snug tabular-nums">+34 960 999 888</span>
              </span>
              <ChevronRight className="size-4 text-zinc-300" aria-hidden />
            </a>
          </li>
          <li className="grid min-h-[68px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 py-3">
            <span className="grid size-11 place-items-center rounded-md bg-whitesmoke text-jet">
              <Clock className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="cell-k block">Horario</span>
              <span className="mt-1 block text-base font-semibold leading-snug">L–V, de 9:00 a 14:00</span>
              <span className="mt-0.5 block text-sm leading-[1.45] text-zinc-300">
                Atendemos las incidencias en un plazo estimado de menos de 48 h laborables.
              </span>
            </span>
            <span />
          </li>
        </ul>
      </aside>

      {/* Expediente final y manuales */}
      <section id="entrega-expediente" aria-labelledby="entrega-expediente-t" className="scroll-mt-24 space-y-4">
        <SecHead
          id="entrega-expediente-t"
          title="Expediente final"
          action={<span className="text-xs font-semibold text-ink-mute tabular-nums">{plural(finalDocs.length, "documento", "documentos")}</span>}
        />
        {finalDocs.length === 0 ? (
          <Notice tone="default" title="En preparación" icon={<FileText aria-hidden />}>
            El estudio incluirá aquí el expediente final de tu vivienda (acta de entrega, certificado final de obra, planos
            as-built) en la entrega.
          </Notice>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {finalDocs.map((doc) => {
              const busy = loadingDocId === doc.id;
              const tech = [versionLabel(doc.version), shortDate(doc.created_at)].filter(Boolean).join(" · ");
              const size = [formatLabel(doc.mime_type), formatBytes(doc.file_size)].filter(Boolean).join("\u00a0");
              return (
                <li key={doc.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 px-4 pb-4 pt-3.5 sm:px-5">
                  <p className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1">
                    <span className="cell-k mr-1">{doc.category}</span>
                    <StatusBadge kind="documento" status={doc.status} />
                  </p>
                  <p className="col-span-2 mt-2 break-words text-base font-semibold leading-[1.3] text-ink sm:col-span-1">{doc.title}</p>
                  <div className="mt-1.5 min-w-0 space-y-0.5">
                    {tech && <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-mute tabular-nums">{tech}</p>}
                    {size && <p className="text-xs font-medium text-ink-mute">{size}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    disabled={loadingDocId !== null}
                    className={`${BTN_SECONDARY} sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:self-center`}
                  >
                    {busy ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                    {busy ? "Preparando…" : "Descargar"}
                    <span className="sr-only"> {doc.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Notice tone="default" title="Manuales de uso" icon={<BookOpen aria-hidden />}>
          El estudio incluirá aquí los manuales de uso de tu vivienda en la entrega.
        </Notice>
      </section>

      {/* Garantías (solo si el parte de Cierre trae contenido) */}
      {warrantyInfo && (
        <section id="entrega-garantias" aria-labelledby="entrega-garantias-t" className="scroll-mt-24 space-y-4">
          <SecHead id="entrega-garantias-t" title="Garantías" />
          <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <p className="whitespace-pre-line text-[15px] leading-[1.6] text-ink">{warrantyInfo}</p>
          </div>
          <Notice tone="default" title="Sobre las coberturas" icon={<ShieldCheck aria-hidden />}>
            Los plazos cuentan desde la firma del acta de recepción definitiva de la obra. Las garantías de cada fabricante se
            gestionan con su servicio técnico; aun así, el estudio te acompaña y hace de mediador durante todo el primer año.
          </Notice>
        </section>
      )}

      {/* Mantenimiento (solo con contenido real) */}
      {recommendations && (
        <section id="entrega-mantenimiento" aria-labelledby="entrega-mantenimiento-t" className="scroll-mt-24 space-y-4">
          <SecHead id="entrega-mantenimiento-t" title="Mantenimiento" />
          <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <p className="whitespace-pre-line text-[15px] leading-[1.6] text-ink">{recommendations}</p>
          </div>
        </section>
      )}

      {/* Fotos finales */}
      <section id="entrega-fotos" aria-labelledby="entrega-fotos-t" className="scroll-mt-24 space-y-4">
        <SecHead
          id="entrega-fotos-t"
          title="Fotos finales"
          action={<span className="text-xs font-semibold text-ink-mute tabular-nums">{plural(finalPhotos.length, "foto", "fotos")}</span>}
        />
        {finalPhotos.length === 0 ? (
          <Notice tone="default" title="En edición" icon={<ImageIcon aria-hidden />}>
            El reportaje fotográfico definitivo está en proceso de edición.
          </Notice>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {finalPhotos.map((photo) => {
              const pie = [photo.room, "Entrega"].filter(Boolean).join(" · ");
              return (
                <li key={photo.id} className="min-w-0 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setLightboxPhoto(photo)}
                    aria-label={`Ampliar la foto: ${photo.caption || pie}`}
                    className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-zinc-100"
                  >
                    <PhotoImage photo={photo} mode="gallery" fill className="object-cover" />
                  </button>
                  <p className="truncate text-xs font-medium text-ink-mute">{pie}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Visor de fotos */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[100] flex animate-dlx-fade items-center justify-center bg-jet/90 p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={lightboxPhoto.caption || lightboxPhoto.room || "Foto final"}
            className="dark relative flex w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-zinc-900 text-whitesmoke"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              autoFocus
              onClick={() => setLightboxPhoto(null)}
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-40 grid size-11 place-items-center rounded-full bg-jet/80 text-whitesmoke hover:bg-jet"
            >
              <X className="size-5" aria-hidden />
            </button>
            <div className="relative h-[50vh] w-full bg-black sm:h-[65vh]">
              <PhotoImage photo={lightboxPhoto} mode="detail" fill className="object-contain" tag="Foto final" />
            </div>
            <div className="space-y-1 px-5 py-4">
              {lightboxPhoto.room && <p className="cell-k">{lightboxPhoto.room}</p>}
              {lightboxPhoto.caption && <p className="text-sm leading-[1.55]">{lightboxPhoto.caption}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification flotante */}
      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
