import type { SetLog } from "@/lib/db/types";

/**
 * Veredicto por ejercicio: esta aparición contra la anterior del MISMO
 * exercise_id (capa 2, parte 1). Funciones PURAS, sin Dexie: el loader que trae
 * la aparición anterior vive en `db/verdicts.ts` y este módulo solo compara.
 *
 * Reglas en un solo lugar (§2). No se convierte entre unidades; la comparación
 * es solo dentro de la misma tupla (weight_unit, weight_basis) — §3.5.
 */

/** Umbral de "igual": por debajo es ruido de medición, no señal. Un solo lugar. */
export const UMBRAL_IGUAL = 0.02;

/** Epley deja de ser confiable arriba de esto; no se calcula e1RM por encima. */
export const MAX_REPS_E1RM = 12;

export type VerdictCategory = "mejor" | "igual" | "peor" | "sin_comparacion";
export type VerdictMethod = "reps_totales" | "e1rm";
export type SinComparacionReason = "sin_historial" | "cambio_unidad" | "fuera_rango_e1rm";

export interface Verdict {
  category: VerdictCategory;
  /** Cuál método se usó — el veredicto debe exponerlo o el número no es auditable. */
  method: VerdictMethod | null;
  /** Solo si category === "sin_comparacion". */
  reason: SinComparacionReason | null;
  /** Valores comparados (reps totales, o e1RM). null en sin_comparacion. */
  current: number | null;
  previous: number | null;
}

function snapshotKey(sets: SetLog[]): string {
  const s = sets[0];
  return `${s.weight_unit}|${s.weight_basis ?? "NA"}`;
}

function totalReps(sets: SetLog[]): number {
  return sets.reduce((acc, s) => acc + s.reps, 0);
}

/** Pesos distintos (no null) de una aparición. */
function distinctWeights(sets: SetLog[]): number[] {
  return [...new Set(sets.filter((s) => s.weight_value !== null).map((s) => s.weight_value as number))];
}

/** Epley. Relativo, para comparar dos apariciones a peso distinto. */
function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** La mejor serie por e1RM (solo filas con peso). */
function bestE1rm(sets: SetLog[]): { e1rm: number; reps: number } | null {
  let best: { e1rm: number; reps: number } | null = null;
  for (const s of sets) {
    if (s.weight_value === null) continue;
    const v = epley(s.weight_value, s.reps);
    if (!best || v > best.e1rm) best = { e1rm: v, reps: s.reps };
  }
  return best;
}

function sinComparacion(reason: SinComparacionReason): Verdict {
  return { category: "sin_comparacion", method: null, reason, current: null, previous: null };
}

function categorize(current: number, previous: number, method: VerdictMethod): Verdict {
  let category: VerdictCategory;
  if (previous === 0) {
    category = current === 0 ? "igual" : "mejor";
  } else {
    const diff = (current - previous) / previous;
    if (Math.abs(diff) < UMBRAL_IGUAL) category = "igual";
    else category = current > previous ? "mejor" : "peor";
  }
  return { category, method, reason: null, current, previous };
}

function byTotalReps(current: SetLog[], previous: SetLog[]): Verdict {
  return categorize(totalReps(current), totalReps(previous), "reps_totales");
}

/**
 * Compara la aparición de esta sesión contra la anterior. `previous` es null
 * cuando no hay aparición previa con series.
 */
export function compareAppearances(current: SetLog[], previous: SetLog[] | null): Verdict {
  if (current.length === 0) return sinComparacion("sin_historial"); // defensivo; el loader ya filtra
  if (!previous || previous.length === 0) return sinComparacion("sin_historial");

  // §3.5: solo se compara dentro de la misma tupla (weight_unit, weight_basis).
  if (snapshotKey(current) !== snapshotKey(previous)) return sinComparacion("cambio_unidad");

  const unit = current[0].weight_unit;

  // BODYWEIGHT: no hay peso, se compara por reps totales.
  if (unit === "BODYWEIGHT") return byTotalReps(current, previous);

  // Con peso (KG, LB, BODYWEIGHT_PLUS=añadido, STACK_POSITION).
  const wCur = distinctWeights(current);
  const wPrev = distinctWeights(previous);

  // Si en alguna aparición no hay peso registrado (todos null), no se puede
  // peso/e1RM; se compara por reps, que es lo único disponible.
  if (wCur.length === 0 || wPrev.length === 0) return byTotalReps(current, previous);

  const mismoPeso = wCur.length === 1 && wPrev.length === 1 && wCur[0] === wPrev[0];

  // Mismo peso en ambas: reps totales. Exacto, sin fórmula, y el límite de 12
  // reps de e1RM NO bloquea (giant sets de 16 reps sí se comparan por reps).
  if (mismoPeso) return byTotalReps(current, previous);

  // Peso distinto: e1RM de la mejor serie, con límite duro de 12 reps.
  const bestCur = bestE1rm(current);
  const bestPrev = bestE1rm(previous);
  if (!bestCur || !bestPrev) return byTotalReps(current, previous);
  if (bestCur.reps > MAX_REPS_E1RM || bestPrev.reps > MAX_REPS_E1RM) {
    return sinComparacion("fuera_rango_e1rm");
  }
  return categorize(bestCur.e1rm, bestPrev.e1rm, "e1rm");
}
