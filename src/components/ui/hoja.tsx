import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Botón de Ajustes `.ib`: círculo sólido de 44 (sin desenfoque) con el ícono de
 * controles. Se escribe UNA vez aquí; lo usan `Cabeza` (prop `ajustes`) y, de
 * forma provisional, el shell en Hoy.
 */
export function BotonAjustes({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Link href="/ajustes" aria-label="Ajustes" className={cn("ib", className)} style={style}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
      </svg>
    </Link>
  );
}

/**
 * Cabeza de pantalla (§3): la ventana de cromo entre el borde de arriba y el
 * borde de la hoja. El texto va sobre un velo (`.cabeza::before`, en globals.css)
 * que sangra hasta los bordes de pantalla. Un título (`h1`) y un subtítulo
 * opcional. El botón de atrás es la píldora del shell, no de la cabeza.
 *
 * `empujada`: pantallas a las que se llega desde otra (relleno superior 76, alto
 * mínimo 196, título 27/31). `ajustes`: pinta el botón de Ajustes arriba a la
 * derecha (las pantallas de área).
 */
export function Cabeza({
  titulo,
  subtitulo,
  empujada = false,
  ajustes = false,
  className,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  empujada?: boolean;
  ajustes?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("cabeza", className)} data-empujada={empujada ? "" : undefined}>
      <h1 className="cabeza-titulo">{titulo}</h1>
      {subtitulo != null && <p className="cabeza-sub mt-2">{subtitulo}</p>}
      {ajustes && <BotonAjustes />}
    </header>
  );
}

/** Alto mínimo de la cabeza de un área (`.cabeza`) y de una empujada. */
export const ALTO_CABEZA_PX = 236;
export const ALTO_CABEZA_EMPUJADA_PX = 196;

/**
 * La hoja `.hoja` de una pantalla que pinta su propia `Cabeza`: el shell no la
 * envuelve. La `Cabeza` queda arriba en el flujo y la hoja llena el resto hasta
 * el borde de abajo (mismo cálculo que la ventana provisional del shell).
 */
export function Hoja({
  children,
  empujada = false,
  className,
}: {
  children: ReactNode;
  empujada?: boolean;
  className?: string;
}) {
  const ventana = empujada ? ALTO_CABEZA_EMPUJADA_PX : ALTO_CABEZA_PX;
  return (
    <div
      className={cn("hoja", className)}
      data-propia=""
      style={{ "--ventana": `${ventana}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
