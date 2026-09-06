"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { NavBar } from "@/components/nav-bar";

/**
 * Decide, por ruta, si se muestra la barra de navegación (§2). La exclusión de
 * `/sesion` y `/sesion/cerrar` no es negociable: ahí el alto vale más y no hay a
 * dónde navegar durante el registro.
 *
 * La reserva de espacio para la barra fija la hace el CSS: `[data-nav] main`
 * añade padding-bottom del alto de la barra, así el contenido no queda tapado al
 * final del scroll (criterio 7). El wrapper es `display:contents` — no genera
 * caja, solo cuelga el atributo del que descuelga el `<main>` de la pantalla.
 */
const SIN_BARRA = new Set(["/sesion", "/sesion/cerrar"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const conBarra = !SIN_BARRA.has(pathname);

  return (
    <>
      <div className="contents" data-nav={conBarra ? "" : undefined}>
        {children}
      </div>
      {conBarra && <NavBar pathname={pathname} />}
    </>
  );
}
