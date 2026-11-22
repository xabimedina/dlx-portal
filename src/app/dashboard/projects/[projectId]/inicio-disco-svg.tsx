import type { CSSProperties } from "react";
import styles from "./inicio.module.css";
import { layoutDisco, type DiscoData, type DiscoVariant } from "./inicio-disco";

/** Colores del dibujo sobre la banda Jet (tokens del manual en hex: el SVG no lee clases). */
const C = {
  smoke: "#f5f3f4",
  mute: "#9da19a",
  rest: "#aeb1ab",
  disc: "#262826",
  jet: "#333533",
  saffron: "#eeba0b",
  keys: "#cfd1cd",
};

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/**
 * El «disco de ahora»: la línea real del proyecto, de la primera fase a las llaves, con
 * el disco posado en hoy. El área Saffron del disco es el % real del último parte; sin %,
 * el disco lleva el número de la fase en curso y un aro Saffron. Es la única pieza
 * Saffron de la pantalla. Todo lo que pinta sale de `buildDisco` (inicio-disco.ts).
 */
export function DiscoAhora({
  data,
  variant,
  className,
}: {
  data: DiscoData;
  variant: DiscoVariant;
  className?: string;
}) {
  const L = layoutDisco(data, variant);
  const { W, H, axisY, x0, x1, r, fs, fsDelta, fsBig, ls } = L.dims;
  const { cx, cy } = L;
  const id = `inicio-disco-${variant}`;
  const hasFill = data.progress !== null;
  const nodeR = variant === "ancho" ? 5 : 4.5;
  const keysR = variant === "ancho" ? 7 : 6;

  const cifra = (fill: string, clip: string) => (
    <text x={cx} y={L.numY} textAnchor="middle" fill={fill} clipPath={`url(#${clip})`}>
      <tspan fontSize={fsBig} fontWeight={300}>
        {data.progress}
      </tspan>
      <tspan fontSize={Math.round(fsBig * 0.4)} fontWeight={600} dx={2} dy={-fsBig * 0.42}>
        %
      </tspan>
    </text>
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={data.aria}
      className={className}
      style={{ maxWidth: W * 1.25 }}
    >
      <defs>
        <clipPath id={`${id}-circulo`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <clipPath id={`${id}-cielo`}>
          <rect x={0} y={0} width={W} height={axisY} />
        </clipPath>
        {hasFill && (
          <>
            <clipPath id={`${id}-lleno`}>
              <rect x={cx - r} y={L.fillTop} width={2 * r} height={L.fillH + 1} />
            </clipPath>
            <clipPath id={`${id}-vacio`}>
              <rect x={cx - r} y={cy - r - 1} width={2 * r} height={Math.max(0, L.fillTop - (cy - r - 1))} />
            </clipPath>
          </>
        )}
      </defs>

      {/* Arcos concéntricos: solo por encima de la línea */}
      <g clipPath={`url(#${id}-cielo)`} fill="none" strokeWidth={1}>
        <circle cx={cx} cy={cy} r={r + 16} stroke={C.smoke} strokeOpacity={0.2} />
        <circle cx={cx} cy={cy} r={r + 34} stroke={C.smoke} strokeOpacity={0.12} />
      </g>

      {/* Llamada: avance real frente al parte anterior */}
      {L.callout && data.callout && (
        <g className={styles.llamada}>
          <text x={L.callout.x} y={L.callout.ys[0]} textAnchor={L.callout.anchor} fontSize={fs} fontWeight={600} letterSpacing={ls} fill={C.mute}>
            AVANCE REAL
          </text>
          <text x={L.callout.x} y={L.callout.ys[1]} textAnchor={L.callout.anchor} fontSize={fsDelta} fontWeight={600} fill={C.smoke}>
            {data.callout.deltaText}
          </text>
          <text x={L.callout.x} y={L.callout.ys[2]} textAnchor={L.callout.anchor} fontSize={fs} fontWeight={500} fill={C.mute}>
            {data.callout.context[0]}
          </text>
          <text x={L.callout.x} y={L.callout.ys[3]} textAnchor={L.callout.anchor} fontSize={fs} fontWeight={500} fill={C.mute}>
            {data.callout.context[1]}
          </text>
          <path d={L.callout.leader} fill="none" stroke={C.rest} strokeWidth={1} />
          <circle cx={L.callout.dot.x} cy={L.callout.dot.y} r={2.5} fill={C.smoke} />
        </g>
      )}

      {/* La línea: lo hecho, maciza; lo que falta, discontinua */}
      {L.doneLen > 0 && (
        <path
          className={styles.trazo}
          d={`M${x0} ${axisY} H${cx}`}
          stroke={C.smoke}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          style={{ strokeDasharray: L.doneLen, "--len": L.doneLen } as Vars}
        />
      )}
      {!data.delivered && L.restFrom < x1 - keysR - 4 && (
        <path
          className={styles.falta}
          d={`M${L.restFrom} ${axisY} H${x1 - keysR - 4}`}
          stroke={C.rest}
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="none"
        />
      )}

      {/* Nudos: las fases completadas en su fecha real de cierre */}
      {L.nodes.map((n) => (
        <circle
          key={n.id}
          className={styles.nudo}
          cx={n.x}
          cy={axisY}
          r={nodeR}
          fill={C.smoke}
          style={{ "--delay": `${Math.ceil(((n.x - x0) / Math.max(1, L.doneLen)) * 10) * 100}ms` } as Vars}
        />
      ))}

      {/* Llaves */}
      <circle cx={x1} cy={axisY} r={keysR} fill={data.delivered ? C.smoke : C.jet} stroke={C.keys} strokeWidth={2} />

      {/* El disco de ahora */}
      <g className={styles.disco} style={{ "--ox": `${cx}px`, "--oy": `${cy}px` } as Vars}>
        <circle cx={cx} cy={cy} r={r} fill={C.disc} />
        {hasFill && (
          <g clipPath={`url(#${id}-circulo)`}>
            <rect
              className={styles.relleno}
              x={cx - r}
              y={L.fillTop}
              width={2 * r}
              height={L.fillH + 1}
              fill={C.saffron}
              style={{ "--h": `${L.fillH + 1}px` } as Vars}
            />
          </g>
        )}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={hasFill ? C.smoke : C.saffron}
          strokeWidth={hasFill ? 1.5 : 2.5}
        />
        {hasFill ? (
          <g className={styles.cifra}>
            {cifra(C.smoke, `${id}-vacio`)}
            {cifra(C.jet, `${id}-lleno`)}
          </g>
        ) : data.numeral ? (
          <g className={styles.cifra} textAnchor="middle">
            <text x={cx} y={cy - fsBig * 0.38} fontSize={fs} fontWeight={600} letterSpacing={ls} fill={C.mute}>
              FASE
            </text>
            <text x={cx} y={cy + fsBig * 0.5} fontSize={fsBig} fontWeight={300} fill={C.smoke}>
              {data.numeral}
            </text>
          </g>
        ) : null}
      </g>

      {/* Etiquetas de etapa, con sus fechas reales */}
      <g fontSize={fs}>
        {L.labels.map((l) => (
          <g key={l.key} textAnchor={l.anchor}>
            <text x={l.x} y={axisY + fs + 14} fontWeight={600} letterSpacing={ls} fill={C.smoke}>
              {l.title}
            </text>
            <text x={l.x} y={axisY + 2 * fs + 18} fontWeight={500} fill={C.mute}>
              {l.sub}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
