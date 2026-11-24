import { clamp, elastico, proyectar, RUEDA_VENTANA_MS } from "@/lib/barra";
import { formatHace } from "@/lib/hoy";

/**
 * Las reglas PURAS de la hoja de Hoy y de la hoja del día (SAYA-R2-3). Sin React ni
 * `window` al importar: cada número sale de `wireHoy`, `openSheet` / `closeSheet` y
 * `spark` de la maqueta de la ronda 2.
 */

/* ── La hoja de Hoy (wireHoy) ── */
export const RESPUESTA_HOJA = 0.36;
export const EPS_HOJA = 0.3;
export const MIN_BAJA_PX = 140;
export const MARGEN_BARRA_PX = 16;
export const UMBRAL_TOQUE_PX = 8;
export const FLICK_PX_S = 300;
export const AMORTIGUACION_FLICK = 0.86;
export const RUEDA_HOJA_PX = 20;
export const RUEDA_BLOQUEO_MS = 600;

/* ── La hoja del día (openSheet / closeSheet) ── */
export const RESPUESTA_DIA = 0.42;
export const UMBRAL_DIA_PX = 6;
export const CIERRE_FRACCION = 0.45;
export const CIERRE_VY_MIN = -60;
export const AMORTIGUACION_VUELTA = 0.85;
export const MARGEN_CIERRE_PX = 24;
export const ALTO_DIA_POR_OMISION = 400;
export const FUNDIDO_CIERRE_MS = 190;

/* ── La línea del peso (spark) ── */
export const SPARK_W = 120;
export const SPARK_H = 26;
export const SPARK_N = 12;

/** Y: cuánto baja la hoja. `abajoPrimera` = borde de abajo de la primera tesela con la hoja arriba. */
export function alturaBaja(arribaBarra: number, abajoPrimera: number): number {
  return Math.max(MIN_BAJA_PX, arribaBarra - MARGEN_BARRA_PX - abajoPrimera);
}

/** Lo que sigue al dedo: elástico por encima de 0 y por debajo de Y (follow). */
export function seguirHoja(y: number, Y: number): number {
  if (y < 0) return -elastico(-y, Y);
  if (y > Y) return Y + elastico(y - Y, Y);
  return y;
}

/** Al soltar (release). */
export function decidirSoltar(
  x: number,
  vy: number,
  Y: number,
): { baja: boolean; amortiguacion: number } {
  if (Math.abs(vy) > FLICK_PX_S) return { baja: vy > 0, amortiguacion: AMORTIGUACION_FLICK };
  return { baja: x + proyectar(vy) > Y / 2, amortiguacion: 1 };
}

export function progresoHoja(y: number, Y: number): number {
  return clamp(y / Y, 0, 1);
}

/** Lo que `paint` escribe. */
export function pintarHoja(
  y: number,
  Y: number,
): { transform: string; opacidad: string; oculta: boolean } {
  const p = progresoHoja(y, Y);
  return {
    transform: Math.abs(y) > 0.01 ? "translate3d(0," + y.toFixed(2) + "px,0)" : "",
    opacidad: p > 0.001 ? (1 - p).toFixed(3) : "",
    oculta: p >= 0.999,
  };
}

/** ¿El dedo se queda con el gesto? dx, dy desde el toque; scrollY = window.scrollY. */
export function reclamaToque(
  dx: number,
  dy: number,
  baja: boolean,
  scrollY: number,
): "espera" | "muerto" | "mia" {
  if (Math.hypot(dx, dy) < UMBRAL_TOQUE_PX) return "espera";
  if (Math.abs(dx) > Math.abs(dy) || !(baja || (scrollY <= 0 && dy > 0))) return "muerto";
  return "mia";
}

export interface MemoriaRuedaHoja {
  wa: number;
  tUlt: number;
  bloqueo: number;
}
export const MEMORIA_RUEDA_HOJA: MemoriaRuedaHoja = { wa: 0, tUlt: -1e9, bloqueo: -1e9 };

/** La rueda de `wireHoy` sin temporizador: la suma se reinicia por la hora del evento. */
export function reglaRuedaHoja(
  m: MemoriaRuedaHoja,
  e: { deltaY: number; scrollY: number; baja: boolean; ahora: number },
): { memoria: MemoriaRuedaHoja; consume: boolean; accion: "bajar" | "subir" | null } {
  if (!(e.baja || (e.scrollY <= 0 && e.deltaY < 0))) {
    return { memoria: m, consume: false, accion: null };
  }
  if (e.ahora - m.bloqueo < RUEDA_BLOQUEO_MS) {
    return { memoria: m, consume: true, accion: null };
  }
  const wa = e.ahora - m.tUlt > RUEDA_VENTANA_MS ? e.deltaY : m.wa + e.deltaY;
  if (!e.baja && wa < -RUEDA_HOJA_PX) {
    return { memoria: { wa: 0, tUlt: e.ahora, bloqueo: e.ahora }, consume: true, accion: "bajar" };
  }
  if (e.baja && wa > RUEDA_HOJA_PX) {
    return { memoria: { wa: 0, tUlt: e.ahora, bloqueo: e.ahora }, consume: true, accion: "subir" };
  }
  return { memoria: { wa, tUlt: e.ahora, bloqueo: m.bloqueo }, consume: true, accion: null };
}

/* ── La hoja del día ── */
export function cierraDia(x: number, vy: number, H: number): boolean {
  return x + proyectar(vy) > H * CIERRE_FRACCION && vy > CIERRE_VY_MIN;
}

export function seguirDia(y: number, H: number): number {
  return y < 0 ? -elastico(-y, H) : y;
}

/* ── Las teclas de los días ── */
export function valorDia(dias: number | undefined, abierta: boolean, corto: boolean): string {
  if (abierta) return "abierta";
  if (dias === undefined) return "nunca";
  if (!corto) return formatHace(dias);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `${dias} d`;
}

/** El trazo de la línea del peso, o null con menos de dos valores. */
export function puntosSpark(vals: readonly number[], w: number, h: number): string | null {
  const n = vals.length;
  if (n < 2) return null;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const r = mx - mn || 1;
  const pts = vals.map(
    (v, i) => ((i / (n - 1)) * w).toFixed(1) + "," + (h - 2 - ((v - mn) / r) * (h - 4)).toFixed(1),
  );
  return "M" + pts.join("L");
}
