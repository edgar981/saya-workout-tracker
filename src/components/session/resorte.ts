/**
 * Resortes y pager de Sesión (SAYA-R2-4). Puro: sin React ni DOM. Es la física de
 * la maqueta de la ronda 2 (`Spr`, `project`, `rb`, `pager`), a mano y sin
 * dependencias: lo usan el pager de ejercicios y el dial de cifras.
 */

export interface OpcionesResorte {
  /** 1 = crítico (sin rebote); menos de 1 rebota un poco. */
  damping?: number;
  /** Segundos que tarda en llegar. */
  response?: number;
  /** Umbral de «quieto»: posición dentro de `eps`, velocidad dentro de `eps`·10. */
  eps?: number;
}

export interface PasoResorte {
  x: number;
  v: number;
  /** true cuando ya está en el destino: `x` es entonces exactamente `t`. */
  quieto: boolean;
}

const SUBPASO = 1 / 240;
const DT_MAX = 0.064;

/** Un paso del resorte: `x` va hacia `t` con velocidad `v` durante `dt` segundos. */
export function resorte(
  x: number,
  v: number,
  t: number,
  dt: number,
  { damping = 1, response = 0.35, eps = 0.3 }: OpcionesResorte = {},
): PasoResorte {
  const k = ((2 * Math.PI) / response) ** 2;
  const c = (4 * Math.PI * damping) / response;
  let resto = Math.min(Math.max(dt, 0), DT_MAX);
  let px = x;
  let pv = v;
  while (resto > 1e-9) {
    const h = Math.min(SUBPASO, resto);
    pv += (k * (t - px) - c * pv) * h;
    px += pv * h;
    resto -= h;
  }
  if (Math.abs(px - t) < eps && Math.abs(pv) < eps * 10) {
    return { x: t, v: 0, quieto: true };
  }
  return { x: px, v: pv, quieto: false };
}

/** Hasta dónde llegaría `v` (px/s) si se frenara por rozamiento `d`, en px. */
export function proyectar(v: number, d = 0.998): number {
  return ((v / 1000) * d) / (1 - d);
}

/** El rubber-band de los extremos: `o` es el exceso, `d` el ancho, `c` la dureza. */
export function goma(o: number, d: number, c = 0.55): number {
  return (o * d * c) / (d + c * Math.abs(o));
}

/** A qué tarjeta va el pager al soltar: nunca salta más de una. */
export function destinoPager({
  x,
  vx,
  ancho,
  indice,
  total,
}: {
  x: number;
  vx: number;
  ancho: number;
  indice: number;
  total: number;
}): number {
  if (ancho <= 0 || total <= 0) return 0;
  const crudo = Math.round(-(x + proyectar(vx)) / ancho);
  const min = Math.max(0, indice - 1);
  const max = Math.min(total - 1, indice + 1);
  return Math.min(max, Math.max(min, crudo));
}

/** Un lanzamiento rápido rebota un poco; uno lento llega sin rebote. */
export function dampingDe(v: number): number {
  return Math.abs(v) > 300 ? 0.86 : 1;
}
