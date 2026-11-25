/**
 * Las reglas de la semana y la típica de Tiempo (DECISIONES.md §15), PURAS: sin
 * React, sin Dexie. Todo trabaja con fechas `YYYY-MM-DD` y aritmética de días de
 * calendario (sobre `Date.UTC`, sin zona). `hoy` es el `todayISO()` que pasa la
 * pantalla.
 */

export interface TemaTiempo {
  id: string;
  nombre: string;
}

export interface RegistroTiempoDto {
  id: string;
  tema_id: string;
  minutos: number;
  /** `YYYY-MM-DD`. */
  fecha: string;
  /** ISO con zona (`toISOString()`). */
  anotado_en: string;
}

export interface DatosTiempo {
  temas: TemaTiempo[];
  registros: RegistroTiempoDto[];
  /** La `fecha` más antigua de todos los registros, o `null`. */
  primer_registro: string | null;
}

export interface TemaResumen {
  id: string;
  nombre: string;
  minutos: number;
  tipica: number | null;
}

export interface Resumen {
  minutos: number;
  tipica: number | null;
  temas: TemaResumen[];
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Las cuatro ventanas anteriores a la semana. */
const VENTANAS = [1, 2, 3, 4] as const;

/** `iso` más `n` días de calendario (`n` puede ser negativo). */
export function sumarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** «9 nov»: el día y el mes de tres letras. */
function diaMes(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/** Desde cuándo leer: la semana y las cuatro anteriores. */
export function desdeParaLeer(hoy: string): string {
  return sumarDias(hoy, -34);
}

/** La semana, `[hoy − 6, hoy]`. */
export function ventanaSemana(hoy: string): [string, string] {
  return [sumarDias(hoy, -6), hoy];
}

/** Las ventanas anteriores que cuentan: su último día es `>= primer_registro`. */
export function ventanasTipica(hoy: string, primer: string | null): [string, string][] {
  if (primer === null) return [];
  return VENTANAS.map((k): [string, string] => [sumarDias(hoy, -7 * k - 6), sumarDias(hoy, -7 * k)]).filter(
    ([, fin]) => fin >= primer,
  );
}

function suma(registros: RegistroTiempoDto[], [ini, fin]: [string, string], tema?: string): number {
  let total = 0;
  for (const r of registros) {
    if (r.fecha < ini || r.fecha > fin) continue;
    if (tema !== undefined && r.tema_id !== tema) continue;
    total += r.minutos;
  }
  return total;
}

function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

export function resumen(datos: DatosTiempo, hoy: string): Resumen {
  const semana = ventanaSemana(hoy);
  const ventanas = ventanasTipica(hoy, datos.primer_registro);
  const minutos = suma(datos.registros, semana);
  const tipica = promedio(ventanas.map((v) => suma(datos.registros, v)));

  const temas = datos.temas
    .map((t): TemaResumen => ({
      id: t.id,
      nombre: t.nombre,
      minutos: suma(datos.registros, semana, t.id),
      tipica: promedio(ventanas.map((v) => suma(datos.registros, v, t.id))),
    }))
    .filter((t) => t.minutos > 0 || (t.tipica ?? 0) > 0)
    .sort(
      (a, b) =>
        b.minutos - a.minutos ||
        (b.tipica ?? 0) - (a.tipica ?? 0) ||
        (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0),
    );

  return { minutos, tipica, temas };
}

/** «4 h 50 min», «1 h», «45 min», «0 min». */
export function formatoHM(min: number): string {
  return partesHM(min)
    .map((p) => `${p.n} ${p.u}`)
    .join(" ");
}

/** La misma cifra en partes, para pintar la unidad pequeña. */
export function partesHM(min: number): { n: string; u: "h" | "min" }[] {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const partes: { n: string; u: "h" | "min" }[] = [];
  if (h > 0) partes.push({ n: String(h), u: "h" });
  if (m > 0 || h === 0) partes.push({ n: String(m), u: "min" });
  return partes;
}

/** «↓ 2 h 25 min» por debajo de la típica, «↑ 1 h» por encima, `null` si igual o sin típica. */
export function lineaDiferencia(minutos: number, tipica: number | null): string | null {
  if (tipica === null || minutos === tipica) return null;
  return minutos < tipica
    ? `↓ ${formatoHM(tipica - minutos)}`
    : `↑ ${formatoHM(minutos - tipica)}`;
}

/** «4 – 10 nov» en el mismo mes, «28 oct – 3 nov» si no. */
export function rangoSemana(hoy: string): string {
  const [ini] = ventanaSemana(hoy);
  const [, mi, di] = ini.split("-").map(Number);
  const [, mf, df] = hoy.split("-").map(Number);
  return mi === mf ? `${di} – ${df} ${MESES[mf - 1]}` : `${diaMes(ini)} – ${diaMes(hoy)}`;
}

/** El día local (`YYYY-MM-DD`) de un instante, en la zona del teléfono. */
function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * «Hoy, 7:10» o «9 nov, 21:15». La hora es la de `anotado_en` en la zona del
 * teléfono y sólo se pone si su día local es el mismo `fecha`.
 */
export function etiquetaRegistro(
  registro: Pick<RegistroTiempoDto, "fecha" | "anotado_en">,
  hoy: string,
): string {
  const dia = registro.fecha === hoy ? "Hoy" : diaMes(registro.fecha);
  const t = new Date(registro.anotado_en);
  if (Number.isNaN(t.getTime()) || diaLocal(t) !== registro.fecha) return dia;
  return `${dia}, ${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
}

/** El mayor de `max(minutos, típica)` entre los temas mostrados, por 1,1. */
export function escalaTemas(temas: readonly TemaResumen[]): number {
  let mayor = 0;
  for (const t of temas) mayor = Math.max(mayor, t.minutos, t.tipica ?? 0);
  return mayor * 1.1;
}

/** La escala del medidor de la tesela de Hoy. */
export function escalaTesela(minutos: number, tipica: number | null): number {
  return Math.max(minutos, tipica ?? 0) * 1.15;
}

/** El ancho (0 a 100) de `valor` sobre `escala`; con escala 0, 0. */
export function porcentajeDe(valor: number, escala: number): number {
  if (!(escala > 0)) return 0;
  return Math.min(100, (valor / escala) * 100);
}
