/**
 * Los campos de las hojas de Dinero (DECISIONES.md §15), PUROS: sin React. Dar
 * formato al teclear y validar lo tecleado. Los textos vacíos son válidos sólo en
 * los campos opcionales; aquí cada validación recibe el texto tal como está en el
 * campo y deja que la hoja decida si el campo es obligatorio.
 */

import { parseCOP, parseTasa } from "./resumen";

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Los pesos caben en 13 dígitos (por debajo de `Number.MAX_SAFE_INTEGER`). */
const MAX_DIGITOS_PESOS = 13;

/** Sólo los dígitos de `texto`, a lo más `max`. */
export function soloDigitos(texto: string, max: number): string {
  return texto.replace(/\D/g, "").slice(0, max);
}

/**
 * Pesos con puntos de miles: sólo dígitos, sin ceros a la izquierda, a lo más 13.
 * El cursor queda después del mismo número de dígitos que tenía delante.
 */
export function formatearPesos(texto: string, cursor: number): { texto: string; cursor: number } {
  const antes = texto.slice(0, Math.max(0, cursor)).replace(/\D/g, "");
  const todos = texto.replace(/\D/g, "");
  // Sin ceros a la izquierda; un solo «0» se queda (0 es un valor, p. ej. unos intereses de 0).
  const ceros = Math.min(todos.length - todos.replace(/^0+/, "").length, Math.max(0, todos.length - 1));
  const digitos = todos.slice(ceros, ceros + MAX_DIGITOS_PESOS);
  const delante = Math.min(digitos.length, Math.max(0, antes.length - ceros));
  const con = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (delante === 0) return { texto: con, cursor: 0 };
  // La posición justo después del `delante`-ésimo dígito.
  let vistos = 0;
  for (let i = 0; i < con.length; i++) {
    if (con[i] !== ".") vistos++;
    if (vistos === delante) return { texto: con, cursor: i + 1 };
  }
  return { texto: con, cursor: con.length };
}

/** La tasa con coma: sólo dígitos y una coma, a lo más 3 enteros y 2 decimales («15.2» → «15,2»). */
export function formatearTasa(texto: string): string {
  const limpio = texto.replace(/\./g, ",").replace(/[^\d,]/g, "");
  const coma = limpio.indexOf(",");
  if (coma === -1) return limpio.slice(0, 3);
  const enteros = limpio.slice(0, coma).slice(0, 3);
  const decimales = limpio.slice(coma + 1).replace(/,/g, "").slice(0, 2);
  return `${enteros},${decimales}`;
}

/** «30 oct 2026» de una fecha `YYYY-MM-DD`. */
export function fechaCampo(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${a}`;
}

// ── Validaciones: el texto del campo ────────────────────────────────────────

const vacio = (t: string) => t.trim() === "";

/** Tasa de 0 a 200, a lo más dos decimales, con coma. Vacío es válido. */
export function tasaValida(texto: string): boolean {
  return vacio(texto) || parseTasa(texto) !== null;
}

/** Pesos, entero mayor que 0 (cuota, cupo, monto inicial). Vacío es válido. */
export function pesosPositivosValidos(texto: string): boolean {
  if (vacio(texto)) return true;
  const n = parseCOP(texto);
  return n !== null && n > 0;
}

/** Pesos, entero de 0 en adelante (pago mínimo). Vacío es válido. */
export function pesosValidos(texto: string): boolean {
  return vacio(texto) || parseCOP(texto) !== null;
}

/** Exactamente cuatro dígitos. Vacío es válido. */
export function ultimos4Validos(texto: string): boolean {
  return vacio(texto) || /^\d{4}$/.test(texto);
}

function enteroEntre(texto: string, min: number, max: number): boolean {
  if (vacio(texto)) return true;
  if (!/^\d+$/.test(texto)) return false;
  const n = Number(texto);
  return n >= min && n <= max;
}

/** Número de cuotas, de 1 a 600. Vacío es válido. */
export function cuotasTotalValidas(texto: string): boolean {
  return enteroEntre(texto, 1, 600);
}

/** Día de pago, de 1 a 31. Vacío es válido. */
export function diaPagoValido(texto: string): boolean {
  return enteroEntre(texto, 1, 31);
}

/** Una fecha `YYYY-MM-DD` del calendario. Vacío es válido. */
export function fechaValida(texto: string): boolean {
  if (vacio(texto)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** El cierre: una fecha del calendario que no es posterior a `hoy`. Vacío es válido. */
export function cierreValido(cierre: string, hoy: string): boolean {
  return vacio(cierre) || (fechaValida(cierre) && cierre <= hoy);
}

/** La fecha límite: una fecha del calendario que no es anterior al `cierre` (si hay). Vacío es válido. */
export function fechaLimiteValida(limite: string, cierre: string): boolean {
  if (vacio(limite)) return true;
  if (!fechaValida(limite)) return false;
  return vacio(cierre) || !fechaValida(cierre) || limite >= cierre;
}

/** Intereses: un entero de 0 en adelante; 0 es un valor. Vacío NO es válido (es obligatorio). */
export function interesesValidos(texto: string): boolean {
  return !vacio(texto) && parseCOP(texto) !== null;
}
