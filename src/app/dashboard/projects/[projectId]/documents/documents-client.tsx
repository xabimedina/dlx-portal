"use client";

import React, { useState } from "react";
import {
  Download, Search, RefreshCw,
  FolderArchive, Check
} from "lucide-react";
import { Profile } from "@/lib/firebase/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSignedDocumentUrlAction } from "../../../actions";
import { useToast, ToastViewport } from "@/components/toast";
import { formatDateEs } from "@/lib/format-date-es";

interface DocumentsClientProps {
  documents: any[];
  phases: any[];
  projectId: string;
  profile: Profile;
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

export function DocumentsClient({
  documents,
  phases,
  projectId,
  profile,
}: DocumentsClientProps) {
  void projectId; void profile;

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");

  // Estado de carga individual para las firmas criptográficas de descarga
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Toast (sustituye a los alert() del navegador)
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

  // Manejador de descargas seguras mediante firmado de URL on-demand
  const handleDownload = async (doc: any) => {
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
  const getDocumentGroup = (doc: any) => {
    const phase = phases.find(p => p.id === doc.phase_id);
    const titleLower = doc.title.toLowerCase();
    const catLower = doc.category.toLowerCase();
    
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

  // Clasificar y agrupar todos los documentos
  const groupedDocuments: Record<string, any[]> = {};
  GROUPS.forEach(g => {
    groupedDocuments[g] = [];
  });

  // Filtrar documentos por búsqueda de texto y distribuirlos
  const filteredDocs = documents.filter(doc => {
    return doc.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  filteredDocs.forEach(doc => {
    const grp = getDocumentGroup(doc);
    if (groupedDocuments[grp]) {
      groupedDocuments[grp].push(doc);
    } else {
      // Fallback a Contrato si fallase
      groupedDocuments["Contrato y documentación inicial"].push(doc);
    }
  });

  return (
    <div className="space-y-8">

      {/* Cabecera y Introducción */}
      <div className="space-y-2">
          <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-[0.15em]">
            <FolderArchive className="h-3.5 w-3.5 text-zinc-500" />
            <span>Biblioteca de proyecto</span>
          </div>
          <h1 className="display-portal text-zinc-900 dark:text-white">
            Documentos
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
            Expediente digital completo de tu vivienda. Accede de forma segura y descarga las versiones definitivas vigentes de planos de distribución, proyectos técnicos, licencias y presupuestos oficiales.
          </p>
        </div>

        {/* Buscador de Documentos */}
        <Card className="border border-zinc-200/50 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/60 p-4 shadow-xs rounded-3xl backdrop-blur-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            <input 
              type="text"
              placeholder="Buscar documentos o planos por nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-850 rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 placeholder:text-zinc-500"
            />
          </div>
        </Card>

        {/* Listado de Grupos en Acordeón o Secciones */}
        <div className="space-y-6">
          {GROUPS.map((groupName) => {
            const groupDocs = groupedDocuments[groupName] || [];

            // Ocultar grupo si no tiene documentos y hay un filtro activo (para limpiar la UI)
            if (groupDocs.length === 0 && searchQuery !== "") return null;

            return (
              <div key={groupName} className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/80 pb-2">
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 tracking-tight font-sans flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {groupName}
                  </h3>
                  <span className="font-mono text-[9px] bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                    {groupDocs.length} {groupDocs.length === 1 ? "documento" : "documentos"}
                  </span>
                </div>

                {groupDocs.length === 0 ? (
                  <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono italic pl-4">No hay documentos cargados en esta categoría todavía.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {groupDocs.map((doc) => {
                      const phase = phases.find(p => p.id === doc.phase_id);
                      
                      // Mapeo exacto de estados
                      const isVigente = doc.status === "Aprobado";
                      const isSustituido = doc.status === "Obsoleto";
                      const isBorrador = doc.status === "Borrador";
                      const isValidado = doc.status === "Revisión"; // O Validado si se crearan en DB

                      let statusLabel = doc.status;
                      let statusBadgeClass = "bg-zinc-100 text-zinc-650 dark:text-zinc-550 border-zinc-200";

                      if (isVigente) {
                        statusLabel = "Vigente";
                        statusBadgeClass = "bg-zinc-500/10 text-zinc-600 border-zinc-500/25 font-bold shadow-xs";
                      } else if (isSustituido) {
                        statusLabel = "Sustituido";
                        statusBadgeClass = "bg-zinc-150 text-zinc-600 dark:text-zinc-400 border-zinc-200 line-through";
                      } else if (isBorrador) {
                        statusLabel = "Preliminar";
                        statusBadgeClass = "bg-zinc-100 text-zinc-600 dark:text-zinc-500 border-zinc-200";
                      } else {
                        statusLabel = "Validado";
                        statusBadgeClass = "bg-zinc-800/10 text-zinc-800 border-zinc-800/25";
                      }

                      return (
                        <Card 
                          key={doc.id}
                          className={`relative border bg-white/70 dark:bg-zinc-900/60 shadow-2xs hover:shadow-md transition-all duration-300 rounded-3xl overflow-hidden ${
                            isVigente 
                              ? "border-zinc-500/35 dark:border-zinc-500/25 ring-1 ring-zinc-500/5 bg-zinc-500/[0.01]" 
                              : isSustituido
                                ? "border-zinc-200/40 opacity-70"
                                : "border-zinc-200/70 dark:border-zinc-850"
                          }`}
                        >
                          {/* Franja vertical de destaque oficial en vigor */}
                          {isVigente && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-zinc-500" />
                          )}

                          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs">
                            
                            {/* Información del documento */}
                            <div className="space-y-1 pl-1 flex-grow overflow-hidden pr-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[10px] bg-zinc-100 text-zinc-650 dark:bg-zinc-950 dark:text-zinc-450 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                                  {doc.category}
                                </span>
                                
                                <span className={`font-mono text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${statusBadgeClass}`}>
                                  {statusLabel}
                                </span>

                                {isVigente && (
                                  <span className="font-mono text-[10px] bg-zinc-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-0.5">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" /> Oficial
                                  </span>
                                )}
                              </div>

                              <h4 className={`text-xs sm:text-sm font-semibold text-zinc-950 dark:text-white mt-1.5 truncate ${
                                isSustituido ? "line-through opacity-60" : ""
                              }`}>
                                {doc.title}
                              </h4>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-zinc-600 dark:text-zinc-400 pt-0.5">
                                <span>{phase ? `${phase.phase_number} • ${phase.name}` : "Diseño General"}</span>
                                <span>•</span>
                                <span>Versión {doc.version || "v1.0"}</span>
                                <span>•</span>
                                <span>Registrado el {formatDateEs(doc.created_at)}</span>
                              </div>
                            </div>

                            {/* Botón de descarga y peso */}
                            <div className="shrink-0 flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-zinc-150/40 pt-3.5 sm:pt-0 pl-1 sm:pl-0">
                              <span className="font-mono text-[9px] text-zinc-600 dark:text-zinc-450">{formatBytes(doc.file_size)}</span>
                              
                              <Button
                                onClick={() => handleDownload(doc)}
                                disabled={loadingDocId !== null}
                                className={`text-[10px] font-semibold uppercase tracking-[0.15em] h-10 sm:h-9 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-2xs ${
                                  isVigente
                                    ? "bg-zinc-600 hover:bg-zinc-500 text-white dark:bg-zinc-600 dark:hover:bg-zinc-500"
                                    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                                }`}
                              >
                                {loadingDocId === doc.id ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    Preparando descarga…
                                  </>
                                ) : (
                                  <>
                                    Descargar
                                    <Download className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </Button>
                            </div>

                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {/* Toast Notification flotante */}
      <ToastViewport toast={toast} onDismiss={dismissToast} />

    </div>
  );
}
