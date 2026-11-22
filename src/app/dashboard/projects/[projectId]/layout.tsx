import React from "react";
import { Mail } from "lucide-react";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { getProjectsForProfile, getDecisions, getModel3dPublished } from "@/lib/firebase/db";
import { sortClientProjects } from "@/lib/project-sort";
import { AccessRestricted } from "@/components/access-restricted";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { NavTabs } from "./nav-tabs";
import { ProjectSwitcher } from "./project-switcher";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}

/**
 * Shell compartido de todas las páginas de un proyecto del cliente: header
 * (logo → Inicio, nombre/selector de proyecto, email y logout), navegación
 * persistente (tab bar móvil / raíl desktop), retícula de fondo y footer.
 * Las páginas solo aportan su contenido.
 */
export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = await params;

  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return (
      <AccessRestricted
        message={
          access.profile.role === "client"
            ? "No tienes autorización para acceder a este proyecto de obra."
            : "No se ha encontrado el proyecto seleccionado."
        }
      />
    );
  }

  const { profile, project } = access;

  // Proyectos del cliente (selector del header) + decisiones (dot ámbar del tab) + si hay maqueta (atajo)
  let clientProjects: { id: string; name: string; status?: string }[] = [];
  let hasPendingDecisions = false;
  let hasMaqueta = false;
  try {
    const [projects, decisions, maqueta] = await Promise.all([
      profile.role === "client" ? getProjectsForProfile(profile) : Promise.resolve([project]),
      getDecisions(project.id),
      // Un fallo de la maqueta no tumba la navegación: solo se queda sin atajo
      getModel3dPublished(project.id).catch(() => null),
    ]);
    clientProjects = sortClientProjects(projects || []);
    hasPendingDecisions = (decisions || []).some((d) => d.status === "Pendiente");
    hasMaqueta = maqueta !== null;
  } catch (err) {
    console.error("Error cargando datos del layout de proyecto:", err);
    clientProjects = [project];
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-zinc-50 transition-colors duration-300 dark:bg-zinc-950">
      {/* Fondo con retícula arquitectónica fina */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e6e7e4_1px,transparent_1px),linear-gradient(to_bottom,#e6e7e4_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] dark:bg-[linear-gradient(to_right,#43463f_1px,transparent_1px),linear-gradient(to_bottom,#43463f_1px,transparent_1px)]" />

      {/* Header persistente */}
      <header className="dark sticky top-0 z-50 w-full bg-[var(--nav-glass)] text-whitesmoke backdrop-blur-[10px]">
        <div className="container mx-auto flex h-20 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <BrandLogo href={`/dashboard/projects/${project.id}`} className="h-7 sm:h-8" />
            <div className="h-4 w-px shrink-0 bg-white/20" />
            {clientProjects.length > 1 ? (
              <ProjectSwitcher projects={clientProjects} currentId={project.id} />
            ) : (
              <span className="truncate font-heading text-sm font-medium text-zinc-900 dark:text-white sm:text-base">
                {project.name}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 text-xs text-zinc-300 md:flex">
              <Mail className="h-3.5 w-3.5 text-zinc-300" />
              <span className="font-mono font-medium">{profile.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <NavTabs
        projectId={project.id}
        showDecisionsDot={hasPendingDecisions}
        showHandover={project.current_stage === "handover" || project.status === "Finalizado"}
        showMaqueta={hasMaqueta}
      />

      {/* Contenido: hueco para el raíl en desktop y para la tab bar en móvil */}
      <div className="relative z-10 flex-grow lg:pl-24">
        <main className="container mx-auto max-w-4xl px-4 pb-28 pt-8 sm:px-6 sm:pt-10 lg:pb-14">
          {children}
        </main>

        <footer className="border-t border-zinc-200/60 bg-white py-8 pb-24 text-xs text-zinc-600 transition-colors duration-300 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-400 lg:pb-8">
          <div className="container mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
            <BrandLogo className="h-6" />
            <span className="text-[10px] text-zinc-600 dark:text-zinc-400">
              © {new Date().getFullYear()} Despeja la X • Portal de Gestión Privada Seguro.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
