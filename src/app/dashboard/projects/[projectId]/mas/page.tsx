import Link from "next/link";
import { CalendarDays, ChevronRight, Folder, Image as ImageIcon, Box, Key, Mail, Home } from "lucide-react";
import { getProjectPageAccess } from "@/lib/firebase/project-access";
import { getMeetings, getPhotos, getDocuments, getModel3dPublished, getProjectsForProfile } from "@/lib/firebase/db";
import { sortClientProjects } from "@/lib/project-sort";
import { isConfirmedMeeting } from "@/lib/actions-aggregator";
import { formatDayMonthEs, daysBetween } from "@/lib/format-date-es";
import { todayIso } from "@/lib/phase-delay";
import { AccessRestricted } from "@/components/access-restricted";
import { LogoutButton } from "@/components/logout-button";
import { Eyebrow, StateBadge } from "@/components/portal-ui";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * «Más» (fase 2): lo que no cabe en la tab bar de 5 pestañas. Reuniones, Fotos,
 * Documentos, Maqueta y Entrega, cada una con una línea de contexto real, y la cuenta:
 * cambio de obra (si hay varias), correo y cerrar sesión.
 */
export default async function MasPage({ params }: PageProps) {
  const { projectId } = await params;
  const access = await getProjectPageAccess(projectId);
  if (access.mode === "denied") {
    return <AccessRestricted message="No tienes autorización para acceder a este proyecto." />;
  }
  const { profile, project } = access;
  const base = `/dashboard/projects/${project.id}`;
  const hoy = todayIso();

  const [meetings, photos, documents, maqueta, projects] = await Promise.all([
    getMeetings(project.id).catch(() => []),
    getPhotos(project.id).catch(() => []),
    getDocuments(project.id).catch(() => []),
    getModel3dPublished(project.id).catch(() => null),
    profile.role === "client" ? getProjectsForProfile(profile).catch(() => [project]) : Promise.resolve([project]),
  ]);

  const reciente = (iso?: string | null, dias = 7) => !!iso && daysBetween(iso.slice(0, 10), hoy) <= dias;

  const ultimaReunion = [...(meetings || [])]
    .filter(isConfirmedMeeting)
    .sort((a, b) => (b.meeting_date || "").localeCompare(a.meeting_date || ""))[0];
  const nuevasFotos = (photos || []).filter((p) => reciente(p.created_at)).length;
  const docs = [...(documents || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const docNuevo = docs[0] && reciente(docs[0].created_at, 14) ? docs[0] : null;
  const showHandover = project.current_stage === "handover" || project.status === "Finalizado";
  const obras = sortClientProjects(projects || []);

  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  const filas: Array<{ href: string; icon: typeof Home; title: string; caption: string } | null> = [
    {
      href: `${base}/meetings`,
      icon: CalendarDays,
      title: "Reuniones y actas",
      caption: ultimaReunion
        ? `Última: ${ultimaReunion.title}, ${formatDayMonthEs(ultimaReunion.meeting_date)}`
        : "Aún no hay reuniones",
    },
    {
      href: `${base}/photos`,
      icon: ImageIcon,
      title: "Fotos",
      caption: photos.length
        ? `${plural(photos.length, "foto", "fotos")}${nuevasFotos ? ` · ${plural(nuevasFotos, "nueva", "nuevas")} esta semana` : ""}`
        : "Aún no hay fotos",
    },
    {
      href: `${base}/documents`,
      icon: Folder,
      title: "Documentos",
      caption: docs.length
        ? `${plural(docs.length, "documento", "documentos")}${docNuevo ? ` · ${docNuevo.title} nuevo` : ""}`
        : "Aún no hay documentos",
    },
    maqueta
      ? { href: `${base}/maqueta`, icon: Box, title: "Maqueta 3D", caption: maqueta.label || `Versión ${maqueta.version}` }
      : null,
    showHandover
      ? { href: `${base}/handover`, icon: Key, title: "Entrega", caption: "Garantías, manuales y la entrega de llaves" }
      : null,
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <Eyebrow>{project.name}</Eyebrow>
        <h1 className="display-portal text-ink">Más</h1>
      </header>

      <nav aria-label="Más secciones">
        <ul className="divide-y divide-border">
          {filas.filter(Boolean).map((f) => {
            const fila = f!;
            return (
              <li key={fila.href}>
                <Link href={fila.href} className="grid min-h-[76px] grid-cols-[44px_1fr_auto] items-center gap-3.5 py-3.5">
                  <span className="grid size-11 place-items-center rounded-md bg-jet text-whitesmoke">
                    <fila.icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold leading-snug text-ink">{fila.title}</span>
                    <span className="block truncate text-xs font-medium text-ink-mute">{fila.caption}</span>
                  </span>
                  <ChevronRight className="size-5 text-ink-mute" aria-hidden />
                </Link>
              </li>
            );
          })}
          {!showHandover && (
            <li className="grid min-h-[76px] grid-cols-[44px_1fr_auto] items-center gap-3.5 py-3.5">
              <span className="grid size-11 place-items-center rounded-md bg-zinc-100 text-ink-soft">
                <Key className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold leading-snug text-ink">Entrega</span>
                <span className="block text-xs font-medium text-ink-mute">Se abre con la entrega de llaves</span>
              </span>
              <StateBadge tone="quiet">Por llegar</StateBadge>
            </li>
          )}
        </ul>
      </nav>

      <section aria-labelledby="mas-cuenta" className="space-y-2">
        <Eyebrow>
          <span id="mas-cuenta">Tu cuenta</span>
        </Eyebrow>
        <ul className="divide-y divide-border">
          {obras.length > 1 && (
            <li className="py-2">
              <p className="mb-1 flex min-h-11 items-center gap-3 text-[15px] font-medium text-ink">
                <Home className="size-5" aria-hidden />
                Tus obras
              </p>
              <ul className="space-y-1 pl-8">
                {obras.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/dashboard/projects/${o.id}/mas`}
                      aria-current={o.id === project.id ? "page" : undefined}
                      className="flex min-h-11 items-center justify-between gap-3 text-[15px] text-ink-soft aria-[current=page]:font-semibold aria-[current=page]:text-ink"
                    >
                      {o.name}
                      {o.id === project.id && <span className="text-xs font-medium text-ink-mute">Ahora estás aquí</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          )}
          <li className="flex min-h-[52px] items-center gap-3 text-[15px] text-ink-soft">
            <Mail className="size-5" aria-hidden />
            <span className="truncate">{profile.email}</span>
          </li>
          <li className="flex min-h-[52px] items-center">
            <LogoutButton variant="row" />
          </li>
        </ul>
      </section>
    </div>
  );
}
