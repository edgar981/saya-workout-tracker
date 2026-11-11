import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeza de pantalla (§3): la ventana de cromo entre el borde de arriba y el
 * borde de la hoja. El texto va sobre un velo (`.cabeza::before`, en globals.css)
 * que sangra hasta los bordes de pantalla. Un título (`h1`) y un subtítulo
 * opcional. Sin botón de Ajustes ni de atrás: son del slice 2.
 *
 * `empujada`: pantallas a las que se llega desde otra (relleno superior 76, alto
 * mínimo 196, título 27/31).
 */
export function Cabeza({
  titulo,
  subtitulo,
  empujada = false,
  className,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  empujada?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("cabeza", className)} data-empujada={empujada ? "" : undefined}>
      <h1 className="cabeza-titulo">{titulo}</h1>
      {subtitulo != null && <p className="cabeza-sub mt-2">{subtitulo}</p>}
    </header>
  );
}
