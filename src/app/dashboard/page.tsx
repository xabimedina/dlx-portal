import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Mail } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { getUserProfile, type Profile } from "@/lib/firebase/profile";
import { listProjects, listClients, listAllDecisions, listAllWeeklyUpdates,
  getProjectsForProfile } from "@/lib/firebase/db";
import { sortClientProjects } from "@/lib/project-sort";
import { BrandLogo } from "@/components/brand-logo";
import { AccessShell } from "@/components/access-shell";
import { Eyebrow, Notice, SecHead, StateBadge, type StateTone } from "@/components/portal-ui";
import type { PortalClient, PortalDecision, PortalProject, PortalWeeklyUpdate } from "@/types/portal";

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
    let projects: PortalProject[] = [];
    let clients: PortalClient[] = [];
    let decisions: PortalDecision[] = [];
    let weeklyUpdates: PortalWeeklyUpdate[] = [];

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
 *
 * Diseño (fase 2): la misma portada Jet que /login y /acceso (el cliente llega aquí
 * justo después de entrar), con cerrar sesión arriba, y el aviso en la zona clara.
 */
function renderClientNotice(profile: Profile, title: string, message: string) {
  return (
    <AccessShell titleId="aviso-portada" action={<LogoutButton />}>
      <section aria-labelledby="aviso-titulo">
        <h2 id="aviso-titulo" className="text-2xl leading-[1.1] tracking-[0.02em] text-ink">
          {title}
        </h2>
        <p className="mt-3 text-base leading-[1.55] text-ink [text-wrap:pretty]">{message}</p>
        {profile.email && (
          <p className="mt-3 flex gap-2 text-sm leading-[1.5] text-ink-soft">
            <Mail className="mt-0.5 size-4 shrink-0 text-ink-mute" aria-hidden />
            <span>
              Has entrado con <strong className="font-semibold text-ink [overflow-wrap:anywhere]">{profile.email}</strong>.
            </span>
          </p>
        )}
      </section>
    </AccessShell>
  );
}

/** Etapa del modelo → palabra de la fila (misma nomenclatura que el Camino del cliente). */
const ETAPA: Record<string, string> = { project: "En proyecto", construction: "En obra", handover: "En entrega" };

/**
 * Estado de una obra en la lista, derivado de `status` y `current_stage`: en curso (Jet)
 * mientras está activa; quieto (borde) si está en pausa o terminada. Nunca verde.
 */
function estadoObra(project: PortalProject): { tone: StateTone; label: string } {
  if (project.status === "Pausado") return { tone: "quiet", label: "En pausa" };
  if (project.status === "Finalizado") return { tone: "quiet", label: "Terminada" };
  return { tone: "progress", label: ETAPA[project.current_stage] ?? "En marcha" };
}

/**
 * --------------------------------====================================
 * VISTA 1: DASHBOARD ADMINISTRADOR (Para arquitectos de Despeja la X)
 * --------------------------------====================================
 *
 * Diseño (fase 2): cabecera Jet como la del proyecto, antetítulo y titular
 * `display-portal`, el cuadro de cifras con filetes y las obras en tarjetas de 18
 * (estado en curso o quieto y chevrón). Cada tarjeta abre la obra tal como la ve su
 * cliente; la gestión sigue en DLX Admin → Obras. Pantalla tranquila: nada se anima.
 */
function renderAdminDashboard(
  profile: Profile,
  projects: PortalProject[],
  clients: PortalClient[],
  decisions: PortalDecision[],
  weeklyUpdates: PortalWeeklyUpdate[]
) {
  // Calcular métricas dinámicas de control
  const activeProjectsCount = projects.filter(p => p.status === 'Activo').length;
  const activeClientsCount = clients.length;
  const openDecisionsCount = decisions.filter(d => d.status === 'Pendiente').length;
  const recentUpdatesCount = weeklyUpdates.length;

  const stats = [
    { title: "Obras activas", value: activeProjectsCount, description: "En fase de diseño u obra" },
    { title: "Clientes registrados", value: activeClientsCount, description: "Con accesos habilitados" },
    { title: "Decisiones abiertas", value: openDecisionsCount, description: "Esperando respuesta" },
    { title: "Bitácoras semanales", value: recentUpdatesCount, description: "Actualizaciones de obra" },
  ];
  // Filetes del cuadro: 2 × 2 en móvil, 4 en fila desde sm
  const cellBorder = [
    "",
    "border-l border-border pl-3",
    "border-t border-border sm:border-t-0 sm:border-l sm:pl-3",
    "border-t border-l border-border pl-3 sm:border-t-0",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Cabecera persistente, como la de las páginas de obra */}
      <header className="dark sticky top-0 z-50 w-full bg-[var(--nav-glass)] text-whitesmoke backdrop-blur-[10px]">
        <div className="container mx-auto flex h-20 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <BrandLogo href="/dashboard" className="h-7 sm:h-8" />
            <div className="h-4 w-px shrink-0 bg-white/20" />
            <span className="truncate font-heading text-sm font-medium text-whitesmoke sm:text-base">
              Panel del estudio
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 text-xs text-zinc-300 md:flex">
              <Mail className="size-4 text-zinc-300" aria-hidden />
              <span className="font-medium">{profile.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl flex-grow space-y-10 px-4 pt-8 pb-14 sm:px-6 sm:pt-10">
        <header className="space-y-3">
          <Eyebrow>Panel del estudio</Eyebrow>
          <h1 className="display-portal text-ink">Obras del estudio</h1>
          <p className="max-w-[60ch] text-sm leading-[1.55] text-ink-soft [text-wrap:pretty]">
            La gestión de obras se realiza desde la consola del estudio (DLX Admin → Obras). Desde aquí abres cada
            obra tal como la ve su cliente.
          </p>
        </header>

        {/* Cuadro de cifras: celdas con filetes, sin cajas de color */}
        <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
          {stats.map((stat, idx) => (
            <div key={stat.title} className={`min-w-0 py-3.5 pr-3 ${cellBorder[idx]}`}>
              {/* Dos líneas de antetítulo siempre, para que las cifras queden alineadas */}
              <dt className="cell-k min-h-[2.4em]">{stat.title}</dt>
              <dd className="mt-2">
                <span className="kpi block text-[40px] text-ink">{stat.value}</span>
                <span className="mt-1.5 block text-xs font-medium leading-[1.4] text-ink-mute">{stat.description}</span>
              </dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="obras-lista" className="space-y-4">
          <SecHead
            id="obras-lista"
            title="Obras"
            action={
              <span className="shrink-0 text-sm font-medium text-ink-mute">
                {projects.length === 1 ? "1 obra" : `${projects.length} obras`}
              </span>
            }
          />

          {projects.length === 0 ? (
            <Notice title="Sin obras todavía">
              No hay proyectos registrados en el estudio. Da de alta clientes y obras desde la consola de
              administración (DLX Admin → Obras).
            </Notice>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => {
                // Encontrar el cliente correspondiente
                const clientObj = clients.find(c => c.id === project.client_id);
                const clientName = clientObj ? clientObj.full_name : "Sin cliente asignado";
                const estado = estadoObra(project);
                const meta = [project.project_type, clientName].filter(Boolean).join(" · ");

                return (
                  <li key={project.id}>
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="group grid h-full min-h-[112px] grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-control-line"
                    >
                      <span className="flex min-w-0 flex-col items-start gap-2">
                        <StateBadge tone={estado.tone}>{estado.label}</StateBadge>
                        <span className="block text-base font-semibold leading-snug text-ink">{project.name}</span>
                        {meta && <span className="block max-w-full truncate text-xs font-medium text-ink-mute">{meta}</span>}
                      </span>
                      <ChevronRight className="size-5 text-ink-mute group-hover:text-ink" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="dark bg-zinc-950 py-8 text-zinc-300">
        <div className="container mx-auto max-w-4xl space-y-3 px-4 sm:px-6">
          <BrandLogo className="h-6" />
          <p className="text-[13px] leading-normal">Tu hogar, listo y sin sorpresas.</p>
        </div>
      </footer>
    </div>
  );
}
