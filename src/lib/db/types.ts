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
  /**
   * Borrado suave. Nunca se borra duro un Exercise: el histórico lo referencia
   * por `SessionExercise.exercise_id` y borrarlo dejaría el puntero colgando.
   */
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
  /**
   * Borrado suave (v2). Un slot está referenciado por el histórico vía
   * `SessionExercise.routine_slot_id`; borrarlo de verdad haría que las
   * sesiones viejas dejaran de mostrar el badge de sustitución — el pasado
   * cambiaría porque editaste el futuro.
   *
   * Las plantillas renderizan solo `activo === true`. El histórico resuelve
   * contra todos.
   */
  activo: boolean;
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
  /** null si se agregó ad-hoc, fuera de plantilla */
  routine_slot_id: string | null;
  /** El que REALMENTE se hizo. Difiere del slot cuando hubo sustitución. */
  exercise_id: string;
  /**
   * Posición en pantalla. Viene del slot y es FIJA durante la sesión: la lista
   * no se reacomoda sola entre series porque sería desorientador.
   */
  orden_visual: number;
  /**
   * Secuencia real en que se ejecutó. Derivado, nunca editado a mano: se asigna
   * en la PRIMERA escritura de serie de la instancia.
   *
   * BORDE (§1.2): borrar TODAS las series de una instancia NO devuelve este
   * campo a null — renumerar movería el de las demás. Por eso la invariante es
   * `orden_ejecucion !== null` significa "se empezó", NO "tiene series". Toda
   * consulta que lo use como proxy de ejecución debe verificar `sets.length`
   * aparte. De ahí los tres estados del historial: realizado (con series),
   * iniciado sin registro (0 series, orden_ejecucion !== null) y no realizado
   * (0 series, orden_ejecucion === null).
   */
  orden_ejecucion: number | null;
  /** ISO. Desempate para las instancias ad-hoc. */
  creado_en: string;
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
  /**
   * ISO. Cuándo se creó la fila — en la práctica, cuando terminaste la serie y la
   * anotaste. NO es indexado: se agrega solo a esta interfaz, sin declararlo en
   * `db.ts` / `stores()`, así que no hay bump a `version(3)` ni migración.
   *
   * Nullable a propósito: las filas anteriores a este cambio se quedan sin valor
   * (ausente / null). No se rellena un valor de respaldo desde `Session.iniciada_en`
   * — sería un dato falso presentado como observado (mismo criterio que
   * `orden_ejecucion`).
   *
   * El hueco entre dos `creado_en` consecutivos NO es descanso puro: incluye el
   * descanso MÁS la ejecución de la serie siguiente. Por eso no se rotula
   * "descanso" en ninguna parte de la UI. Se escribe solo al crear la fila;
   * editar reps o peso después no lo toca.
   */
  creado_en: string | null;
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
