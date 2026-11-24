/**
 * La barra de abajo (SAYA-R2-2): resortes y reglas, PUROS. Sin React ni acceso al
 * navegador al importar; todo lo que decide vive aquí para probarlo en `node`.
 *
 * Regla del owner: una pestaña escondida congela `requestAnimationFrame`, y la
 * barra tiene que llegar a su estado final igual. Por eso (a) cada resorte es una
 * función cerrada del tiempo (`resorteEn`, sin integrar cuadro a cuadro), (b) cada
 * resorte en marcha tiene un temporizador de guardia que lo termina, (c) al
 * cambiar la visibilidad se terminan todos (`terminarResortes`) y (d) un resorte
 * que arranca con la pestaña oculta salta al destino.
 */

export type EstadoBarra = "oculta" | "recogida" | "llena";

/** La barra recogida: escala .84 (la proporción de Instagram). */
export const ESCALA_RECOGIDA = 0.84;
/** Cuánto baja la barra oculta. */
export const DESLIZ_PX = 98;
export const RESPUESTA_MOSTRAR = 0.32;
export const RESPUESTA_TAMANO = 0.3;
export const RESPUESTA_PASTILLA = 0.35;
export const EPS_BARRA = 0.002;
/** Tras un cambio de estado, el scroll no cambia otro. */
export const ESPERA_MS = 450;
export const SCROLL_SUBE_PX = 24;
export const SCROLL_BAJA_PX = 12;
export const SCROLL_MIN_Y_PX = 40;
export const RUEDA_PX = 20;
export const RUEDA_VENTANA_MS = 200;
export const TIRON_PX = 24;
export const UMBRAL_ARRASTRE_PX = 10;
/** La velocidad cuenta sólo si la última muestra es así de reciente. */
export const MUESTRA_VIGENTE_MS = 80;

/* ───────────────────────── el resorte cerrado ───────────────────────── */

export interface Movimiento {
  x0: number;
  v0: number;
  destino: number;
  /** r, en segundos. */
  respuesta: number;
  /** ζ; por omisión 1. */
  amortiguacion?: number;
}

/**
 * Solución exacta de la ecuación de la maqueta (k = (2π/r)², c = 4π·ζ/r): pulsación
 * ω = 2π/r y amortiguación relativa ζ.
 */
export function resorteEn(m: Movimiento, t: number): { x: number; v: number } {
  const zeta = m.amortiguacion ?? 1;
  const w = (2 * Math.PI) / m.respuesta;
  const A = m.x0 - m.destino;
  if (zeta >= 1) {
    const B = m.v0 + w * A;
    const e = Math.exp(-w * t);
    return { x: m.destino + (A + B * t) * e, v: (B - w * (A + B * t)) * e };
  }
  const a = zeta * w;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const C = (m.v0 + a * A) / wd;
  const e = Math.exp(-a * t);
  const cos = Math.cos(wd * t);
  const sin = Math.sin(wd * t);
  return {
    x: m.destino + e * (A * cos + C * sin),
    v: e * (m.v0 * cos - (a * C + wd * A) * sin),
  };
}

export function asentado(x: number, v: number, destino: number, eps: number): boolean {
  return Math.abs(x - destino) < eps && Math.abs(v) < eps * 10;
}

/** `project` de la maqueta. */
export function proyectar(v: number, d = 0.998): number {
  return ((v / 1000) * d) / (1 - d);
}

/** `rb` de la maqueta: el elástico del borde. */
export function elastico(o: number, d: number, c = 0.55): number {
  return (o * d * c) / (d + c * Math.abs(o));
}

export function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ───────────────────────── el entorno y el resorte vivo ───────────────────────── */

export interface Entorno {
  /** ms */
  ahora(): number;
  /** rAF. Devuelve `null` si no hay cuadros (servidor). */
  cuadro(cb: () => void): unknown;
  cancelarCuadro(id: unknown): void;
  /** setTimeout */
  temporizador(cb: () => void, ms: number): unknown;
  cancelarTemporizador(id: unknown): void;
  /** document.hidden */
  oculto(): boolean;
}

/** Lee el navegador en CADA llamada, nunca al importar. */
export const entornoNavegador: Entorno = {
  ahora() {
    return typeof globalThis.performance !== "undefined" ? globalThis.performance.now() : Date.now();
  },
  cuadro(cb) {
    return typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame(() => cb())
      : null;
  },
  cancelarCuadro(id) {
    if (typeof globalThis.cancelAnimationFrame === "function" && typeof id === "number") {
      globalThis.cancelAnimationFrame(id);
    }
  },
  temporizador(cb, ms) {
    return setTimeout(cb, ms);
  },
  cancelarTemporizador(id) {
    clearTimeout(id as ReturnType<typeof setTimeout>);
  },
  oculto() {
    return typeof document !== "undefined" ? document.hidden : false;
  },
};

export interface Resorte {
  readonly x: number;
  readonly v: number;
  readonly destino: number;
  enMarcha(): boolean;
  ir(destino: number, op?: { v?: number; amortiguacion?: number; listo?: () => void }): void;
  /** x, v = 0, destino = x; para y pinta. */
  poner(x: number): void;
  /** Se queda donde está ahora, con su velocidad. */
  parar(): void;
  /** Salta al destino, pinta y llama `listo`. */
  terminar(): void;
}

const enMarcha = new Set<Resorte>();

export function crearResorte(
  pintar: (x: number, v: number) => void,
  op: { respuesta: number; amortiguacion?: number; eps?: number; reducido?: () => boolean },
  entorno: Entorno = entornoNavegador,
): Resorte {
  const eps = op.eps ?? 0.3;
  let x = 0;
  let v = 0;
  let destino = 0;
  let corre = false;
  let mov: Movimiento = { x0: 0, v0: 0, destino: 0, respuesta: op.respuesta };
  let t0 = 0;
  let cuadroId: unknown = null;
  let hayCuadro = false;
  let guardiaId: unknown = null;
  let hayGuardia = false;
  let listo: (() => void) | undefined;

  function ahoraEn(): { x: number; v: number } {
    const t = Math.max(0, (entorno.ahora() - t0) / 1000);
    return resorteEn(mov, t);
  }

  function cancelar() {
    if (hayCuadro) entorno.cancelarCuadro(cuadroId);
    if (hayGuardia) entorno.cancelarTemporizador(guardiaId);
    hayCuadro = false;
    hayGuardia = false;
    cuadroId = null;
    guardiaId = null;
  }

  function llamarListo() {
    const f = listo;
    listo = undefined;
    f?.();
  }

  function saltar() {
    cancelar();
    corre = false;
    enMarcha.delete(self);
    x = destino;
    v = 0;
    pintar(x, v);
    llamarListo();
  }

  function pedirCuadro(): boolean {
    const id = entorno.cuadro(alCuadro);
    if (id === null) return false;
    cuadroId = id;
    hayCuadro = true;
    return true;
  }

  function alCuadro() {
    hayCuadro = false;
    cuadroId = null;
    if (!corre) return;
    const e = ahoraEn();
    if (asentado(e.x, e.v, destino, eps)) {
      saltar();
      return;
    }
    x = e.x;
    v = e.v;
    pintar(x, v);
    if (!pedirCuadro()) saltar();
  }

  const self: Resorte = {
    get x() {
      return corre ? ahoraEn().x : x;
    },
    get v() {
      return corre ? ahoraEn().v : v;
    },
    get destino() {
      return destino;
    },
    enMarcha: () => corre,
    ir(d, o) {
      if (corre) {
        const e = ahoraEn();
        x = e.x;
        v = e.v;
      }
      cancelar();
      const v0 = o?.v ?? v;
      destino = d;
      listo = o?.listo;
      if (op.reducido?.() || entorno.oculto() || asentado(x, v0, d, eps)) {
        saltar();
        return;
      }
      mov = { x0: x, v0, destino: d, respuesta: op.respuesta, amortiguacion: o?.amortiguacion ?? op.amortiguacion };
      t0 = entorno.ahora();
      corre = true;
      enMarcha.add(self);
      if (!pedirCuadro()) {
        saltar();
        return;
      }
      guardiaId = entorno.temporizador(() => {
        hayGuardia = false;
        guardiaId = null;
        saltar();
      }, Math.ceil(op.respuesta * 4000) + 100);
      hayGuardia = true;
    },
    poner(nx) {
      cancelar();
      corre = false;
      enMarcha.delete(self);
      listo = undefined;
      x = nx;
      v = 0;
      destino = nx;
      pintar(x, v);
    },
    parar() {
      if (corre) {
        const e = ahoraEn();
        x = e.x;
        v = e.v;
      }
      cancelar();
      corre = false;
      enMarcha.delete(self);
    },
    terminar() {
      if (!corre) return;
      saltar();
    },
  };
  return self;
}

/** Termina todos los resortes en marcha; repite porque un `listo` puede arrancar otro. */
export function terminarResortes(): void {
  for (let pasada = 0; pasada < 10 && enMarcha.size > 0; pasada++) {
    for (const r of [...enMarcha]) r.terminar();
  }
}

/* ───────────────────────── qué pinta la barra ───────────────────────── */

export function destinoDe(e: EstadoBarra): { mostrar: 0 | 1; tamano: 0 | 1 | null } {
  if (e === "oculta") return { mostrar: 0, tamano: null };
  if (e === "recogida") return { mostrar: 1, tamano: 0 };
  return { mostrar: 1, tamano: 1 };
}

export function pintarBarra(
  mostrar: number,
  tamano: number,
  reducido: boolean,
): { ty: number; escala: number; opacidad: number | null; oculta: boolean } {
  const s = clamp(mostrar, 0, 1);
  return {
    ty: reducido ? 0 : (1 - s) * DESLIZ_PX,
    escala: lerp(ESCALA_RECOGIDA, 1, tamano),
    opacidad: s < 0.999 ? s : null,
    oculta: s <= 0.001,
  };
}

/* ───────────────────────── las reglas del scroll ───────────────────────── */

export interface MemoriaScroll {
  y0: number;
  acc: number;
}

export function reglaScroll(
  m: MemoriaScroll,
  e: { y: number; max: number; ahora: number; ultimoCambio: number; estado: EstadoBarra },
): { memoria: MemoriaScroll; poner: EstadoBarra | null } {
  const d = e.y - m.y0;
  if (e.y < 0 || e.y > e.max || d === 0) {
    return { memoria: { y0: e.y, acc: m.acc }, poner: null };
  }
  let acc = Math.sign(d) !== Math.sign(m.acc) ? d : m.acc + d;
  let poner: EstadoBarra | null = null;
  if (e.estado !== "llena" && e.ahora - e.ultimoCambio >= ESPERA_MS) {
    if (acc < -SCROLL_SUBE_PX && e.estado === "oculta") {
      poner = "recogida";
      acc = 0;
    } else if (acc > SCROLL_BAJA_PX && e.y > SCROLL_MIN_Y_PX && e.estado !== "oculta") {
      poner = "oculta";
      acc = 0;
    }
  }
  return { memoria: { y0: e.y, acc }, poner };
}

export interface MemoriaRueda {
  wa: number;
  tUlt: number;
}

export function reglaRueda(
  m: MemoriaRueda,
  e: { deltaY: number; scrollTop: number; ahora: number; ultimoCambio: number; estado: EstadoBarra },
): { memoria: MemoriaRueda; poner: EstadoBarra | null } {
  if (!(e.scrollTop <= 0 && e.deltaY < 0 && e.estado === "oculta")) {
    return { memoria: m, poner: null };
  }
  let wa = e.ahora - m.tUlt > RUEDA_VENTANA_MS ? e.deltaY : m.wa + e.deltaY;
  let poner: EstadoBarra | null = null;
  if (wa < -RUEDA_PX && e.ahora - e.ultimoCambio > ESPERA_MS) {
    poner = "recogida";
    wa = 0;
  }
  return { memoria: { wa, tUlt: e.ahora }, poner };
}

export function inicioTiron(scrollTop: number, clientY: number): number | null {
  return scrollTop <= 0 ? clientY : null;
}

export function reglaTiron(
  ty0: number | null,
  clientY: number,
  estado: EstadoBarra,
): EstadoBarra | null {
  return ty0 !== null && estado === "oculta" && clientY - ty0 > TIRON_PX ? "recogida" : null;
}

/* ───────────────────────── los arrastres ───────────────────────── */

export interface Muestra {
  x: number;
  y: number;
  t: number;
}

/** Guarda las seis últimas. */
export function agregarMuestra(ms: readonly Muestra[], m: Muestra): Muestra[] {
  return [...ms, m].slice(-6);
}

export function ejeDe(dx: number, dy: number, umbral: number): "x" | "y" | null {
  if (Math.hypot(dx, dy) < umbral) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/** px/s */
export function velocidad(ms: readonly Muestra[], ahora: number): { vx: number; vy: number } {
  if (ms.length < 2) return { vx: 0, vy: 0 };
  const a = ms[0];
  const b = ms[ms.length - 1];
  if (ahora - b.t >= MUESTRA_VIGENTE_MS || b.t <= a.t) return { vx: 0, vy: 0 };
  return { vx: ((b.x - a.x) / (b.t - a.t)) * 1000, vy: ((b.y - a.y) / (b.t - a.t)) * 1000 };
}

export function pastillaArrastre(base: number, dx: number, ancho: number, n: number): number {
  const x = base + dx / ancho;
  if (x < 0) return -elastico(-x, 1, 0.6);
  if (x > n - 1) return n - 1 + elastico(x - (n - 1), 1, 0.6);
  return x;
}

export function pastillaAlSoltar(x: number, vx: number, ancho: number, n: number): number {
  return clamp(Math.round(x + proyectar(vx, 0.99) / ancho), 0, n - 1);
}
