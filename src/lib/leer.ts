import { formatoNeto, polilinea, textoSeries } from "@/lib/cuerpo";
import { fechaCabeza } from "@/lib/hoy";
import {
  claveComparable,
  lunesDe,
  marcaDeAparicion,
  type Aparicion,
  type PuntoMarca,
  type SemanaBalance,
} from "@/lib/progress";
import { formatGap } from "@/lib/rest-gap";
import { redondearMedia } from "@/lib/volumen";

/**
 * Lo PURO del grupo Leer (Historial, detalle de sesión, Ejercicio y Progreso).
 * Nada se guarda: todo se deriva al leer (DECISIONES.md §3.5). Las pantallas sólo
 * juntan; las reglas viven aquí para probarlas sin Dexie ni DOM. Las fechas cortas
 * entran como parámetro `fecha` (la `fechaCorta` de `estado.tsx`), como en
 * `lib/cuerpo.ts`; los días son propios (no `toLocaleDateString`: la prueba corre
 * en node y no debe depender de ICU).
 */

type Fecha = (iso: string) => string;

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function aLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** «Lun»…«Dom», de una fecha `YYYY-MM-DD` (local, sin cruzar zonas). */
export function diaCorto(iso: string): string {
  return DIAS_CORTOS[aLocal(iso).getDay()];
}

/** «Lun, 9 nov». */
export function fechaFila(iso: string, fecha: Fecha): string {
  return `${diaCorto(iso)}, ${fecha(iso)}`;
}

/** «Martes 3 de noviembre». */
export function fechaLarga(iso: string): string {
  return fechaCabeza(aLocal(iso));
}

// ── Historial ────────────────────────────────────────────────────────────────

export interface ResumenFila {
  fecha: string;
  abierta: boolean;
  ejerciciosConSeries: number;
  totalSeries: number;
  /** Nombres de los tags, en el orden del resumen. */
  tags: string[];
  tieneNota: boolean;
}

/** «Lun, 9 nov · 7 ej · 19 series · poco tiempo · con nota». Sin tags si está abierta. */
export function subtituloFila(r: ResumenFila, fecha: Fecha): string {
  const partes = [
    fechaFila(r.fecha, fecha),
    `${r.ejerciciosConSeries} ej`,
    textoSeries(r.totalSeries),
  ];
  if (!r.abierta && r.tags.length > 0) partes.push(r.tags.join(", "));
  if (r.tieneNota) partes.push("con nota");
  return partes.join(" · ");
}

/** «40 sesiones · desde el 15 sep» (sólo cerradas); null sin cerradas. */
export function cabezaHistorial(
  resumenes: readonly { fecha: string; abierta: boolean }[],
  fecha: Fecha,
): string | null {
  const cerradas = resumenes.filter((r) => !r.abierta);
  if (cerradas.length === 0) return null;
  const primera = cerradas.reduce((a, b) => (a.fecha <= b.fecha ? a : b)).fecha;
  const n = cerradas.length;
  return `${n === 1 ? "1 sesión" : `${n} sesiones`} · desde el ${fecha(primera)}`;
}

export interface SemanaHistorial<T> {
  lunes: string;
  /** Alguna sesión de la semana lleva el tag de descarga. */
  deload: boolean;
  items: T[];
}

/** Grupos por `lunesDe(fecha)`, de la semana más nueva a la más vieja. Dentro de
 *  cada grupo se conserva el orden recibido. */
export function semanasHistorial<T extends { fecha: string; deload: boolean }>(
  resumenes: readonly T[],
): SemanaHistorial<T>[] {
  const porLunes = new Map<string, SemanaHistorial<T>>();
  for (const r of resumenes) {
    const lunes = lunesDe(r.fecha);
    const g = porLunes.get(lunes) ?? { lunes, deload: false, items: [] };
    g.items.push(r);
    g.deload ||= r.deload;
    porLunes.set(lunes, g);
  }
  return [...porLunes.values()].sort((a, b) => (a.lunes < b.lunes ? 1 : a.lunes > b.lunes ? -1 : 0));
}

/** Cuántas sesiones entran en la gráfica de series. */
export const BARRAS_HISTORIAL = 14;

export interface BarraHistorial {
  /** `totalSeries / máx · 100`. */
  alto: number;
  clase: "" | "op" | "dl";
}

export interface BarrasHistorial {
  barras: BarraHistorial[];
  n: number;
  etiqueta: string;
  /** Fecha de la primera y de la última barra (cronológicas); null sin barras. */
  primera: string | null;
  ultima: string | null;
}

/**
 * Las 14 sesiones más recientes (la abierta incluida) en orden cronológico.
 * `resumenes` llega descendente por fecha, como `listSessionSummaries`.
 */
export function barrasHistorial(
  resumenes: readonly { fecha: string; abierta: boolean; deload: boolean; totalSeries: number }[],
): BarrasHistorial {
  const chart = resumenes.slice(0, BARRAS_HISTORIAL).reverse();
  if (chart.length === 0) return { barras: [], n: 0, etiqueta: "", primera: null, ultima: null };
  const max = Math.max(1, ...chart.map((s) => s.totalSeries));
  const min = Math.min(...chart.map((s) => s.totalSeries));
  const barras = chart.map<BarraHistorial>((s) => ({
    alto: (s.totalSeries / max) * 100,
    clase: s.abierta ? "op" : s.deload ? "dl" : "",
  }));
  const hayAbierta = chart.some((s) => s.abierta);
  const descargas = chart.filter((s) => !s.abierta && s.deload).length;
  let etiqueta = `Series por sesión, últimas ${chart.length}: de ${min} a ${max}.`;
  if (hayAbierta) etiqueta += " La abierta lleva el cromo.";
  if (descargas > 0) etiqueta += ` ${descargas} de descarga.`;
  return {
    barras,
    n: chart.length,
    etiqueta,
    primera: chart[0].fecha,
    ultima: chart[chart.length - 1].fecha,
  };
}

// ── Detalle de sesión ────────────────────────────────────────────────────────

/** «58 min» bajo una hora (redondeado al minuto); `formatGap` desde una hora
 *  («1 h 04»); null → null. */
export function duracion(ms: number | null): string | null {
  if (ms === null) return null;
  if (ms >= 3_600_000) return formatGap(ms);
  return `${Math.min(59, Math.max(1, Math.round(ms / 60_000)))} min`;
}

export interface ConteoVeredictos {
  mejor: number;
  igual: number;
  peor: number;
  sin_comparacion: number;
}

export function conteoVeredictos(
  verdicts: Record<string, { verdict: { category: keyof ConteoVeredictos } }>,
): ConteoVeredictos {
  const c: ConteoVeredictos = { mejor: 0, igual: 0, peor: 0, sin_comparacion: 0 };
  for (const id in verdicts) c[verdicts[id].verdict.category]++;
  return c;
}

/** La fecha contra la que comparan todos los veredictos que tienen una; null si
 *  difieren o ninguno la tiene. */
export function fechaComun(verdicts: Record<string, { referenceFecha: string | null }>): string | null {
  let comun: string | null = null;
  for (const id in verdicts) {
    const f = verdicts[id].referenceFecha;
    if (f === null) continue;
    if (comun === null) comun = f;
    else if (comun !== f) return null;
  }
  return comun;
}

/** Avance de la sesión: ejercicios con series, ejercicios, y series reales. */
export function conteoSesion(items: readonly { sets: readonly unknown[] }[]): {
  hechos: number;
  total: number;
  series: number;
} {
  return {
    hechos: items.filter((i) => i.sets.length > 0).length,
    total: items.length,
    series: items.reduce((n, i) => n + i.sets.length, 0),
  };
}

// ── Progreso ─────────────────────────────────────────────────────────────────

/** «5 con series · 1 sin series»; sin « · N sin series» si N es 0. */
export function cuentaEstados(filas: readonly { estado: string }[]): {
  conSeries: number;
  sinSeries: number;
  texto: string;
} {
  const sinSeries = filas.filter((f) => f.estado === "sin_registros").length;
  const conSeries = filas.length - sinSeries;
  return {
    conSeries,
    sinSeries,
    texto: `${conSeries} con series${sinSeries > 0 ? ` · ${sinSeries} sin series` : ""}`,
  };
}

/** «17,5» · «12»: una decimal con coma si no es entero. */
export function decimalComa(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/** «Dips · 11» (directo) · «Pull Up · ½ de 11 · 5,5» (indirecto). A medias series,
 *  que es la resolución del conteo. */
export function textoAporte(a: { nombre: string; rol: string; series: number }): string {
  const s = redondearMedia(a.series);
  if (a.rol === "indirecto") {
    return `${a.nombre} · ½ de ${decimalComa(s)} · ${decimalComa(redondearMedia(a.series / 2))}`;
  }
  return `${a.nombre} · ${decimalComa(s)}`;
}

/** Alto máximo de una barra del balance, en px. */
export const ALTO_BALANCE_PX = 44;

export interface ColumnaBalance {
  lunes: string;
  hueco: boolean;
  /** Alto de la barra en px (0 en un hueco o en neto 0). */
  alto: number;
  negativo: boolean;
  deload: boolean;
  /** «+3», «−2», «0» o «·» en un hueco. */
  texto: string;
  /** Posición del número: `bottom` o `top` en CSS. */
  numero: { bottom: string } | { top: string };
}

export interface BalanceBarras {
  columnas: ColumnaBalance[];
  etiqueta: string;
  primera: string | null;
  ultima: string | null;
}

export function barrasBalance(semanas: readonly SemanaBalance[], fecha: Fecha): BalanceBarras {
  if (semanas.length === 0) return { columnas: [], etiqueta: "", primera: null, ultima: null };
  const max = Math.max(1, ...semanas.map((s) => (s.sesiones > 0 ? Math.abs(s.net) : 0)));
  const columnas = semanas.map<ColumnaBalance>((s) => {
    if (s.sesiones === 0) {
      return {
        lunes: s.lunes,
        hueco: true,
        alto: 0,
        negativo: false,
        deload: false,
        texto: "·",
        numero: { top: "calc(50% - 7px)" },
      };
    }
    const alto = (Math.abs(s.net) / max) * ALTO_BALANCE_PX;
    const negativo = s.net < 0;
    return {
      lunes: s.lunes,
      hueco: false,
      alto,
      negativo,
      deload: s.deload,
      texto: formatoNeto(s.net),
      numero: negativo
        ? { top: `calc(50% + ${alto + 3}px)` }
        : { bottom: `calc(50% + ${alto + 3}px)` },
    };
  });
  const primera = semanas[0].lunes;
  const ultima = semanas[semanas.length - 1].lunes;
  const items = semanas.map((s) =>
    s.sesiones === 0 ? `${fecha(s.lunes)} sin sesiones` : `${fecha(s.lunes)} ${formatoNeto(s.net)}`,
  );
  const descargas = semanas
    .filter((s) => s.sesiones > 0 && s.deload)
    .map((s) => ` La semana del ${fecha(s.lunes)} fue de descarga.`);
  return {
    columnas,
    etiqueta: `Balance por semana, de ${fecha(primera)} a ${fecha(ultima)}: ${items.join(", ")}.${descargas.join("")}`,
    primera,
    ultima,
  };
}

/**
 * «8 × 135 lb» → {cifra: «8 × 135», unidad: «lb»}. Si el texto no termina en
 * « lb» o « kg» (peso corporal, apilado), todo va en la cifra y la unidad es null.
 */
export function partirUnidad(texto: string): { cifra: string; unidad: "lb" | "kg" | null } {
  const m = texto.match(/^(.*\S) (lb|kg)$/);
  return m ? { cifra: m[1], unidad: m[2] as "lb" | "kg" } : { cifra: texto, unidad: null };
}

// ── La línea de Ejercicio ────────────────────────────────────────────────────

export interface DescargaEnLinea {
  fecha: string;
  marca: number;
}

/**
 * Las apariciones de descarga que caen en la misma clave que la línea, con su
 * marca. La clave es `claveComparable` de la aparición más reciente que NO es de
 * descarga, igual que `evaluarProgreso`. Sin ninguna no-descarga, o con marca
 * `null`, no hay. `apariciones` en orden cronológico.
 */
export function descargasEnLinea(apariciones: readonly Aparicion[]): DescargaEnLinea[] {
  const normales = apariciones.filter((a) => !a.deload);
  const referencia = normales[normales.length - 1];
  if (!referencia) return [];
  const clave = claveComparable(referencia.sets, referencia.pesoCorporal);
  const out: DescargaEnLinea[] = [];
  for (const a of apariciones) {
    if (!a.deload) continue;
    if (claveComparable(a.sets, a.pesoCorporal) !== clave) continue;
    const marca = marcaDeAparicion(a.sets, a.pesoCorporal);
    if (marca === null) continue;
    out.push({ fecha: a.fecha, marca });
  }
  return out;
}

export interface ElementoLinea {
  tipo: "punto" | "descarga";
  fecha: string;
  x: number;
  y: number;
  /** Sólo las descargas: la `y` del texto «descarga». */
  yTexto: number | null;
}

export interface LineaMarcas {
  elementos: ElementoLinea[];
  /** `points` de la polilínea: sólo los puntos. */
  polilinea: string;
  primera: string | null;
  ultima: string | null;
}

/**
 * Coordenadas del `viewBox="0 0 350 158"`: los puntos y las descargas juntos, en
 * orden cronológico (empate: primero el punto). `x(i) = 14 + i · 322 / (n − 1)`;
 * `y(v) = 14 + (alto − v) / (alto − bajo) · 112`, o 70 si todas las marcas son
 * iguales. Ningún número sale de aquí hacia la pantalla (§11.1).
 */
export function puntosLinea(
  puntos: readonly Pick<PuntoMarca, "fecha" | "marca">[],
  descargas: readonly DescargaEnLinea[],
): LineaMarcas {
  const todos = [
    ...puntos.map((p, i) => ({ tipo: "punto" as const, fecha: p.fecha, marca: p.marca, orden: i })),
    ...descargas.map((d, i) => ({ tipo: "descarga" as const, fecha: d.fecha, marca: d.marca, orden: i })),
  ].sort(
    (a, b) =>
      (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
      (a.tipo === b.tipo ? a.orden - b.orden : a.tipo === "punto" ? -1 : 1),
  );
  const n = todos.length;
  if (n === 0) return { elementos: [], polilinea: "", primera: null, ultima: null };
  const alto = Math.max(...todos.map((t) => t.marca));
  const bajo = Math.min(...todos.map((t) => t.marca));
  const elementos = todos.map<ElementoLinea>((t, i) => {
    const x = n > 1 ? 14 + (i * 322) / (n - 1) : 14;
    const y = alto === bajo ? 70 : 14 + ((alto - t.marca) / (alto - bajo)) * 112;
    return {
      tipo: t.tipo,
      fecha: t.fecha,
      x,
      y,
      yTexto: t.tipo === "descarga" ? (y + 18 > 140 ? y - 10 : y + 18) : null,
    };
  });
  return {
    elementos,
    polilinea: polilinea(elementos.filter((e) => e.tipo === "punto")),
    primera: elementos[0].fecha,
    ultima: elementos[n - 1].fecha,
  };
}
