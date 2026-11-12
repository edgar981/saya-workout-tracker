import { lunesDe, type EstadoProgreso } from "@/lib/progress";

/**
 * Lo PURO de `/cuerpo` (peso corporal, la semana, los estados). Nada se guarda:
 * todo se deriva al leer (DECISIONES.md §3.5). `src/lib/db/cuerpo.ts` sólo junta
 * las lecturas; las reglas viven aquí para probarlas sin Dexie.
 */

export const MENOS = "−";

export interface PesoRegistro {
  fecha: string;
  valor: number;
  unidad: "KG" | "LB";
}

export interface PesoResumen {
  /** La unidad del último registro, en minúsculas. */
  unidad: "kg" | "lb";
  ultimo: number;
  ultimaFecha: string;
  primeraFecha: string;
  /** Registros de la serie (misma unidad que el último). */
  n: number;
  /** último − primero. */
  diferencia: number;
  /** Por fecha ascendente (empates: el orden de la tabla). */
  serie: { fecha: string; valor: number }[];
}

/** Una decimal con coma: 78,4. */
export function formatoPeso(v: number): string {
  return v.toFixed(1).replace(".", ",");
}

/** «+1,2» / «−1,2» / «0,0» (signo menos real, U+2212). */
export function formatoDiferencia(d: number): string {
  const r = Math.round(Math.abs(d) * 10) / 10;
  if (r === 0) return "0,0";
  return `${d > 0 ? "+" : MENOS}${formatoPeso(r)}`;
}

/** El neto de una sesión o semana, como en Historial: «+3», «−2», «0». */
export function formatoNeto(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `${MENOS}${Math.abs(n)}` : "0";
}

export function resumirPeso(logs: readonly PesoRegistro[]): PesoResumen | null {
  if (logs.length === 0) return null;
  // Orden estable por fecha: los empates conservan el de la tabla.
  const orden = logs
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.fecha < b.l.fecha ? -1 : a.l.fecha > b.l.fecha ? 1 : a.i - b.i))
    .map((x) => x.l);
  const ultimoLog = orden[orden.length - 1];
  const serie = orden
    .filter((l) => l.unidad === ultimoLog.unidad)
    .map((l) => ({ fecha: l.fecha, valor: l.valor }));
  const primero = serie[0];
  return {
    unidad: ultimoLog.unidad === "KG" ? "kg" : "lb",
    ultimo: ultimoLog.valor,
    ultimaFecha: ultimoLog.fecha,
    primeraFecha: primero.fecha,
    n: serie.length,
    diferencia: ultimoLog.valor - primero.valor,
    serie,
  };
}

/** «−1,2 kg desde el 15 sep · 12 registros», o «1 registro». */
export function dekPeso(r: PesoResumen, fecha: (iso: string) => string): string {
  if (r.n === 1) return "1 registro";
  return `${formatoDiferencia(r.diferencia)} ${r.unidad} desde el ${fecha(r.primeraFecha)} · ${r.n} registros`;
}

export function etiquetaGrafica(r: PesoResumen, fecha: (iso: string) => string): string {
  const primero = r.serie[0];
  const ultimo = r.serie[r.serie.length - 1];
  return `Peso corporal, ${r.n} registros: de ${formatoPeso(primero.valor)} ${r.unidad} el ${fecha(primero.fecha)} a ${formatoPeso(ultimo.valor)} ${r.unidad} el ${fecha(ultimo.fecha)}.`;
}

export interface PuntoGrafica {
  x: number;
  y: number;
}

/** Puntos de la gráfica en un `viewBox="0 0 350 74"`; null con menos de dos. */
export function puntosGrafica(valores: readonly number[]): PuntoGrafica[] | null {
  const n = valores.length;
  if (n < 2) return null;
  const alto = Math.max(...valores);
  const bajo = Math.min(...valores);
  return valores.map((v, i) => ({
    x: 4 + (i * 342) / (n - 1),
    y: alto === bajo ? 31 : 6 + ((alto - v) / (alto - bajo)) * 50,
  }));
}

/** Atributo `points` de la polilínea. */
export function polilinea(puntos: readonly PuntoGrafica[]): string {
  return puntos.map((p) => `${redondear(p.x)},${redondear(p.y)}`).join(" ");
}

function redondear(v: number): number {
  return Math.round(v * 100) / 100;
}

// ── Esta semana ──────────────────────────────────────────────────────────────

export interface SesionSemana {
  fecha: string;
  /** `routineDay?.nombre ?? "Sesión libre"`. */
  nombre: string;
  abierta: boolean;
}

/** Las sesiones con fecha ≥ el lunes de `hoy`, en el orden recibido. */
export function sesionesDeSemana<T extends { fecha: string }>(sesiones: readonly T[], hoy: string): T[] {
  const lunes = lunesDe(hoy);
  return sesiones.filter((s) => s.fecha >= lunes);
}

/** «Día A cerrada · Día B abierta». */
export function subtituloSesiones(sesiones: readonly SesionSemana[]): string {
  return sesiones.map((s) => `${s.nombre} ${s.abierta ? "abierta" : "cerrada"}`).join(" · ");
}

/** El neto de la semana actual; null si no tuvo sesiones cerradas (un hueco no es un cero). */
export function balanceDeSemana(
  semanas: readonly { lunes: string; net: number; sesiones: number }[],
  hoy: string,
): number | null {
  const lunes = lunesDe(hoy);
  const s = semanas.find((x) => x.lunes === lunes);
  return s && s.sesiones > 0 ? s.net : null;
}

// ── Estados ──────────────────────────────────────────────────────────────────

export interface ConteoEstados {
  subiendo: number;
  estancado: number;
  por_debajo: number;
  pocos_datos: number;
  sin_registrar: number;
  /** Ejercicios cuyo estado no es `sin_registros`. */
  conSeries: number;
}

export function contarEstados(estados: readonly EstadoProgreso[]): ConteoEstados {
  const c: ConteoEstados = {
    subiendo: 0,
    estancado: 0,
    por_debajo: 0,
    pocos_datos: 0,
    sin_registrar: 0,
    conSeries: 0,
  };
  for (const e of estados) {
    if (e === "sin_registros") continue;
    c.conSeries++;
    c[e]++;
  }
  return c;
}

export function textoSeries(n: number): string {
  return `${n} ${n === 1 ? "serie" : "series"}`;
}
