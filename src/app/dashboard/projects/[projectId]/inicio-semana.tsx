import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { PhotoImage } from "@/components/photo-image";
import { Eyebrow, Notice, SecHead, SecLink } from "@/components/portal-ui";
import { CLOSING_WEEK_NUMBER, weekLabel } from "@/lib/week-label";
import { gremiosDeAsistentes } from "@/lib/attendees";
import { isNoOpStudioText } from "@/lib/actions-aggregator";
import { daysBetween, formatDayMonthEs, relativeDaysEs } from "@/lib/format-date-es";
import type { PortalMeeting, PortalPhoto, PortalWeeklyUpdate } from "@/types/portal";
import { ExpandableText } from "./expandable-text";

/** Lo que ES cada foto, para su etiqueta honesta (larga sobre la foto grande, corta en miniatura). */
function tipoFoto(photo: PortalPhoto): { largo: string; corto: string } {
  if (photo.weekly_update_id) return { largo: "Foto de obra", corto: "Obra" };
  if (photo.meeting_id) return { largo: "Foto del acta", corto: "Acta" };
  if (photo.decision_id) return { largo: "Referencia", corto: "Referencia" };
  return { largo: "Foto del proyecto", corto: "Proyecto" };
}

function etiquetaFoto(photo: PortalPhoto): string {
  const { largo } = tipoFoto(photo);
  return photo.room ? `${largo} · ${photo.room}` : largo;
}

/** «semana 6» / «cierre», en minúscula para ir dentro de una frase. */
const semanaEnFrase = (week: number) =>
  week === CLOSING_WEEK_NUMBER ? "parte de cierre" : `parte de la semana ${week}`;

const pct = (u?: PortalWeeklyUpdate | null): u is PortalWeeklyUpdate =>
  !!u && typeof u.progress_percentage === "number" && Number.isFinite(u.progress_percentage);

/** Miniaturas que enlazan a Fotos; si sobran, una casilla «+N». */
function Miniaturas({
  base,
  photos,
  moreLabel,
}: {
  base: string;
  photos: PortalPhoto[];
  /** Para el aria-label de la casilla «+N» («de la semana 7», «del acta del 3 de junio»). */
  moreLabel: string;
}) {
  if (!photos.length) return null;
  const shown = photos.length <= 3 ? photos : photos.slice(0, 2);
  const rest = photos.length - shown.length;
  return (
    <div className="grid grid-cols-3 gap-2">
      {shown.map((photo) => (
        <Link key={photo.id} href={`${base}/photos`} className="relative block aspect-square overflow-hidden rounded-lg">
          <PhotoImage photo={photo} mode="gallery" fill className="object-cover" tag={tipoFoto(photo).corto} />
        </Link>
      ))}
      {rest > 0 && (
        <Link
          href={`${base}/photos`}
          aria-label={`Ver ${rest === 1 ? "1 foto más" : `${rest} fotos más`} ${moreLabel}`}
          className="grid aspect-square place-items-center rounded-lg bg-jet font-heading text-lg font-semibold tracking-[0.02em] text-whitesmoke hover:bg-zinc-700"
        >
          +{rest}
        </Link>
      )}
    </div>
  );
}

/**
 * «Esta semana»: el último parte de obra contado con una foto grande y honesta, su
 * texto, el avance con su tendencia real (alzado de los partes), el imprevisto si lo hay,
 * lo que viene, quién estuvo en obra y las miniaturas. Sin partes, el último acta; sin
 * nada, una línea que explica cuándo llegará.
 */
export function InicioSemana({
  base,
  updates,
  photos,
  latestMeeting,
  isPaused,
  isConstruction,
  coverPhoto,
  today,
  className = "",
}: {
  base: string;
  /** Partes ordenados por semana, del último al primero. */
  updates: PortalWeeklyUpdate[];
  /** Fotos firmadas, de la más reciente a la más antigua. */
  photos: PortalPhoto[];
  latestMeeting: PortalMeeting | null;
  isPaused: boolean;
  isConstruction: boolean;
  coverPhoto: PortalPhoto | null;
  today: string;
  className?: string;
}) {
  const latest = updates[0] ?? null;
  const previous = updates[1] ?? null;

  // ── Sin partes, pero con acta confirmada ──
  if (!latest && latestMeeting) {
    const meetingPhotos = photos.filter((p) => p.meeting_id === latestMeeting.id);
    return (
      <section aria-labelledby="inicio-semana" className={className}>
        <SecHead
          id="inicio-semana"
          title="Lo último"
          action={
            <SecLink href={`${base}/meetings`}>
              Reuniones <ArrowRight className="size-4" aria-hidden />
            </SecLink>
          }
        />
        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Eyebrow>
              Reunión del {formatDayMonthEs(latestMeeting.meeting_date)} · {relativeDaysEs(latestMeeting.meeting_date, today)}
            </Eyebrow>
            <h3 className="text-xl leading-[1.15] text-ink">{latestMeeting.title}</h3>
            {isConstruction && (
              <p className="text-sm text-ink-soft">La obra arranca; aquí verás el parte de cada semana.</p>
            )}
            {isPaused && <p className="text-sm text-ink-soft">Última novedad antes de la pausa.</p>}
            {latestMeeting.summary && (
              <ExpandableText text={latestMeeting.summary} className="text-[15px] leading-relaxed text-ink" />
            )}
          </div>
          {latestMeeting.decisions_summary && (
            <div className="space-y-2">
              <Eyebrow>Lo que se decidió</Eyebrow>
              <p className="text-[15px] leading-relaxed text-ink">{latestMeeting.decisions_summary}</p>
            </div>
          )}
          <Miniaturas
            base={base}
            photos={meetingPhotos}
            moreLabel={`del acta del ${formatDayMonthEs(latestMeeting.meeting_date)}`}
          />
        </div>
      </section>
    );
  }

  // ── Ni partes ni actas ──
  if (!latest) {
    return (
      <section aria-labelledby="inicio-semana" className={className}>
        <SecHead id="inicio-semana" title="¿Qué ha pasado?" />
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Las novedades de tu proyecto aparecerán aquí tras la primera reunión.
        </p>
      </section>
    );
  }

  // ── El último parte ──
  const stale = daysBetween(latest.created_at, today) > 14;
  const isCierre = latest.week_number === CLOSING_WEEK_NUMBER;
  const label = isCierre ? "Cierre de obra" : weekLabel(latest.week_number);
  const delta = pct(latest) && pct(previous) ? Math.round(latest.progress_percentage - previous.progress_percentage) : null;
  const workBullets = (latest.current_work || "")
    .split(/[.,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 3);
  const gremios = gremiosDeAsistentes(latest.attendees);

  // Alzado: el % real de cada parte (los 8 últimos), en orden de semana
  const serie = updates
    .filter(pct)
    .slice(0, 8)
    .reverse()
    .map((u) => ({
      id: u.id,
      week: u.week_number,
      x: u.week_number === CLOSING_WEEK_NUMBER ? "Cierre" : `S${u.week_number}`,
      p: Math.min(100, Math.max(0, Math.round(u.progress_percentage))),
      now: u.id === latest.id,
    }));
  const serieAria = `Avance de obra según cada parte: ${serie
    .map((s) => `${s.week === CLOSING_WEEK_NUMBER ? "cierre" : `semana ${s.week}`}, ${s.p} por ciento`)
    .join("; ")}.`;

  const weekPhotos = photos.filter((p) => p.weekly_update_id === latest.id && p.id !== coverPhoto?.id);

  return (
    <section aria-labelledby="inicio-semana" className={className}>
      <SecHead
        id="inicio-semana"
        title={stale ? "El último parte" : "Esta semana"}
        action={
          <SecLink href={`${base}/construction`}>
            Diario <ArrowRight className="size-4" aria-hidden />
          </SecLink>
        }
      />

      <div className="mt-5 space-y-6">
        {/* La foto grande, con su etiqueta honesta; un toque lleva a Fotos */}
        {coverPhoto && (
          <figure>
            <Link
              href={`${base}/photos`}
              aria-label="Ver todas las fotos"
              className="relative block aspect-[4/3] overflow-hidden rounded-lg lg:aspect-[3/2]"
            >
              <PhotoImage photo={coverPhoto} mode="gallery" fill className="object-cover" tag={etiquetaFoto(coverPhoto)} />
            </Link>
            {coverPhoto.caption && (
              <figcaption className="mt-2 text-[13px] leading-snug text-ink-mute">{coverPhoto.caption}</figcaption>
            )}
          </figure>
        )}

        <div className="space-y-2">
          <Eyebrow>
            {label} · parte de {relativeDaysEs(latest.created_at, today)}
          </Eyebrow>
          <h3 className="text-xl leading-[1.15] text-ink">{latest.title}</h3>
          {isPaused && <p className="text-sm text-ink-soft">Último parte antes de la pausa.</p>}
          {latest.summary && (
            <ExpandableText text={latest.summary} className="text-[15px] leading-relaxed text-ink" />
          )}
          {workBullets.length > 0 && (
            <ul className="space-y-1 pt-1">
              {workBullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-mute" aria-hidden />
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* El único porcentaje de la sección, con atribución y su tendencia real */}
        {pct(latest) && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-end justify-between gap-4">
              <div className="shrink-0">
                <p className="cell-k">Avance de obra</p>
                <p className="kpi mt-1.5 text-[44px] text-ink">
                  {Math.round(latest.progress_percentage)}
                  <span className="ml-1 align-top text-xs font-medium tracking-[0.04em] text-ink-mute">%</span>
                </p>
              </div>
              <p className="text-right text-[13px] leading-snug text-ink-mute">
                {delta !== null && previous && (
                  <>
                    {delta > 0
                      ? `+${delta === 1 ? "1 punto" : `${delta} puntos`}`
                      : delta < 0
                        ? `−${-delta === 1 ? "1 punto" : `${-delta} puntos`}`
                        : "Sin cambios"}{" "}
                    desde la {weekLabel(previous.week_number).toLowerCase()}
                    <br />
                  </>
                )}
                según el {semanaEnFrase(latest.week_number)}
              </p>
            </div>
            {serie.length >= 2 && (
              <div role="img" aria-label={serieAria} className="mt-4">
                <div className="flex h-[92px] items-end gap-1.5 border-b-2 border-ink px-0.5">
                  {serie.map((s) => (
                    <span
                      key={s.id}
                      className={`block flex-1 rounded-t-[2px] ${s.now ? "bg-zinc-950" : "bg-control-line"}`}
                      style={{ height: `${Math.max(s.p, 2)}%` }}
                    />
                  ))}
                </div>
                <div aria-hidden className="flex gap-1.5 px-0.5 pt-1.5">
                  {serie.map((s) => (
                    <span
                      key={s.id}
                      className={`flex-1 text-center text-xs ${s.now ? "font-bold text-ink" : "font-medium text-ink-mute"}`}
                    >
                      {s.x}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {latest.issues && !isNoOpStudioText(latest.issues) && (
          <Notice title="Hubo un imprevisto" icon={<Info aria-hidden />}>
            {latest.issues}
          </Notice>
        )}

        {latest.next_steps && (
          <div className="space-y-2">
            <Eyebrow>{stale ? "La semana siguiente" : "La semana que viene"}</Eyebrow>
            <p className="text-[15px] leading-relaxed text-ink">{latest.next_steps}</p>
          </div>
        )}

        {gremios.length > 0 && (
          <div className="space-y-2">
            <Eyebrow>{stale ? "En obra esa semana" : "En obra esta semana"}</Eyebrow>
            <ul className="flex flex-wrap gap-1.5">
              {gremios.map((g) => (
                <li
                  key={g}
                  className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold uppercase leading-[1.4] tracking-[0.04em] text-ink"
                >
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Miniaturas
          base={base}
          photos={weekPhotos}
          moreLabel={isCierre ? "del parte de cierre" : `de la ${weekLabel(latest.week_number).toLowerCase()}`}
        />
      </div>
    </section>
  );
}
