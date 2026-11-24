import { useSyncExternalStore } from "react";

import {
  EPS_BARRA,
  RESPUESTA_MOSTRAR,
  RESPUESTA_TAMANO,
  crearResorte,
  destinoDe,
  entornoNavegador,
  lerp,
  pintarBarra,
  terminarResortes,
  type EstadoBarra,
  type Resorte,
} from "@/lib/barra";

/**
 * El store cliente de la barra de abajo (SAYA-R2-2). Es el contrato con la hoja de
 * Hoy (SAYA-R2-3): estos nombres y firmas no cambian. El estado, los dos resortes
 * (mostrar y tamaño) y el elemento registrado son del módulo; los resortes se
 * crean al primer uso, no al importar.
 */

let estado: EstadoBarra = "oculta";
let elemento: HTMLElement | null = null;
let ultimoCambio = 0;
let mostrar: Resorte | null = null;
let tamano: Resorte | null = null;
let hayOyenteVisibilidad = false;
const suscritos = new Set<() => void>();

// Lo que guardó `empezarConducir`.
let previo: EstadoBarra = "oculta";
let s0 = 0;
let k0 = 0;
let enConduccion = false;

export function movimientoReducido(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pintar() {
  const el = elemento;
  if (!el || !mostrar || !tamano) return;
  const { ty, escala, opacidad, oculta } = pintarBarra(mostrar.x, tamano.x, movimientoReducido());
  el.style.transform = "translate3d(0," + ty.toFixed(2) + "px,0) scale(" + escala.toFixed(4) + ")";
  // La opacidad va en los hijos, nunca en el elemento: un ancestro con opacidad
  // menor que 1 corta el desenfoque de la barra.
  for (const hijo of Array.from(el.children)) {
    (hijo as HTMLElement).style.opacity = opacidad === null ? "" : opacidad.toFixed(3);
  }
  el.toggleAttribute("data-oculta", oculta);
  el.inert = oculta;
}

function resortes(): { mostrar: Resorte; tamano: Resorte } {
  if (!mostrar) {
    mostrar = crearResorte(pintar, {
      respuesta: RESPUESTA_MOSTRAR,
      eps: EPS_BARRA,
      reducido: movimientoReducido,
    });
  }
  if (!tamano) {
    tamano = crearResorte(pintar, {
      respuesta: RESPUESTA_TAMANO,
      eps: EPS_BARRA,
      reducido: movimientoReducido,
    });
  }
  return { mostrar, tamano };
}

export function leerBarra(): EstadoBarra {
  return estado;
}

export function suscribirBarra(cb: () => void): () => void {
  suscritos.add(cb);
  return () => {
    suscritos.delete(cb);
  };
}

export function usarBarra(): EstadoBarra {
  // `usarBarra` es un hook; su nombre es el del contrato con SAYA-R2-3.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSyncExternalStore(suscribirBarra, leerBarra, () => "oculta" as EstadoBarra);
}

export function ultimoCambioBarra(): number {
  return ultimoCambio;
}

/** Sin transición: `data-snap` se pone, se pinta, se fuerza el reflow y se quita. */
function aplicarAhora(e: EstadoBarra) {
  const r = resortes();
  const d = destinoDe(e);
  const t = d.tamano ?? r.tamano.destino;
  elemento?.toggleAttribute("data-snap", true);
  r.mostrar.poner(d.mostrar);
  r.tamano.poner(t);
  pintar();
  if (elemento) void elemento.offsetWidth;
  elemento?.toggleAttribute("data-snap", false);
}

export function ponerBarra(e: EstadoBarra, op?: { ahora?: boolean; v?: number }): void {
  const r = resortes();
  if (op?.ahora) {
    aplicarAhora(e);
  } else {
    const d = destinoDe(e);
    const t = d.tamano ?? r.tamano.destino;
    if (d.mostrar === 1 && r.mostrar.x < 0.02) r.tamano.poner(t);
    else r.tamano.ir(t);
    r.mostrar.ir(d.mostrar, { v: op?.v });
  }
  ultimoCambio = entornoNavegador.ahora();
  if (e !== estado) {
    estado = e;
    for (const cb of [...suscritos]) cb();
  }
}

export function registrarBarra(el: HTMLElement): () => void {
  elemento = el;
  resortes();
  aplicarAhora(estado);
  if (!hayOyenteVisibilidad && typeof document !== "undefined") {
    hayOyenteVisibilidad = true;
    // Una pestaña escondida congela rAF: al cambiar la visibilidad, todo llega.
    document.addEventListener("visibilitychange", () => terminarResortes());
  }
  return () => {
    if (elemento === el) elemento = null;
  };
}

export function empezarConducir(desdeArriba: boolean): void {
  const r = resortes();
  r.mostrar.parar();
  r.tamano.parar();
  if (desdeArriba) {
    previo = estado === "llena" ? "oculta" : estado;
    s0 = previo === "oculta" ? 0 : 1;
    k0 = 0;
  }
  enConduccion = true;
}

/** `p` de 0 (hoja arriba) a 1 (hoja abajo). */
export function conducirBarra(p: number): void {
  const r = resortes();
  r.mostrar.parar();
  r.tamano.parar();
  r.mostrar.poner(Math.max(s0, p));
  r.tamano.poner(lerp(k0, 1, p));
  pintar();
}

export function soltarBarra(abajo: boolean): void {
  enConduccion = false;
  ponerBarra(abajo ? "llena" : previo);
}

export function conduciendo(): boolean {
  return enConduccion;
}

/** El borde de arriba de la barra llena, en coordenadas de la ventana, sin la transformación. */
export function arribaBarraLlena(): number {
  const alto = globalThis.innerHeight;
  if (!elemento) return alto - 74;
  return alto - parseFloat(globalThis.getComputedStyle(elemento).bottom) - elemento.offsetHeight;
}
