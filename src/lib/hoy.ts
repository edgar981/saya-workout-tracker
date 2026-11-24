import type { SetLine } from "@/lib/history-format";
import { formatoDiferencia, type PesoResumen } from "@/lib/cuerpo";

/**
 * Lo PURO de Hoy, de la vista previa del día y de Cerrar. Nada se guarda: todo
 * se deriva al leer (DECISIONES.md §3.5). Las listas de días y meses son propias
 * (no `toLocaleDateString`): la prueba corre en node y no debe depender de ICU.
 */

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** «Martes 10 de noviembre»: día con mayúscula inicial, mes en minúscula. */
export function fechaCabeza(d: Date): string {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/**
 * Semana del mesociclo desde `iniciado_en`: semanas completas transcurridas + 1.
 * Sustituye la fecha de inicio (YYYY-MM-DD) por local para no cruzar zonas. Se
 * clampa a 1 por si la fecha de inicio quedó en el futuro (edición manual).
 */
export function semanaMesociclo(iniciadoEn: string, ahora: Date): number {
  const [y, m, d] = iniciadoEn.split("-").map(Number);
  const inicio = new Date(y, m - 1, d).getTime();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  return Math.max(1, Math.floor((hoy - inicio) / (7 * 86_400_000)) + 1);
}

/** «Mesociclo 2 · semana 2»; sin semana, el nombre; sin mesociclo, `null`. */
export function subtituloHoy(nombre: string | null, semana: number | null): string | null {
  if (nombre === null) return null;
  return semana === null ? nombre : `${nombre} · semana ${semana}`;
}

/**
 * Antigüedad relativa corta de la sesión abierta (§2). Dentro del día,
 * minutos/horas; luego, días de calendario para que «ayer» sea ayer y no
 * depender de la hora exacta.
 */
export function antiguedad(iso: string, ahora: Date): string {
  const inicio = new Date(iso);
  const min = Math.floor((ahora.getTime() - inicio.getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;

  const diaInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const diaAhora = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.round((diaAhora.getTime() - diaInicio.getTime()) / 86_400_000);
  if (dias === 0) return `hace ${Math.floor(min / 60)} h`;
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/** «Sesión abierta · recién empezada» (menos de un minuto) o con la antigüedad. */
export function estadoSesion(iniciadaEn: string, ahora: Date): string {
  const a = antiguedad(iniciadaEn, ahora);
  return a === "recién" ? "Sesión abierta · recién empezada" : `Sesión abierta · ${a}`;
}

/** Días de calendario desde una fecha `YYYY-MM-DD` de sesión hasta hoy (§2). */
export function diasDesde(fechaISO: string, ahora: Date): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  return Math.round((hoy - then) / 86_400_000);
}

/** «hoy», «ayer», «hace N d». */
export function formatHace(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} d`;
}

function textoSeriesN(series: number): string {
  return `${series} ${series === 1 ? "serie" : "series"}`;
}

/** «9 nov» desde `YYYY-MM-DD` (la fecha de la tesela del peso). */
export function fechaDiaMes(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

/** «Jue, 5 nov» desde `YYYY-MM-DD`, leída como fecha local (la hoja del día). */
export function fechaUltimaVez(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  return `${DIAS[f.getDay()].slice(0, 3)}, ${d} ${MESES[m - 1].slice(0, 3)}`;
}

/** «Day 1 · 10 series» (la tesela de la sesión abierta). */
export function lineaSesionTesela(dia: string, series: number): string {
  return `${dia} · ${textoSeriesN(series)}`;
}

/** El botón de la hoja del día: continuar, cerrar la abierta y empezar, o empezar. */
export function textoBotonDia(o: {
  mismoDia: boolean;
  abierta: string | null;
  nombreDia: string;
}): string {
  if (o.mismoDia) return "Continuar donde ibas →";
  if (o.abierta !== null) return `Cerrar ${o.abierta} y empezar ${o.nombreDia}`;
  return `Empezar ${o.nombreDia}`;
}

/** «4 / 5 hechos · 10 series»; sin total, «N serie(s)». */
export function lineaProgreso(hechos: number, total: number, series: number): string {
  return total > 0
    ? `${hechos} / ${total} hechos · ${series} series`
    : textoSeriesN(series);
}

/** «9 nov · −1,2 kg desde el 15 sep»; con un solo registro, sólo «9 nov». */
export function subtituloPesoHoy(r: PesoResumen, fecha: (iso: string) => string): string {
  if (r.n === 1) return fecha(r.ultimaFecha);
  return `${fecha(r.ultimaFecha)} · ${formatoDiferencia(r.diferencia)} ${r.unidad} desde el ${fecha(r.primeraFecha)}`;
}

/**
 * La línea de una serie en la vista previa: «8, 7, 6 × +10 kg» si todas llevan el
 * mismo peso; sólo las reps con peso corporal; si los pesos difieren, cada serie
 * entera («8 × 170 lb, 6 × 165 lb»).
 */
export function lineaCompacta(lineas: SetLine[]): string {
  if (lineas.length === 0) return "";
  const mismoPeso = lineas.every((l) => l.weightText === lineas[0].weightText);
  if (mismoPeso) {
    const reps = lineas.map((l) => l.repsText).join(", ");
    return lineas[0].isBodyweight ? reps : `${reps} × ${lineas[0].weightText}`;
  }
  return lineas.map((l) => (l.isBodyweight ? l.repsText : `${l.repsText} × ${l.weightText}`)).join(", ");
}

/** «Day 4 · hace 41 min · 4 de 5 ejercicios · 10 series» (Cerrar). */
export function lineaCierre({
  dia,
  hace,
  hechos,
  total,
  series,
}: {
  dia: string | null;
  hace: string;
  hechos: number;
  total: number;
  series: number;
}): string {
  const partes = [dia ?? "Sesión libre", hace];
  if (total > 0) partes.push(`${hechos} de ${total} ejercicios`);
  partes.push(textoSeriesN(series));
  return partes.join(" · ");
}
