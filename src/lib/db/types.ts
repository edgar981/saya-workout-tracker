/**
 * Tipos del modelo. Autoridad: DECISIONES.md §3.
 *
 * Regla que atraviesa todo el archivo (D4): `weight_unit`, `weight_basis` y
 * `added_unit` viven en cada SetLog como SNAPSHOT. Nunca se leen por join
 * contra Exercise. Si mañana cambia el unit_type de un ejercicio, el histórico
 * no muta.
 */

export type UnitType =
  | "KG"
  | "LB"
  | "BODYWEIGHT"
  | "BODYWEIGHT_PLUS"
  /**
   * Sin ejercicios en la semilla (DECISIONES.md §7.4: los stacks del gym están
   * marcados en libras). Se conserva deliberadamente para la máquina sin marcar
   * que aparezca algún día. No eliminar.
   */
  | "STACK_POSITION";

export type WeightBasis = "TOTAL" | "PER_IMPLEMENT";
export type AddedUnit = "KG" | "LB";
export type Side = "L" | "R";
export type Laterality = "BILATERAL" | "UNILATERAL";

export interface Exercise {
  id: string;
  nombre: string;
  unit_type: UnitType;
  /** null si BODYWEIGHT o STACK_POSITION */
  weight_basis: WeightBasis | null;
  /** solo si BODYWEIGHT_PLUS */
  added_unit: AddedUnit | null;
  /** solo si STACK_POSITION */
  stack_label: string | null;
  laterality_default: Laterality;
  activo: boolean;
}

export interface RoutineDay {
  id: string;
  nombre: string;
  orden: number;
}

export interface RoutineSlot {
  id: string;
  routine_day_id: string;
  exercise_id: string;
  orden: number;
  target_sets: number | null;
  target_reps: number | null;
  /** multiEntry */
  alternative_exercise_ids: string[];
}

export interface Session {
  id: string;
  /** ISO date, YYYY-MM-DD */
  fecha: string;
  routine_day_id: string | null;
  iniciada_en: string;
  cerrada_en: string | null;
  /**
   * Indexado. IndexedDB no indexa null, undefined ni booleanos de forma
   * confiable, así que la sesión activa se encuentra por este número y no por
   * `where('cerrada_en').equals(null)`, que devuelve vacío siempre.
   */
  activa: 0 | 1;
  nota: string | null;
  /** multiEntry */
  tag_ids: string[];
}

export interface SessionExercise {
  id: string;
  session_id: string;
  routine_slot_id: string | null;
  /** El que REALMENTE se hizo. Difiere del slot cuando hubo sustitución. */
  exercise_id: string;
  orden: number;
  nota: string | null;
}

export interface SetLog {
  id: string;
  session_exercise_id: string;
  /** 1-based */
  set_index: number;
  /** 0 en series normales; 0..n en giant sets */
  segment_index: number;
  reps: number;
  /** decimal — soporta 37.5 */
  weight_value: number | null;
  /** SNAPSHOT */
  weight_unit: UnitType;
  /** SNAPSHOT */
  weight_basis: WeightBasis | null;
  /** SNAPSHOT */
  added_unit: AddedUnit | null;
  side: Side | null;
  es_extra: boolean;
}

export interface SessionTag {
  id: string;
  nombre: string;
}

export interface BodyweightLog {
  id: string;
  fecha: string;
  valor: number;
  unidad: "KG" | "LB";
}
