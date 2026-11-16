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

import { Liquido } from "@/components/liquido";
import { NavBar } from "@/components/nav-bar";
import { BotonAjustes } from "@/components/ui/hoja";
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
 * envuelve a las pantallas) · el velo superior · pestañas de vidrio o píldora.
 *
 * La navegación vive ARRIBA (nav-bar.tsx) y no reserva espacio abajo: la hoja
 * llega al borde de abajo. En `/sesion` y `/sesion/cerrar` no se monta ninguna
 * (nivel `sesion`). Las reglas de nivel, de «‹» y de la pila son puras, en
 * `lib/navegacion.ts`; el shell sólo lleva la pila en estado de React.
 */

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

/**
 * Rutas que pintan su PROPIA `Cabeza` y su `Hoja`: el shell no las envuelve. Los
 * slices 3 a 5 agregan las suyas.
 */
const RUTAS_CON_CABEZA_PROPIA = new Set(["/cuerpo"]);

/**
 * PROVISIONAL: Hoy conserva su encabezado propio hasta el slice 3, así que el
 * shell pinta el botón de Ajustes en `/` dentro de la ventana de cromo (absoluto
 * en la página: se va con el scroll). El slice 3 lo pasa a la `Cabeza` de Hoy y
 * borra esta constante.
 */
const AJUSTES_HOY_TOP_PX = 70;
const AJUSTES_HOY_RIGHT_PX = 20;

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

  const propia = RUTAS_CON_CABEZA_PROPIA.has(pathname);
  const estiloHoja = {
    "--ventana": `${sesion ? VENTANA_SESION_PX : VENTANA_CROMO_PX}px`,
    ...(sesion ? { "--hoja-pb": "env(safe-area-inset-bottom)" } : null),
  } as CSSProperties;

  return (
    <>
      <Liquido />
      {propia ? (
        children
      ) : (
        <div className="hoja" style={estiloHoja}>
          {children}
        </div>
      )}
      {pathname === "/" && (
        <BotonAjustes
          className="absolute z-[35]"
          style={{
            top: `calc(${AJUSTES_HOY_TOP_PX}px + env(safe-area-inset-top))`,
            right: AJUSTES_HOY_RIGHT_PX,
          }}
        />
      )}
      {!sesion && <div ref={veloRef} className="tscrim" aria-hidden="true" />}
      {nivel !== "sesion" && (
        <NavBar pathname={pathname} nivel={nivel} etiqueta={atras.etiqueta} alAtras={alAtras} />
      )}
    </>
  );
}
