"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Liquido } from "@/components/liquido";
import { NavBar } from "@/components/nav-bar";
import { esRutaSesion } from "@/lib/liquido";

/**
 * Decide, por ruta, si se muestra la barra de navegación (§2). La exclusión de
 * `/sesion` y `/sesion/cerrar` no es negociable: ahí el alto vale más y no hay a
 * dónde navegar durante el registro.
 *
 * La reserva de espacio para la barra fija la hace el CSS: `[data-nav] main`
 * añade padding-bottom del alto de la barra, así el contenido no queda tapado al
 * final del scroll (criterio 7). El wrapper es `display:contents` — no genera
 * caja, solo cuelga el atributo del que descuelga el `<main>` de la pantalla.
 *
 * Apilado (de atrás hacia delante): el lienzo y el póster · la hoja (que
 * envuelve a las pantallas) · el velo superior · la barra de hoy.
 */
const SIN_BARRA = new Set(["/sesion", "/sesion/cerrar"]);

/**
 * Ventana de cromo PROVISIONAL: lo que queda libre arriba de la hoja. Hoy cada
 * pantalla sigue con su encabezado propio dentro de la hoja; los slices 3 a 5 la
 * reemplazan por `Cabeza` (ui/hoja.tsx) pantalla por pantalla.
 */
const VENTANA_CROMO_PX = 120;
/** En `/sesion` y `/sesion/cerrar` la hoja empieza a 12px del borde. */
const VENTANA_SESION_PX = 12;
/** El velo superior aparece cuando el scroll de la página pasa de esto. */
const UMBRAL_VELO_PX = 140;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const conBarra = !SIN_BARRA.has(pathname);
  const sesion = esRutaSesion(pathname);
  const veloRef = useRef<HTMLDivElement>(null);

  // Velo `.tscrim`: se prende por atributo (sin re-render en cada evento).
  useEffect(() => {
    if (sesion) return;
    const alScroll = () => {
      const velo = veloRef.current;
      if (!velo) return;
      if (window.scrollY > UMBRAL_VELO_PX) velo.setAttribute("data-on", "");
      else velo.removeAttribute("data-on");
    };
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, [sesion]);

  const estiloHoja = {
    "--ventana": `${sesion ? VENTANA_SESION_PX : VENTANA_CROMO_PX}px`,
  } as CSSProperties;

  return (
    <>
      <Liquido />
      <div className="contents" data-nav={conBarra ? "" : undefined}>
        <div className="hoja" style={estiloHoja}>
          {children}
        </div>
      </div>
      {!sesion && <div ref={veloRef} className="tscrim" aria-hidden="true" />}
      {conBarra && <NavBar pathname={pathname} />}
    </>
  );
}
