import type { AddedUnit, BodyweightLog, Session, SetLog } from "@/lib/db/types";
import { epley, MAX_REPS_E1RM } from "@/lib/verdict";

/**
 * Capa 2: lectura de progresión (DECISIONES.md §11). Funciones PURAS, sin Dexie,
 * igual que `verdict.ts`: el loader vive en `db/progress.ts` y este módulo solo
 * calcula. Toda regla de §11 vive aquí y en ningún otro lugar.
 *
 * La marca NUNCA se muestra como número (§11.1): da forma a la línea y a los
 * porcentajes, nada más.
 */

// ── Umbrales (§11.4, §11.5). Un solo lugar, como UMBRAL_IGUAL. ────────────────

/** Más días que esto sin aparición → "sin registrar". Dos ciclos del split. */
export const DIAS_SIN_REGISTRAR = 14;
/** Menos comparables que esto → "pocos datos". */
export const MIN_COMPARABLES = 4;
/** Una mejor marca en estas últimas comparables → "subiendo". */
export const VENTANA_RECIENTE = 2;
/**
 * Promedio de las últimas ≤ mejor × esto → "por debajo". 3% y no el 2% del
 * veredicto: aquí se compara contra un MÁXIMO, sesgado hacia arriba por el ruido.
 */
export const FRACCION_POR_DEBAJO = 0.97;
/** Un hueco de al menos estos días entre sesiones es una pausa. */
export const DIAS_PAUSA = 7;
/** Por id, no por nombre: el nombre del tag es editable (§11.2). */
export const TAG_DELOAD = "tag-deload";
/** Semanas del balance en /progreso (§11.7). */
export const SEMANAS_BALANCE = 8;

// ── Fechas (ISO YYYY-MM-DD, sin zona) ────────────────────────────────────────

function diaUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Días de `a` a `b`. Ambos se leen igual, así que la zona no importa. */
export function diasEntre(a: string, b: string): number {
  return diaUTC(b) - diaUTC(a);
}

/** Semanas completas transcurridas + 1: la misma regla de la semana del mesociclo. */
export function semanaDesde(inicio: string, hoy: string): number {
  return Math.max(1, Math.floor(diasEntre(inicio, hoy) / 7) + 1);
}

/** Lunes (ISO) de la semana de `iso`. */
export function lunesDe(iso: string): string {
  const dia = diaUTC(iso);
  // 1970-01-01 fue jueves: (dia + 3) % 7 da 0 en lunes.
  const lunes = dia - ((((dia + 3) % 7) + 7) % 7);
  return new Date(lunes * 86_400_000).toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date((diaUTC(iso) + dias) * 86_400_000).toISOString().slice(0, 10);
}

// ── Marca de una aparición (§11.1) ───────────────────────────────────────────

/** Carga añadida de referencia en BODYWEIGHT_PLUS: la mayor de la aparición. */
function cargaAñadida(sets: SetLog[]): number | null {
  const pesos = sets.filter((s) => s.weight_value !== null).map((s) => s.weight_value as number);
  return pesos.length > 0 ? Math.max(...pesos) : null;
}

/**
 * Peso corporal de una aparición de BODYWEIGHT_PLUS (§11.2): el último registro en
 * la unidad del añadido en o antes de la fecha. Antes del primer registro se usa
 * el primero: el usuario confirmó (8 nov) que su peso fue estable desde agosto.
 * null si no hay registros en esa unidad — no se convierte (D5).
 */
export function pesoCorporalEn(
  pesos: Pick<BodyweightLog, "fecha" | "valor" | "unidad">[],
  fecha: string,
  unidad: AddedUnit,
): number | null {
  const enUnidad = pesos
    .filter((p) => p.unidad === unidad)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (enUnidad.length === 0) return null;
  return (enUnidad.filter((p) => p.fecha <= fecha).at(-1) ?? enUnidad[0]).valor;
}

/**
 * Clave de comparabilidad (§11.2): tupla de unidad (§3.5) + lateralidad observada
 * + en BODYWEIGHT_PLUS, la carga añadida — salvo que haya peso corporal: entonces
 * la carga es cuerpo + añadido y cualquier añadido compara. Dos apariciones solo
 * se comparan si comparten clave. Sale de la primera serie, como `unitKey` del
 * historial.
 */
export function claveComparable(sets: SetLog[], pesoCorporal: number | null = null): string {
  const s = sets[0];
  const lado = sets.some((x) => x.side !== null) ? "U" : "B";
  const base = `${s.weight_unit}|${s.weight_basis ?? "NA"}|${s.added_unit ?? "NA"}|${lado}`;
  if (s.weight_unit !== "BODYWEIGHT_PLUS") return base;
  return pesoCorporal !== null ? `${base}|cuerpo` : `${base}|${cargaAñadida(sets) ?? "NA"}`;
}

/**
 * Promedio de las dos mejores series, por lado (en unilateral, L y R por separado
 * y luego el promedio de los lados presentes). null si ninguna serie es valorable
 * — esa aparición no se grafica.
 *
 * Carga fija (BODYWEIGHT, y BODYWEIGHT_PLUS sin peso corporal, dentro de su
 * carga): factor de Epley sin peso y sin tope — el tope protege estimaciones entre
 * cargas distintas, y aquí la carga es la misma. Carga variable (y
 * BODYWEIGHT_PLUS con peso corporal, cuya carga es cuerpo + añadido): e1RM con el
 * tope del veredicto.
 */
export function marcaDeAparicion(sets: SetLog[], pesoCorporal: number | null = null): number | null {
  if (sets.length === 0) return null;
  const unidad = sets[0].weight_unit;
  const conCuerpo = unidad === "BODYWEIGHT_PLUS" && pesoCorporal !== null;
  const cargaFija = unidad === "BODYWEIGHT" || (unidad === "BODYWEIGHT_PLUS" && !conCuerpo);
  // En BODYWEIGHT_PLUS sin cuerpo solo cuentan las series a la carga de la clave.
  const ref = unidad === "BODYWEIGHT_PLUS" && !conCuerpo ? cargaAñadida(sets) : null;

  const valor = (s: SetLog): number | null => {
    if (ref !== null && s.weight_value !== ref) return null;
    if (cargaFija) return 1 + s.reps / 30;
    // Sin peso tecleado (el aviso ámbar) la serie no se valora: null no es cero.
    if (s.weight_value === null || s.reps > MAX_REPS_E1RM) return null;
    return epley(conCuerpo ? pesoCorporal + s.weight_value : s.weight_value, s.reps);
  };

  const porLado = new Map<string, number[]>();
  for (const s of sets) {
    const v = valor(s);
    if (v === null) continue;
    const k = s.side ?? "-";
    porLado.set(k, [...(porLado.get(k) ?? []), v]);
  }

  const lados = [...porLado.values()].map((vs) => {
    const dos = vs.sort((a, b) => b - a).slice(0, 2);
    return dos.reduce((a, b) => a + b, 0) / dos.length;
  });
  return lados.length > 0 ? lados.reduce((a, b) => a + b, 0) / lados.length : null;
}

// ── Estado por ejercicio (§11.3, §11.4) ──────────────────────────────────────

/** Una aparición CERRADA con series reales, como la entrega el loader. */
export interface Aparicion {
  fecha: string;
  sets: SetLog[];
  deload: boolean;
  /** Solo BODYWEIGHT_PLUS con registros en la unidad del añadido (§11.2). */
  pesoCorporal: number | null;
}

export interface PuntoMarca {
  fecha: string;
  marca: number;
  sets: SetLog[];
  /** Esta aparición superó estrictamente a todas las anteriores. */
  mejorNueva: boolean;
}

export type EstadoProgreso =
  | "sin_registros"
  | "sin_registrar"
  | "pocos_datos"
  | "subiendo"
  | "por_debajo"
  | "estancado";

export interface ProgresoEjercicio {
  estado: EstadoProgreso;
  /** Comparables con marca, cronológicas. Lo que se grafica. */
  puntos: PuntoMarca[];
  mejor: PuntoMarca | null;
  /** Fecha de la aparición más reciente, comparable o no. */
  ultimaFecha: string | null;
  /** Apariciones fuera de la línea: con otra clave (o sin marca), y de descarga. */
  otraCarga: number;
  deload: number;
  /**
   * subiendo: últimas vs primeras. por_debajo: últimas vs mejor. Fracción
   * (0.22 = +22%). null en los demás estados.
   */
  cambio: number | null;
  /** Semanas desde la mejor marca (estancado). */
  semanasSinMejorar: number | null;
  /** La línea mide cuerpo + añadido (BODYWEIGHT_PLUS con peso corporal). */
  conPesoCorporal: boolean;
}

/**
 * De las entradas de `getPerformanceHistory` (descendentes, con series reales) a
 * apariciones cronológicas. La sesión activa queda fuera (§11.2): se está
 * registrando y llegaría incompleta, igual que en el veredicto. `pesos`: todos
 * los `BodyweightLog`; cada aparición de BODYWEIGHT_PLUS toma el suyo.
 */
export function aparicionesDe(
  entries: { session: Session; sets: SetLog[] }[],
  pesos: Pick<BodyweightLog, "fecha" | "valor" | "unidad">[] = [],
): Aparicion[] {
  return entries
    .filter((e) => e.session.activa === 0)
    .sort((a, b) => a.session.iniciada_en.localeCompare(b.session.iniciada_en))
    .map((e) => {
      const s = e.sets[0];
      return {
        fecha: e.session.fecha,
        sets: e.sets,
        deload: e.session.tag_ids.includes(TAG_DELOAD),
        pesoCorporal:
          s?.weight_unit === "BODYWEIGHT_PLUS" && s.added_unit
            ? pesoCorporalEn(pesos, e.session.fecha, s.added_unit)
            : null,
      };
    });
}

const promedio = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * `apariciones` en orden cronológico. `hoy` en ISO local (`todayISO`). El orden de
 * evaluación es el de la tabla de §11.4: el primero que aplica gana.
 */
export function evaluarProgreso(apariciones: Aparicion[], hoy: string): ProgresoEjercicio {
  const vacio: ProgresoEjercicio = {
    estado: "sin_registros",
    puntos: [],
    mejor: null,
    ultimaFecha: null,
    otraCarga: 0,
    deload: 0,
    cambio: null,
    semanasSinMejorar: null,
    conPesoCorporal: false,
  };
  if (apariciones.length === 0) return vacio;

  const ultimaFecha = apariciones[apariciones.length - 1].fecha;
  const deload = apariciones.filter((a) => a.deload).length;
  // La clave sale de la más reciente que NO es de descarga: una semana de
  // descarga a otra carga no debe volver incomparable todo lo anterior.
  const normales = apariciones.filter((a) => !a.deload);
  const referencia = normales[normales.length - 1];

  const puntos: PuntoMarca[] = [];
  if (referencia) {
    const clave = claveComparable(referencia.sets, referencia.pesoCorporal);
    let mejor = -Infinity;
    for (const a of normales) {
      if (claveComparable(a.sets, a.pesoCorporal) !== clave) continue;
      const marca = marcaDeAparicion(a.sets, a.pesoCorporal);
      if (marca === null) continue;
      // Estrictamente mayor: un empate no es mejor marca. El epsilon relativo
      // solo absorbe el ruido de coma flotante.
      const mejorNueva = marca > mejor * (1 + 1e-9);
      if (mejorNueva) mejor = marca;
      puntos.push({ fecha: a.fecha, marca, sets: a.sets, mejorNueva });
    }
  }

  const mejorPunto = puntos.filter((p) => p.mejorNueva).at(-1) ?? null;
  const base = {
    ...vacio,
    puntos,
    mejor: mejorPunto,
    ultimaFecha,
    otraCarga: normales.length - puntos.length,
    deload,
    conPesoCorporal: (referencia?.pesoCorporal ?? null) !== null,
  };

  if (diasEntre(ultimaFecha, hoy) > DIAS_SIN_REGISTRAR) return { ...base, estado: "sin_registrar" };
  if (puntos.length < MIN_COMPARABLES || !mejorPunto) return { ...base, estado: "pocos_datos" };

  const ultimas = promedio(puntos.slice(-VENTANA_RECIENTE).map((p) => p.marca));

  if (puntos.slice(-VENTANA_RECIENTE).some((p) => p.mejorNueva)) {
    const primeras = promedio(puntos.slice(0, VENTANA_RECIENTE).map((p) => p.marca));
    return { ...base, estado: "subiendo", cambio: (ultimas - primeras) / primeras };
  }
  if (ultimas <= mejorPunto.marca * FRACCION_POR_DEBAJO) {
    return { ...base, estado: "por_debajo", cambio: (ultimas - mejorPunto.marca) / mejorPunto.marca };
  }
  return {
    ...base,
    estado: "estancado",
    semanasSinMejorar: Math.floor(diasEntre(mejorPunto.fecha, hoy) / 7),
  };
}

// ── Semana desde la última pausa (§11.5) ─────────────────────────────────────

export interface Bloque {
  /** Primera sesión después de la pausa más reciente (o la primera de todas). */
  inicio: string;
  /** La última sesión es de descarga: todavía no empezó un bloque nuevo. */
  enDescarga: boolean;
}

/** `sesiones`: cerradas con series, en cualquier orden. */
export function bloqueActual(sesiones: { fecha: string; deload: boolean }[]): Bloque | null {
  if (sesiones.length === 0) return null;
  const orden = sesiones.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));

  let inicio = orden[0].fecha;
  for (let i = 1; i < orden.length; i++) {
    if (diasEntre(orden[i - 1].fecha, orden[i].fecha) >= DIAS_PAUSA) inicio = orden[i].fecha;
  }

  const ultimaDescarga = orden.filter((s) => s.deload).at(-1)?.fecha ?? null;
  if (ultimaDescarga) {
    const despues = orden.find((s) => s.fecha > ultimaDescarga);
    if (!despues) return { inicio: ultimaDescarga, enDescarga: true };
    if (despues.fecha > inicio) inicio = despues.fecha;
  }
  return { inicio, enDescarga: false };
}

// ── Balance semanal (§11.6) ──────────────────────────────────────────────────

export interface SemanaBalance {
  lunes: string;
  /** Suma de netos `mejor − peor` de las sesiones de la semana. */
  net: number;
  /** 0 = semana sin sesiones: un hueco, no un cero. */
  sesiones: number;
  deload: boolean;
}

/**
 * Las últimas `n` semanas hasta la de `hoy`, sin empezar antes de la primera
 * sesión. `sesiones`: cerradas con series, con su neto ya calculado por
 * `netFromVerdicts` — la misma regla de los badges, sumada.
 */
export function balanceSemanal(
  sesiones: { fecha: string; net: number; deload: boolean }[],
  hoy: string,
  n: number,
): SemanaBalance[] {
  if (sesiones.length === 0) return [];
  const primera = lunesDe(sesiones.reduce((a, b) => (a.fecha < b.fecha ? a : b)).fecha);
  const actual = lunesDe(hoy);

  const porSemana = new Map<string, SemanaBalance>();
  for (const s of sesiones) {
    const lunes = lunesDe(s.fecha);
    const sem = porSemana.get(lunes) ?? { lunes, net: 0, sesiones: 0, deload: false };
    sem.net += s.net;
    sem.sesiones += 1;
    sem.deload ||= s.deload;
    porSemana.set(lunes, sem);
  }

  const out: SemanaBalance[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const lunes = sumarDias(actual, -7 * i);
    if (lunes < primera) continue;
    out.push(porSemana.get(lunes) ?? { lunes, net: 0, sesiones: 0, deload: false });
  }
  return out;
}
