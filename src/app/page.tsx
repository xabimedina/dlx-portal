import Link from "next/link";
import { ArrowRight, Eye, LayoutGrid, HardHat, FileText, CalendarRange, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 relative overflow-hidden">
      {/* Fondo con retícula arquitectónica (estética de plano técnico) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/50 bg-white/70 backdrop-blur-md dark:border-zinc-800/50 dark:bg-zinc-950/70">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BrandLogo href="/" className="h-7 sm:h-8" />
            <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 hidden sm:block" />
            <span className="text-xs font-light uppercase tracking-wider text-zinc-600 dark:text-zinc-500 hidden sm:block">
              Estudio de Arquitectura e Interiorismo
            </span>
          </div>

          <Link href="/login">
            <Button variant="outline" className="font-mono text-xs uppercase tracking-wider border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-white transition-all duration-300">
              Portal Clientes <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col justify-center relative z-10">
        <section className="container mx-auto px-6 py-12 md:py-24 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Lado izquierdo - Texto */}
            <div className="lg:col-span-7 flex flex-col space-y-8">
              <div className="inline-flex items-center space-x-2 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 px-3.5 py-1.5 rounded-full w-fit shadow-xs">
                <Sparkles className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                <span className="text-xs font-mono font-medium tracking-wide text-zinc-600 dark:text-zinc-300">
                  Tu hogar, despejado • Portal Privado
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-zinc-900 dark:text-white leading-[1.1] font-heading">
                Despejamos la <span className="font-semibold text-zinc-950 dark:text-white block sm:inline">complejidad,</span>
                <br className="hidden sm:inline" />
                revelamos tu <span className="font-medium text-amber-500">espacio.</span>
              </h1>

              <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed max-w-xl font-light">
                Crear tu casa ideal debería ser emocionante, no abrumador. En <strong>Despeja la X</strong> resolvemos todas las variables técnicas y estéticas para ofrecerte un proceso de diseño y construcción totalmente despejado, transparente y bajo control.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link href="/login">
                  <Button className="w-full sm:w-auto h-12 px-8 font-mono text-xs uppercase tracking-widest bg-amber-500 text-zinc-900 hover:bg-amber-600 shadow-lg hover:shadow-xl transition-all duration-300">
                    Entrar al Portal Privado
                  </Button>
                </Link>
                <a href="https://despejalax.es" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                  <Button variant="ghost" className="w-full sm:w-auto h-12 px-8 font-mono text-xs uppercase tracking-widest text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/40 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-900/40">
                    Visitar Web Principal
                  </Button>
                </a>
              </div>
            </div>

            {/* Lado derecho - Representación Visual del Portal */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="w-full max-w-md border border-zinc-200/80 bg-white p-6 rounded-2xl shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 relative">
                {/* Indicador de estado */}
                <div className="absolute -top-3.5 left-6 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-mono tracking-widest uppercase px-3 py-1 rounded-full border border-zinc-800 dark:border-zinc-200">
                  Dashboard de Proyecto
                </div>

                <div className="space-y-6 pt-2">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <div>
                      <h3 className="font-medium text-sm text-zinc-900 dark:text-white">Villa Despejada</h3>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">ID: DLX-2026-09</p>
                    </div>
                    <span className="bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-[10px] font-mono uppercase px-2 py-0.5 rounded">
                      Fase: Obra
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-600 dark:text-zinc-500 font-light">Progreso general</span>
                      <span className="font-mono font-medium">62%</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-zinc-900 dark:bg-white h-full w-[62%] rounded-full" />
                    </div>
                  </div>

                  {/* Lista de últimos hitos */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-[10px] font-mono tracking-wider uppercase text-zinc-600 dark:text-zinc-400">Próximos Pasos</h4>
                    
                    <div className="flex items-start space-x-3 text-xs">
                      <div className="h-4 w-4 rounded-full border-2 border-zinc-950 dark:border-white flex items-center justify-center shrink-0 mt-0.5">
                        <div className="h-1.5 w-1.5 bg-zinc-950 dark:bg-white rounded-full" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">Selección de griferías y sanitarios</p>
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">Límite: 29 Mayo</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 text-xs opacity-50">
                      <div className="h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 mt-0.5" />
                      <div>
                        <p className="font-light">Instalación de carpintería exterior</p>
                        <p className="text-[10px] font-mono">Estimado: 08 Junio</p>
                      </div>
                    </div>
                  </div>

                  {/* Simulación del estado despejado */}
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-500 font-light flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                      Seguimiento de obra
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">Actualizado hace 2h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="bg-white dark:bg-zinc-900/40 border-t border-b border-zinc-200/50 dark:border-zinc-800/50 py-16 md:py-24 relative z-10 transition-colors duration-300">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center max-w-xl mx-auto mb-16">
              <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-500 mb-3">
                Un único espacio para todo
              </h2>
              <p className="text-2xl font-light text-zinc-900 dark:text-white tracking-tight">
                El portal de clientes que reúne y clarifica el desarrollo de tu hogar de principio a fin.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Feature 1 */}
              <div className="bg-zinc-50 dark:bg-zinc-950/40 p-6 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group">
                <div className="h-10 w-10 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <HardHat className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-base text-zinc-900 dark:text-white mb-2">Seguimiento Semanal</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs font-light leading-relaxed">
                  Galería de fotos y reporte de avances técnicos de la obra para que sepas exactamente qué pasa cada semana.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-zinc-50 dark:bg-zinc-950/40 p-6 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group">
                <div className="h-10 w-10 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-base text-zinc-900 dark:text-white mb-2">Toma de Decisiones</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs font-light leading-relaxed">
                  Vota y decide sobre materiales, acabados, mobiliario y opciones de diseño desde cualquier lugar.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-zinc-50 dark:bg-zinc-950/40 p-6 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group">
                <div className="h-10 w-10 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-base text-zinc-900 dark:text-white mb-2">Documentos y Planos</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs font-light leading-relaxed">
                  Acceso inmediato a los últimos planos validados, presupuestos, contratos y licencias sin perderte en correos.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-zinc-50 dark:bg-zinc-950/40 p-6 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group">
                <div className="h-10 w-10 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 rounded-lg flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <CalendarRange className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-base text-zinc-900 dark:text-white mb-2">Citas y Reuniones</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-xs font-light leading-relaxed">
                  Historial de actas de reunión, acuerdos tomados y agenda de próximas visitas técnicas de obra.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/60 bg-white py-12 dark:border-zinc-800/60 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 transition-colors duration-300 z-10">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start space-y-2">
            <BrandLogo className="h-6" />
            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-light">
              © {new Date().getFullYear()} Despeja la X. Todos los derechos reservados.
            </p>
          </div>
          <div className="flex space-x-6 text-xs font-mono tracking-wider">
            <a href="https://despejalax.es" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Estudio
            </a>
            <a href="https://despejalax.es/proyectos" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Proyectos
            </a>
            <span className="text-zinc-300 dark:text-zinc-800">|</span>
            <span className="text-zinc-600 dark:text-zinc-400 font-light">
              Desarrollado con precisión
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
