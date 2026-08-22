import type { AddedUnit, SetLog, UnitType, WeightBasis } from "@/lib/db/types";

/**
 * Presentación de unidades. NO HAY CONVERSIÓN EN NINGUNA PARTE DE ESTE ARCHIVO
 * NI DE ESTE PROYECTO (DECISIONES.md D5).
 *
 * No existe un factor kg↔lb en el código. Dos series solo se comparan si
 * comparten la tupla (exercise_id, weight_unit, weight_basis); si no, se
 * muestran separadas y ya.
 */

/** Sufijo que acompaña al número en la UI. */
export function unitSuffix(
  unit: UnitType,
  basis: WeightBasis | null,
  addedUnit: AddedUnit | null,
  stackLabel: string | null = null,
): string {
  switch (unit) {
    case "KG":
      return basis === "PER_IMPLEMENT" ? "kg c/u" : "kg";
    case "LB":
      return basis === "PER_IMPLEMENT" ? "lb c/u" : "lb";
    case "BODYWEIGHT":
      return "";
    case "BODYWEIGHT_PLUS":
      return addedUnit === "KG" ? "kg" : "lb";
    case "STACK_POSITION":
      return stackLabel ?? "pos";
  }
}

export function hasWeightField(unit: UnitType): boolean {
  return unit !== "BODYWEIGHT";
}

/** Cómo se lee una serie ya guardada, usando SU PROPIO snapshot. */
export function formatSetWeight(set: SetLog, stackLabel: string | null = null): string {
  if (set.weight_unit === "BODYWEIGHT") return "peso corporal";
  if (set.weight_value === null) return "—";

  const suffix = unitSuffix(set.weight_unit, set.weight_basis, set.added_unit, stackLabel);
  const prefix = set.weight_unit === "BODYWEIGHT_PLUS" ? "+" : "";
  return `${prefix}${set.weight_value}${suffix ? ` ${suffix}` : ""}`;
}
