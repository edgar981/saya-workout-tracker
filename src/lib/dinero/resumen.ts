/**
 * Las reglas de Dinero (DECISIONES.md §15), PURAS: sin React ni Dexie. Todo
 * trabaja con fechas `YYYY-MM-DD` y aritmética de calendario (sobre `Date.UTC`,
 * sin zona). `hoy` es el `todayISO()` que pasa la pantalla. Nada derivado se
 * guarda: todo sale de las cuentas y las deudas que llegan del servidor.
 */

import type { CuentaDto, DeudaDto, ExtractoDto } from "./servidor";

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
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ── Formatos ────────────────────────────────────────────────────────────────

/** «$4.918.550»: puntos de miles, sin decimales. */
export function formatoCOP(n: number): string {
  const r = Math.round(Math.abs(n));
  const t = String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 && r !== 0 ? "-" : ""}$${t}`;
}

/** «$4,9 M» desde un millón, «$312 mil» desde mil, «$950» abajo. */
export function compactoCOP(n: number): string {
  const a = Math.abs(n);
  const signo = n < 0 ? "-" : "";
  if (a >= 1_000_000 || Math.round(a / 1000) >= 1000) {
    const m = Math.round((a / 1_000_000) * 10) / 10;
    return `${signo}$${String(m).replace(".", ",")} M`;
  }
  if (a >= 1000) return `${signo}$${Math.round(a / 1000)} mil`;
  return formatoCOP(n);
}

/** «26,4 % E.A.», «20 % E.A.». */
export function formatoTasa(tasa: number): string {
  return `${String(tasa).replace(".", ",")} % E.A.`;
}

export function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

// ── Fechas ──────────────────────────────────────────────────────────────────

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.split("-").map(Number);
  return [a, m, d];
}

function aISO(a: number, m: number, d: number): string {
  return new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10);
}

function diasDelMes(a: number, m: number): number {
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** El día `dia` del mes (a, m), o el último día del mes si no existe. */
function diaDelMes(a: number, m: number, dia: number): string {
  return aISO(a, m, Math.min(dia, diasDelMes(a, m)));
}

/** `iso` más `n` meses; el día se recorta al último del mes si hace falta. */
function sumarMeses(iso: string, n: number): string {
  const [a, m, d] = partes(iso);
  const total = a * 12 + (m - 1) + n;
  return diaDelMes(Math.floor(total / 12), (total % 12) + 1, d);
}

function mismoMes(iso: string, otro: string): boolean {
  return iso.slice(0, 7) === otro.slice(0, 7);
}

function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/** «noviembre». */
export function mesNombre(hoy: string): string {
  return MESES[partes(hoy)[1] - 1];
}

/** «octubre»: el mes anterior al de `hoy`. */
export function mesAnterior(hoy: string): string {
  return MESES[(partes(hoy)[1] + 10) % 12];
}

/** «en 5 días», «hoy», «mañana». */
export function cuandoEs(fecha: string, hoy: string): string {
  const n = diasEntre(hoy, fecha);
  return n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`;
}

/** «15 nov» de una fecha `YYYY-MM-DD`. */
export function diaMesCorto(fecha: string): string {
  const [, m, d] = partes(fecha);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

/** «Dom 15 nov · en 5 días» («hoy», «mañana»). */
export function fechaDePago(fecha: string, hoy: string): string {
  const [a, m, d] = partes(fecha);
  const dia = DIAS_CORTOS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia} ${d} ${MESES_CORTOS[m - 1]} · ${cuandoEs(fecha, hoy)}`;
}

/** «8 nov» de la fecha local de un instante ISO. */
export function fechaLocalCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** «8 nov, 21:40» de la fecha y la hora locales de un instante ISO. */
export function fechaHoraLocal(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fechaLocalCorta(iso)}, ${hh}:${mm}`;
}

// ── Lo que se teclea ────────────────────────────────────────────────────────

/** Entero `>= 0` con o sin puntos de miles; si no, `null`. */
export function parseCOP(texto: string): number | null {
  const t = texto.trim();
  if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(t)) return null;
  const n = Number(t.replace(/\./g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** Tasa de 0 a 200 con a lo más dos decimales (coma o punto); si no, `null`. */
export function parseTasa(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 200 ? n : null;
}

// ── Las sumas ───────────────────────────────────────────────────────────────

/** La suma del último saldo de cada cuenta (una cuenta sin saldo suma 0). */
export function disponible(cuentas: readonly CuentaDto[]): number {
  return cuentas.reduce((s, c) => s + (c.saldo?.valor ?? 0), 0);
}

/** Las deudas que se muestran: las de último saldo mayor que 0. */
export function deudasVisibles(deudas: readonly DeudaDto[]): DeudaDto[] {
  return deudas.filter((d) => d.saldo !== null && d.saldo.valor > 0);
}

/** Lo que debes: la suma de los saldos de las deudas que se muestran. */
export function loQueDebes(deudas: readonly DeudaDto[]): number {
  return deudasVisibles(deudas).reduce((s, d) => s + (d.saldo?.valor ?? 0), 0);
}

export interface Pago {
  deuda: DeudaDto;
  etiqueta: string;
  valor: number;
  /** `YYYY-MM-DD`. */
  fecha: string;
}

/** Los pagos que caen en el mes de `hoy`, de hoy en adelante, por fecha. */
export function pagosDelMes(deudas: readonly DeudaDto[], hoy: string): Pago[] {
  const [a, m] = partes(hoy);
  const pagos: Pago[] = [];
  for (const d of deudasVisibles(deudas)) {
    if (d.tipo === "tarjeta") {
      const e = d.extracto;
      if (e && e.fecha_limite && e.pago_minimo !== null) {
        if (mismoMes(e.fecha_limite, hoy) && e.fecha_limite >= hoy) {
          pagos.push({ deuda: d, etiqueta: "Pago mínimo", valor: e.pago_minimo, fecha: e.fecha_limite });
        }
      }
    } else if (d.tipo === "credito" && d.cuota !== null && d.dia_pago !== null) {
      const fecha = diaDelMes(a, m, d.dia_pago);
      if (fecha < hoy) continue;
      if (d.primera_cuota !== null && fecha < d.primera_cuota) continue;
      let etiqueta = "Cuota";
      if (d.primera_cuota !== null && d.cuotas_total !== null) {
        const [pa, pm] = partes(d.primera_cuota);
        const n = (a - pa) * 12 + (m - pm) + 1;
        if (n < 1 || n > d.cuotas_total) continue;
        etiqueta = `Cuota ${n} de ${d.cuotas_total}`;
      }
      pagos.push({ deuda: d, etiqueta, valor: d.cuota, fecha });
    }
  }
  return pagos.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
}

export function sumaPagos(pagos: readonly Pago[]): number {
  return pagos.reduce((s, p) => s + p.valor, 0);
}

/** Quedan después de pagar: el disponible menos los pagos del mes. */
export function quedanDespuesDePagar(cuentas: readonly CuentaDto[], pagos: readonly Pago[]): number {
  return disponible(cuentas) - sumaPagos(pagos);
}

export interface FilaInteres {
  deuda: DeudaDto;
  extracto: ExtractoDto;
  valor: number;
}

/**
 * Cada extracto con `cierre` en el mes anterior al de `hoy`, de cualquier deuda de
 * la lista (también una en 0, que ya no se muestra): total y una fila por extracto,
 * de mayor a menor interés.
 */
export function interesesDelMes(
  deudas: readonly DeudaDto[],
  hoy: string,
): { total: number; filas: FilaInteres[] } {
  const [a, m] = partes(hoy);
  const anterior = m === 1 ? `${String(a - 1).padStart(4, "0")}-12` : `${String(a).padStart(4, "0")}-${String(m - 1).padStart(2, "0")}`;
  const filas: FilaInteres[] = [];
  for (const d of deudas) {
    for (const e of d.extractos) {
      if (e.cierre.slice(0, 7) === anterior) filas.push({ deuda: d, extracto: e, valor: e.intereses });
    }
  }
  filas.sort((x, y) => y.valor - x.valor);
  return { total: filas.reduce((s, f) => s + f.valor, 0), filas };
}

// ── Una deuda ───────────────────────────────────────────────────────────────

export interface Progreso {
  /** De 0 a 1, para el medidor. */
  fraccion: number;
  etiqueta: string;
}

/** El medidor de una deuda, o `null` si no hay con qué. */
export function progresoDeuda(d: DeudaDto, hoy: string): Progreso | null {
  if (d.tipo === "tarjeta" && d.cupo !== null && d.cupo > 0 && d.saldo) {
    const f = d.saldo.valor / d.cupo;
    return {
      fraccion: Math.min(1, Math.max(0, f)),
      etiqueta: `${Math.round(f * 100)} % del cupo de ${formatoCOP(d.cupo)}`,
    };
  }
  if (d.tipo === "credito" && d.cuotas_total !== null && d.cuotas_total > 0 && d.primera_cuota !== null) {
    const dia = d.dia_pago ?? partes(d.primera_cuota)[2];
    let hechas = 0;
    for (let k = 1; k <= d.cuotas_total; k++) {
      const fecha = k === 1 ? d.primera_cuota : diaDelMes(...mesDe(sumarMeses(d.primera_cuota, k - 1)), dia);
      if (fecha < hoy) hechas++;
      else break;
    }
    return { fraccion: hechas / d.cuotas_total, etiqueta: `${hechas} de ${d.cuotas_total} cuotas` };
  }
  return null;
}

function mesDe(iso: string): [number, number] {
  const [a, m] = partes(iso);
  return [a, m];
}

/**
 * La línea bajo el nombre de una deuda, sus partes unidas por « · » (la vacía se salta):
 * una tarjeta, con quién, «···últimos4» y la tasa; un crédito, con quién, la tasa y la
 * cuota; una personal, «Personal», la tasa y la cuota, o «Sin fecha ni interés» si no
 * tiene ninguna de las dos.
 */
export function lineaDeuda(d: DeudaDto): string {
  const tasa = d.tasa_ea !== null ? formatoTasa(d.tasa_ea) : "";
  const cuota = d.cuota !== null ? `cuota ${formatoCOP(d.cuota)}` : "";
  const lista: string[] = [];
  if (d.tipo === "tarjeta") {
    lista.push(`${d.con_quien}${d.ultimos4 ? ` ···${d.ultimos4}` : ""}`.trim(), tasa);
  } else if (d.tipo === "credito") {
    lista.push(d.con_quien, tasa, cuota);
  } else {
    lista.push("Personal", tasa, cuota);
    if (tasa === "" && cuota === "") lista.push("Sin fecha ni interés");
  }
  return lista.filter((p) => p !== "").join(" · ");
}

/** «Tarjeta Mastercard Bancolombia», «Crédito libre inversión Davivienda», «Préstamo de Andrés». */
export function nombreLargo(d: DeudaDto): string {
  const nombre = d.nombre.trim();
  let base = nombre;
  if (d.tipo === "tarjeta") {
    base = /^tarjeta(\s|$)/i.test(nombre) ? nombre : `Tarjeta ${nombre}`;
  } else if (d.tipo === "credito") {
    if (/^cr[eé]dito(\s|$)/i.test(nombre)) {
      base = nombre;
    } else {
      // La primera letra en minúscula, salvo una sigla (la segunda letra también es mayúscula).
      const sigla = nombre.length > 1 && nombre[1] !== nombre[1].toLowerCase();
      base = `Crédito ${sigla ? nombre : nombre.charAt(0).toLowerCase() + nombre.slice(1)}`;
    }
  }
  const conQuien = d.con_quien.trim();
  const yaEsta = nombre
    .toLowerCase()
    .split(/\s+/)
    .includes(conQuien.toLowerCase());
  return conQuien === "" || yaEsta ? base : `${base} ${conQuien}`;
}

/** «Ahorros ···4821»: el tipo y, con `ultimos4`, los cuatro. */
export function lineaCuenta(c: CuentaDto): string {
  return c.ultimos4 ? `${c.tipo} ···${c.ultimos4}` : c.tipo;
}
