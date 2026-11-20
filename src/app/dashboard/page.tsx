import React from "react";
import { redirect } from "next/navigation";
import {
  Mail, ShieldCheck, ChevronRight, Layers,
  Briefcase, Users, CheckSquare
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserProfile } from "@/lib/firebase/profile";
import { listProjects, listClients, listAllDecisions, listAllWeeklyUpdates,
  getProjectsForProfile } from "@/lib/firebase/db";
import { sortClientProjects } from "@/lib/project-sort";
import { BrandLogo } from "@/components/brand-logo";

interface DashboardPageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { project: requestedProjectId } = await searchParams;

  // 1. Cargar el perfil de forma asíncrona
  const profile = await getUserProfile();

  if (!profile) {
    // Si no hay perfil, redirigimos a login
    redirect("/login");
  }

  // Bifurcamos el renderizado según el rol
  if (profile.role === 'admin') {
    let projects: any[] = [];
    let clients: any[] = [];
    let decisions: any[] = [];
    let weeklyUpdates: any[] = [];

    try {
      const [pData, cData, dData, wData] = await Promise.all([
        listProjects(),
        listClients(),
        listAllDecisions(),
        listAllWeeklyUpdates(),
      ]);
      projects = pData || [];
      clients = cData || [];
      decisions = dData || [];
      weeklyUpdates = wData || [];
    } catch (err) {
      console.error("Error al cargar datos en panel de administración general:", err);
    }

    return renderAdminDashboard(profile, projects, clients, decisions, weeklyUpdates);
  }

  // 2. RAMA CLIENTE: la home del cliente vive en /dashboard/projects/[projectId]
  //    (donde ya viven las subpáginas). Aquí solo se resuelve QUÉ proyecto
  //    abrir y se redirige: es la solución de raíz a la pérdida de ?project=.
  let targetProjectId: string | null = null;

  try {
    const clientProjects = sortClientProjects(await getProjectsForProfile(profile));
    const project =
      clientProjects.find((p) => p.id === requestedProjectId) || clientProjects[0] || null;
    targetProjectId = project?.id ?? null;
  } catch (err) {
    console.error("Error cargando los proyectos del cliente en dashboard:", err);
    return renderClientNotice(
      profile,
      "No se pudieron cargar tus datos",
      "Ha ocurrido un problema temporal al recuperar la información de tu proyecto. Vuelve a intentarlo en unos minutos y, si persiste, avisa a tu gestor en Despeja la X."
    );
  }

  // Sin proyecto vinculado todavía: estado vacío honesto (en modo real nunca
  // se muestran datos de demostración).
  if (!targetProjectId) {
    return renderClientNotice(
      profile,
      "Tu proyecto aún no está disponible",
      "Tu acceso funciona, pero todavía no hay ningún proyecto vinculado a tu cuenta. En cuanto el estudio lo active lo verás aquí; si crees que es un error, contacta con tu gestor en Despeja la X."
    );
  }

  redirect(`/dashboard/projects/${targetProjectId}`);
}

/**
 * Estado informativo a pantalla completa para el cliente (sin proyecto
 * vinculado o error de carga). Sustituye al antiguo fallback de datos de
 * demostración, que en producción enseñaba un proyecto ficticio.
 */
function renderClientNotice(profile: any, title: string, message: string) {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
      <header className="dark sticky top-0 z-50 w-full bg-[var(--nav-glass)] text-whitesmoke backdrop-blur-[10px]">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BrandLogo href="/dashboard" className="h-7 sm:h-8" />
            <div className="h-4 w-px bg-white/20" />
            <span className="text-[10px] font-mono uppercase tracking-widest bg-white/10 text-zinc-200 px-2 py-0.5 rounded">
              Portal Clientes
            </span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-2 text-xs text-zinc-300">
              <Mail className="h-3.5 w-3.5 text-zinc-300" />
              <span className="font-mono font-medium">{profile.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-6 py-10 flex items-center justify-center">
        <Card className="max-w-md w-full border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 text-center space-y-2 bg-white dark:bg-zinc-900 shadow-xl">
          <Briefcase className="h-12 w-12 text-amber-500 bg-amber-500/10 p-2.5 rounded-full mx-auto" />
          <CardHeader className="p-0">
            <CardTitle className="text-lg font-bold text-zinc-900 dark:text-white">{title}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{message}</p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-zinc-200/60 bg-white py-8 dark:border-zinc-800/60 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 z-10 text-xs">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo className="h-6" />
          <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">
            © {new Date().getFullYear()} Despeja la X • Portal de Gestión Privada Seguro.
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * --------------------------------====================================
 * VISTA 1: DASHBOARD ADMINISTRADOR (Para arquitectos de Despeja la X)
 * --------------------------------====================================
 */
function renderAdminDashboard(
  profile: any,
  projects: any[],
  clients: any[],
  decisions: any[],
  weeklyUpdates: any[]
) {
  // Calcular métricas dinámicas de control
  const activeProjectsCount = projects.filter(p => p.status === 'Activo').length;
  const activeClientsCount = clients.length;
  const openDecisionsCount = decisions.filter(d => d.status === 'Pendiente').length;
  const recentUpdatesCount = weeklyUpdates.length;

  const stats = [
    { title: "Proyectos Activos", value: String(activeProjectsCount), description: "En fase de diseño u obra", icon: Briefcase, color: "text-amber-500 bg-amber-500/10" },
    { title: "Clientes Registrados", value: String(activeClientsCount), description: "Con accesos habilitados", icon: Users, color: "text-zinc-800 bg-zinc-100" },
    { title: "Decisiones Abiertas", value: String(openDecisionsCount), description: "Esperando respuesta", icon: CheckSquare, color: "text-blue-500 bg-blue-500/10" },
    { title: "Bitácoras Semanales", value: String(recentUpdatesCount), description: "Actualizaciones de obra", icon: Layers, color: "text-purple-500 bg-purple-500/10" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300 relative overflow-hidden">
      {/* Retícula arquitectónica */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

      {/* Header Privado Admin */}
      <header className="dark sticky top-0 z-50 w-full bg-[var(--nav-glass)] text-whitesmoke backdrop-blur-[10px]">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BrandLogo href="/dashboard" className="h-7 sm:h-8" />
            <div className="h-4 w-px bg-white/20" />
            <span className="text-[10px] font-mono uppercase tracking-widest bg-amber-500/10 text-zinc-800 dark:bg-amber-500/20 dark:text-amber-400 px-2 py-0.5 rounded font-semibold">
              Panel de Control (Admin)
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-2 text-xs text-zinc-300">
              <Mail className="h-3.5 w-3.5 text-zinc-300" />
              <span className="font-mono font-medium">{profile.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Admin */}
      <main className="flex-grow container mx-auto px-6 py-10 relative z-10 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="display-portal text-zinc-900 dark:text-white mb-1.5">
              Estudio Despeja la X • <span className="font-heading italic text-zinc-600 dark:text-zinc-400">Gestión General</span>
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
              Panel general de administración y asignación de proyectos.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            La gestión de obras se realiza desde la consola del estudio (DLX Admin → Obras)
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border border-zinc-200/60 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl text-zinc-950 dark:text-white font-mono">{stat.value}</div>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold uppercase text-zinc-900 dark:text-white flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-zinc-600 dark:text-zinc-400" /> Proyectos Activos en el Estudio
            </h2>
            <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">Total: {projects.length} proyectos</span>
          </div>

          {projects.length === 0 ? (
            <Card className="border border-zinc-200/60 bg-white/80 p-8 text-center rounded-3xl">
              <p className="text-zinc-600 dark:text-zinc-500 text-sm">
                No hay proyectos registrados en el estudio. Da de alta clientes y obras
                desde la consola de administración (DLX Admin → Obras).
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {projects.map((project) => {
                // Encontrar el cliente correspondiente
                const clientObj = clients.find(c => c.id === project.client_id);
                const clientName = clientObj ? clientObj.full_name : "Sin Cliente Asignado";

                // Progreso estimado
                let progress = 0;
                if (project.current_stage === 'construction') progress = 60;
                else if (project.current_stage === 'handover') progress = 100;
                else progress = 25;

                const code = `DLX-${new Date(project.created_at || Date.now()).getFullYear()}-${project.project_type.substring(0, 3).toUpperCase()}`;

                return (
                  <div key={project.id} className="block group">
                    <Card className="border border-zinc-200/60 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/80 shadow-md h-full">
                      <CardHeader>
                        <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{code}</p>
                        <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-amber-500 transition-colors mt-1">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Cliente: <strong className="text-zinc-700 dark:text-zinc-300 font-medium">{clientName}</strong>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-600 dark:text-zinc-500">Progreso:</span>
                            <span className="font-mono font-medium">{progress}%</span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-zinc-900 dark:bg-white h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <div className="text-[10px] font-mono bg-zinc-50 dark:bg-zinc-950/40 p-2 rounded border border-zinc-100 dark:border-zinc-800/50 flex justify-between">
                          <span className="text-zinc-600 dark:text-zinc-400">FASE:</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 uppercase">{project.current_stage}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4 pb-4">
                        <div className="w-full font-mono text-[10px] uppercase tracking-wider text-zinc-600 dark:text-zinc-500 p-0 h-auto flex items-center justify-center gap-1">
                          Se gestiona en DLX Admin → Obras <ChevronRight className="h-3 w-3" />
                        </div>
                      </CardFooter>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-200/60 bg-white py-8 dark:border-zinc-800/60 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 transition-colors duration-300 z-10 text-xs">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo className="h-6" />
          <span className="text-zinc-600 dark:text-zinc-400 text-[10px]">
            © {new Date().getFullYear()} Despeja la X • Panel de Gestión de Estudio.
          </span>
        </div>
      </footer>
    </div>
  );
}
