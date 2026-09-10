import Link from "next/link";

/**
 * Logo oficial de Despeja la X.
 * - Muestra la versión positiva (tinta Jet) sobre fondos claros.
 * - Conmuta automáticamente a la versión negativa (White Smoke) en modo oscuro.
 *
 * Props:
 *  - variant: "full" (logotipo horizontal) | "iso" (isotipo / la X con tejado)
 *  - className: controla el alto (p. ej. "h-8")
 *  - href: si se pasa, envuelve el logo en un enlace
 */
interface BrandLogoProps {
  variant?: "full" | "iso";
  className?: string;
  href?: string;
  priority?: boolean;
  alt?: string;
}

export function BrandLogo({
  variant = "full",
  className = "h-8",
  href,
  alt = "Despeja la X",
}: BrandLogoProps) {
  const srcPos = variant === "iso" ? "/brand/isotipo.png" : "/brand/logo.png";
  const srcNeg = variant === "iso" ? "/brand/isotipo.png" : "/brand/logo-neg.png";

  const img = (
    <span className="inline-flex items-center select-none">
      {/* Positivo (fondos claros) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={srcPos}
        alt={alt}
        className={`${className} w-auto block dark:hidden`}
        draggable={false}
      />
      {/* Negativo (modo oscuro) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={srcNeg}
        alt={alt}
        className={`${className} w-auto hidden dark:block`}
        draggable={false}
      />
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label={alt}>
        {img}
      </Link>
    );
  }
  return img;
}
