"use client";

import React, { useState } from "react";
import {
  Key, FileText, Download, ShieldCheck,
  BookOpen, Sparkles, PhoneCall,
  ZoomIn, X, Clock, Mail, Info, RefreshCw,
  AlertCircle, Home
} from "lucide-react";
import { Profile } from "@/lib/firebase/profile";
import { Card } from "@/components/ui/card";
import { PhotoImage } from "@/components/photo-image";
import { getSignedDocumentUrlAction } from "../../../actions";
import { useToast, ToastViewport } from "@/components/toast";
import { getPhaseState } from "@/lib/phase-status";
import { CLOSING_WEEK_NUMBER } from "@/lib/week-label";
import { formatDateEs } from "@/lib/format-date-es";

interface HandoverClientProps {
  project: any;
  phases: any[];
  documents: any[];
  photos: any[];
  weeklyUpdates?: any[];
  profile: Profile;
}

export function HandoverClient({
  project,
  phases,
  documents,
  photos,
  weeklyUpdates = [],
  profile,
}: HandoverClientProps) {
  void profile;
  const [activeSubTab, setActiveSubTab] = useState<"documentos" | "garantias" | "mantenimiento" | "fotos">("documentos");
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();

  // Formateador de bytes
  const formatBytes = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // La entrega se activa solo cuando el proyecto llega de verdad a esa etapa
  const isHandoverActive = project.current_stage === "handover" || project.status === "Finalizado";

  // Manejador de descargas seguras mediante firmado de URL on-demand
  const handleDownload = async (doc: any) => {
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

  // Expediente final: documentos de entrega del proyecto
  const finalDocs = documents.filter(d =>
    d.title.toLowerCase().includes("entrega") ||
    d.title.toLowerCase().includes("as-built") ||
    d.title.toLowerCase().includes("final de obra") ||
    d.title.toLowerCase().includes("llaves")
  );

  // Reportaje final: fotos de la fase de entrega
  const finalPhotos = photos.filter(ph => ph.phase_id === phases.find(p => p.stage === "handover")?.id);

  // Sub-pestañas: «Garantías» y «Mantenimiento» solo existen si el parte de
  // Cierre trae contenido real.
  const subTabs = [
    { id: "documentos", label: "EXPEDIENTE FINAL Y MANUALES", icon: FileText, visible: true },
    { id: "garantias", label: "GARANTÍAS OFICIALES", icon: ShieldCheck, visible: !!warrantyInfo },
    { id: "mantenimiento", label: "RECOMENDACIONES DE MANTENIMIENTO", icon: BookOpen, visible: !!recommendations },
    { id: "fotos", label: "FOTOGRAFÍAS FINALES", icon: Home, visible: true },
  ].filter(t => t.visible);
  const currentSubTab = subTabs.some(t => t.id === activeSubTab) ? activeSubTab : "documentos";

  return (
    <div className="space-y-8">

      {/* Cabecera y Introducción */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em]">
          <Key className="h-3.5 w-3.5 text-amber-500" />
          <span>Llaves y Documentación Final</span>
        </div>
        <h1 className="text-3xl font-light tracking-tight text-zinc-900 dark:text-white leading-tight">
          Entrega
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-light max-w-xl">
          El hito final. Aquí recopilamos el acta de entrega formal de llaves, el expediente de planos as-built definitivos, las garantías oficiales del equipamiento y manuales de mantenimiento preventivo.
        </p>
      </div>

      {/* ====================================================================
          ESCENARIO A: EL PROYECTO AÚN NO ESTÁ EN FASE DE ENTREGA
          ==================================================================== */}
      {!isHandoverActive ? (
        <div className="animate-in fade-in duration-500 pt-6">
          <Card className="border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 p-12 rounded-3xl text-center space-y-6 max-w-2xl mx-auto shadow-sm backdrop-blur-md">
            <div className="h-16 w-16 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Key className="h-8 w-8 animate-pulse-slow" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                Esta sección se activará cuando lleguemos a la entrega final de tu hogar.
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto font-light font-sans">
                Actualmente estamos concentrados en el avance técnico de la obra. Cuando completemos los acabados generales y las limpiezas de obra, activaremos este portal donde podrás descargar las garantías oficiales, manuales y planos As-Built definitivos.
              </p>
            </div>
          </Card>
        </div>
      ) : (
        // ====================================================================
        // ESCENARIO B: EL PROYECTO YA ESTÁ EN FASE DE ENTREGA
        // ====================================================================
        <div className="space-y-8 animate-in fade-in duration-500">

          {/* HERO DE ENHORABUENA */}
          <Card className="border border-zinc-200/50 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/60 p-6 md:p-8 rounded-3xl backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="space-y-3 max-w-xl">
              <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 uppercase tracking-widest font-bold block flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> ¡BIENVENIDOS A VUESTRO NUEVO HOGAR!
              </span>
              <h2 className="text-2xl md:text-3xl font-heading font-light text-zinc-900 dark:text-white leading-tight">
                Enhorabuena, tu proyecto ha finalizado
              </h2>
              <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed font-light font-sans">
                Ha sido un viaje increíble transformar esta idea sobre el papel en vuestro hogar. Queremos agradeceros vuestra total confianza en el equipo de <strong className="font-semibold">Despeja la X</strong>. Disfrutad de cada rincón de este nuevo espacio creado para vosotros.
              </p>
            </div>
            <div className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 p-4 rounded-2xl text-center shrink-0 min-w-[150px] font-heading shadow-md border border-white/10 flex flex-col items-center justify-center">
              <Key className="h-8 w-8 text-amber-500 mb-1" />
              <span className="text-[9px] font-mono tracking-wider block opacity-70">ENTREGA OFICIAL</span>
              <span className="text-xs font-mono font-bold block mt-1 px-1">
                {deliveryDate ? formatDateEs(deliveryDate) : "Entrega en preparación"}
              </span>
            </div>
          </Card>

          {/* CONTROL DE PESTAÑAS DETALLADAS */}
          <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-none border-b border-zinc-200 dark:border-zinc-800 font-mono text-[10px]">
            {subTabs.map(subTab => {
              const Icon = subTab.icon;
              const isSubActive = currentSubTab === subTab.id;
              return (
                <button
                  key={subTab.id}
                  onClick={() => setActiveSubTab(subTab.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-all shrink-0 uppercase font-semibold ${
                    isSubActive
                      ? "border-amber-500 text-zinc-900 dark:text-white"
                      : "border-transparent text-zinc-600 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-350"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {subTab.label}
                </button>
              );
            })}
          </div>

          {/* PESTAÑA 1: EXPEDIENTE Y DOCUMENTACIÓN */}
          {currentSubTab === "documentos" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Documentación Final del Proyecto ({finalDocs.length})</span>
                {finalDocs.length === 0 ? (
                  <Card className="border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 p-8 text-center text-xs text-zinc-600 dark:text-zinc-400 font-light rounded-3xl">
                    El estudio incluirá aquí el expediente final de tu vivienda (acta de entrega, certificado final de obra, planos as-built) en la entrega.
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {finalDocs.map((doc: any) => (
                      <Card key={doc.id} className="border border-zinc-200/50 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/60 p-4 shadow-2xs hover:shadow-xs flex flex-col justify-between gap-3 rounded-2xl">
                        <div className="flex items-start space-x-3 text-xs">
                          <div className="h-9 w-9 rounded-xl bg-zinc-500/5 dark:bg-zinc-500/10 border border-zinc-500/15 flex items-center justify-center shrink-0">
                            <FileText className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-500" />
                          </div>
                          <div className="overflow-hidden">
                            <span className="text-[10px] font-mono bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-0.5 rounded uppercase tracking-wider font-bold">
                              {doc.category}
                            </span>
                            <h4 className="font-bold text-zinc-850 dark:text-zinc-200 truncate mt-1.5" title={doc.title}>{doc.title}</h4>
                            <span className="text-[9px] text-zinc-600 dark:text-zinc-400 font-mono block mt-0.5">Versión {doc.version} • Registrado el {formatDateEs(doc.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[9px] font-mono border-t border-zinc-150/40 dark:border-zinc-800/40 pt-2.5">
                          <span className="text-zinc-600 dark:text-zinc-400">{formatBytes(doc.file_size)}</span>
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={loadingDocId !== null}
                            className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 hover:text-amber-500 font-bold transition-colors"
                          >
                            {loadingDocId === doc.id ? (
                              <><RefreshCw className="h-3 w-3 animate-spin" /> Preparando descarga…</>
                            ) : (
                              <>Descargar <Download className="h-3 w-3" /></>
                            )}
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-150/40 dark:border-zinc-800/40">
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Manuales de Uso e Instrucciones</span>
                <Card className="border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 p-8 text-center text-xs text-zinc-600 dark:text-zinc-400 font-light rounded-3xl">
                  El estudio incluirá aquí los manuales de uso de tu vivienda en la entrega.
                </Card>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: GARANTÍAS (solo si el parte de Cierre trae contenido) */}
          {currentSubTab === "garantias" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Garantías de tu vivienda</span>
              <Card className="border border-zinc-200/60 bg-white/70 dark:border-zinc-850 dark:bg-zinc-900/60 p-6 rounded-3xl shadow-2xs">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-light leading-relaxed whitespace-pre-line">
                  {warrantyInfo}
                </p>
              </Card>

              {/* NOTA DE COBERTURA */}
              <Card className="border border-zinc-200/50 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/60 p-5 rounded-3xl backdrop-blur-md flex items-start space-x-3 text-xs leading-relaxed">
                <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Nota aclaratoria sobre coberturas</span>
                  <p className="text-zinc-650 dark:text-zinc-400 font-light font-sans">
                    Los plazos indicados comienzan a regir a partir de la firma del Acta de Recepción definitiva de la obra. Las garantías del fabricante se rigen bajo los canales de SAT de cada marca independiente; no obstante, el estudio DLX prestará mediación y soporte durante todo el primer año.
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* PESTAÑA 3: RECOMENDACIONES DE MANTENIMIENTO (solo con contenido real) */}
          {currentSubTab === "mantenimiento" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Guía de Cuidado Preventivo para los Materiales de tu Hogar</span>
              <Card className="border border-zinc-200/60 bg-white/70 dark:border-zinc-850 dark:bg-zinc-900/60 p-6 rounded-3xl shadow-2xs">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-light leading-relaxed whitespace-pre-line">
                  {recommendations}
                </p>
              </Card>
            </div>
          )}

          {/* PESTAÑA 4: FOTOGRAFÍAS FINALES */}
          {currentSubTab === "fotos" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em] block font-bold">Reportaje de Fin de Obra ({finalPhotos.length})</span>

              {finalPhotos.length === 0 ? (
                <Card className="border border-zinc-200 bg-white/50 p-12 text-center text-zinc-600 dark:text-zinc-450 font-mono text-xs rounded-3xl">
                  <AlertCircle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                  El reportaje fotográfico definitivo está en proceso de edición.
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {finalPhotos.map((photo: any) => (
                    <div
                      key={photo.id}
                      onClick={() => setLightboxPhoto(photo)}
                      className="group relative h-48 rounded-2xl overflow-hidden border border-zinc-200/50 dark:border-zinc-800/60 cursor-pointer shadow-2xs bg-zinc-100 dark:bg-zinc-950 transition-all duration-300 hover:scale-[1.01]"
                    >
                      <PhotoImage
                        photo={photo}
                        mode="gallery"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-[10px] text-white font-mono flex flex-col gap-0.5">
                        <span className="font-bold text-xs">{photo.room} · Entrega</span>
                        <span className="font-light opacity-80 truncate text-[9px]">{photo.caption}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN DE CONTACTO POST-ENTREGA */}
          <Card className="p-6 md:p-8 rounded-3xl border border-zinc-200/50 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/60 shadow-sm backdrop-blur-md space-y-6">
            <div className="flex items-center space-x-2 border-b border-zinc-150/40 dark:border-zinc-800/40 pb-4">
              <PhoneCall className="h-4.5 w-4.5 text-amber-500" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 font-bold">Contacto post-entrega y posventa</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-8 space-y-4">
                <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed font-sans font-light">
                  Iniciamos la fase de garantía. Para asegurar que todo funciona exactamente como se ha diseñado, cuentas con un <strong className="font-semibold">Servicio Post-Venta Prioritario</strong> a tu entera disposición durante el primer año natural de vida del inmueble.
                </p>
                <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed font-sans font-light">
                  Si surge cualquier desajuste menor (desajuste de bisagras por asentamiento térmico, presiones de agua, mecanismos o repasos), puedes notificárnoslo directamente y organizaremos una visita técnica de repaso en obra con la constructora.
                </p>
              </div>

              <div className="md:col-span-4 p-4.5 bg-zinc-900 text-white dark:bg-zinc-950 dark:text-zinc-100 rounded-2xl space-y-3.5 font-mono text-[10px] border border-white/5 shadow-inner">
                <span className="text-amber-500 font-bold uppercase tracking-wider block">CONTACTO DIRECTO DLX</span>

                <div className="space-y-2.5 text-zinc-300">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-zinc-500" />
                    <span>postventa@despejalax.es</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-zinc-500" />
                    <span>+34 960 999 888</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <span>L-V: 09:00h a 14:00h</span>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-2 text-[9px] text-zinc-400 font-light">
                  <span>Atención de incidencias técnicas en un plazo estimado inferior a 48 horas laborales.</span>
                </div>
              </div>
            </div>
          </Card>

        </div>
      )}

      {/* Visor Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="h-[50vh] sm:h-[65vh] w-full relative bg-black flex items-center justify-center">
              <PhotoImage
                photo={lightboxPhoto}
                mode="detail"
                fill
                className="object-contain"
              />
            </div>

            <div className="p-5 bg-zinc-950 text-xs border-t border-zinc-900 space-y-2 text-zinc-200">
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span className="bg-zinc-850 px-2 py-0.5 rounded text-zinc-300 uppercase">{lightboxPhoto.room}</span>
              </div>
              <p className="text-zinc-200 font-light text-sm">
                {lightboxPhoto.caption}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification flotante */}
      <ToastViewport toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
