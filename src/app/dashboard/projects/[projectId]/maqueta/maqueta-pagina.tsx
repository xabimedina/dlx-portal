"use client";

import dynamic from "next/dynamic";
import type { MaquetaPublicada } from "@/lib/firebase/model3d";

// three.js solo en el navegador
const Maqueta3D = dynamic(() => import("@/components/maqueta3d/maqueta-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-3xl bg-[#f1efeb]">
      <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Cargando maqueta…</span>
    </div>
  ),
});

/**
 * «Tu maqueta» a pantalla completa: ocupa todo el hueco entre la cabecera, el
 * raíl (escritorio) y la barra inferior (móvil), por encima del contenedor de
 * la página. La maqueta está desde el inicio de la obra y se va actualizando.
 */
export function MaquetaPagina({ maqueta }: { maqueta: MaquetaPublicada }) {
  // Al principio de la obra solo hay estado actual (§3.4.8)
  const { modelos, datos } = maqueta;
  const hayReformado = !!modelos.demolido || !!modelos.nuevo || datos.fases.reformado.estancias.length > 0;

  const cabecera = (
    <div className="min-w-0">
      <h1 className="display-portal text-zinc-900 dark:text-white">Tu maqueta</h1>
      <p className="hidden max-w-xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 sm:block">
        {hayReformado
          ? "Mira cómo está tu vivienda, qué se derriba y cómo quedará; toca una estancia para acercarte y abre sus fotos y renders."
          : "Toca una estancia para acercarte y abre sus fotos. La iremos actualizando a medida que avance el proyecto."}
      </p>
      {maqueta.etiqueta && <span className="block font-mono text-[10px] text-zinc-500">{maqueta.etiqueta}</span>}
    </div>
  );

  return (
    <section
      aria-label="Tu maqueta 3D"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] top-20 z-30 bg-zinc-50 px-3 pb-3 pt-3 dark:bg-zinc-950 sm:px-5 lg:bottom-0 lg:left-24 lg:pb-5"
    >
      <Maqueta3D modelos={modelos} datos={datos} imagenes={maqueta.imagenes} cabecera={cabecera} pantallaCompleta />
    </section>
  );
}
