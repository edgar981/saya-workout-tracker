"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { movimientoReducido } from "@/components/barra-estado";
import { Liquido } from "@/components/liquido";
import { NavBar } from "@/components/nav-bar";
import { esRutaSesion } from "@/lib/liquido";
import {
  accionAtras,
  nivelDeRuta,
  normalizarRuta,
  siguientePila,
  type Como,
} from "@/lib/navegacion";

/**
 * Apilado (de atrás hacia delante): el lienzo y el póster · la hoja (que
 * envuelve a las pantallas; si la pantalla pinta la suya, la envoltura no es
 * caja) · el velo superior · la barra de abajo o la píldora de atrás.
 *
 * La navegación de las áreas es la barra de abajo (nav-bar.tsx), fija y encima de
 * la hoja; la hoja de un área deja abajo espacio para ella (globals.css,
 * `[data-area]`). En `/sesion` y `/sesion/cerrar` no se monta (nivel `sesion`).
 * Las reglas de nivel, de «‹» y de la pila son puras, en `lib/navegacion.ts`; el
 * shell sólo lleva la pila en estado de React.
 */

/**
 * Ventana de cromo PROVISIONAL: lo que queda libre arriba de la hoja del shell,
 * para las pantallas que todavía no pintan su `Cabeza` (ui/hoja.tsx). Las que sí
 * pintan la suya y su `Hoja` no la usan: la regla U de
 * globals.css hace que la envoltura del shell deje de ser caja para ellas.
 */
const VENTANA_CROMO_PX = 120;
/** En `/sesion` y `/sesion/cerrar` la hoja empieza a 12px del borde. */
const VENTANA_SESION_PX = 12;
/** El velo superior aparece cuando el scroll de la página pasa de esto. */
const UMBRAL_VELO_PX = 140;

/** `?desde=cierre` se lee de `window.location` (no `useSearchParams`, que exige
 *  un `Suspense` en `next build`); en servidor es vacío. */
const sinSuscripcion = () => () => {};
const leerBusqueda = () => window.location.search;
const busquedaServidor = () => "";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = normalizarRuta(usePathname());
  const router = useRouter();
  const nivel = nivelDeRuta(pathname);
  const sesion = nivel === "sesion" || esRutaSesion(pathname);
  const veloRef = useRef<HTMLDivElement>(null);
  const busqueda = useSyncExternalStore(sinSuscripcion, leerBusqueda, busquedaServidor);

  // La pila de rutas. `como` dice cómo llegó la próxima: el atrás del navegador
  // la marca `pop` (popstate), la píldora cuando vacía la marca `reset`; todo lo
  // demás es `push`. Una recarga empieza en `[ruta]`: es frío.
  const [como, setComo] = useState<Como>("push");
  const [pila, setPila] = useState({ ruta: pathname, rutas: [pathname] });
  if (pila.ruta !== pathname) {
    setPila({ ruta: pathname, rutas: siguientePila(pila.rutas, pathname, como) });
    if (como !== "push") setComo("push");
  }

  useEffect(() => {
    const alPop = () => setComo((c) => (c === "reset" ? c : "pop"));
    window.addEventListener("popstate", alPop);
    return () => window.removeEventListener("popstate", alPop);
  }, []);

  // De un área a otra el contenido entra con un fundido (`area-entra`), no en la
  // primera pintura ni con movimiento reducido.
  const hojaRef = useRef<HTMLDivElement>(null);
  const antesRef = useRef<{ pathname: string; nivel: string } | null>(null);
  useEffect(() => {
    const antes = antesRef.current;
    antesRef.current = { pathname, nivel };
    if (!antes || antes.nivel !== "area" || nivel !== "area" || antes.pathname === pathname) return;
    if (movimientoReducido()) return;
    const el = hojaRef.current;
    if (!el) return;
    el.removeAttribute("data-entra");
    void el.offsetWidth;
    el.setAttribute("data-entra", "");
    const quitar = () => el.removeAttribute("data-entra");
    const alFin = (e: AnimationEvent) => {
      if (e.animationName === "area-entra") quitar();
    };
    el.addEventListener("animationend", alFin);
    const t = setTimeout(quitar, 250);
    return () => {
      el.removeEventListener("animationend", alFin);
      clearTimeout(t);
      el.removeAttribute("data-entra");
    };
  }, [pathname, nivel]);

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

  const atras = accionAtras(pathname, busqueda, pila.rutas);

  function alAtras() {
    // La búsqueda se lee al tocar: es la de la URL de ahora.
    const a = accionAtras(pathname, window.location.search, pila.rutas);
    if (a.vaciar) setComo("reset");
    if (a.modo === "replace") router.replace(a.destino);
    else if (a.modo === "back") router.back();
    else router.push(a.destino);
  }

  const estiloHoja = {
    "--ventana": `${sesion ? VENTANA_SESION_PX : VENTANA_CROMO_PX}px`,
    ...(sesion ? { "--hoja-pb": "env(safe-area-inset-bottom)" } : null),
  } as CSSProperties;

  return (
    <>
      <Liquido />
      <div
        ref={hojaRef}
        className="hoja"
        data-area={nivel === "area" ? "" : undefined}
        style={estiloHoja}
      >
        {children}
      </div>
      {!sesion && <div ref={veloRef} className="tscrim" aria-hidden="true" />}
      {nivel !== "sesion" && (
        <NavBar pathname={pathname} nivel={nivel} etiqueta={atras.etiqueta} alAtras={alAtras} />
      )}
    </>
  );
}
