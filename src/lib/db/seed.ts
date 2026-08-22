import { db } from "./db";
import type { Exercise, RoutineDay, RoutineSlot, SessionTag } from "./types";

/**
 * Catálogo semilla. Autoridad: DECISIONES.md §4. Nada de esto se inventa.
 *
 * Los ids son deterministas (no uuid) para que el seed sea idempotente y para
 * que las referencias de alternativas se puedan escribir a mano y leer.
 *
 * Notas que el catálogo codifica y conviene no perder:
 *
 * - `Incline DB Press (suma)` lleva el sufijo en el NOMBRE porque es el único
 *   ejercicio de mancuernas con weight_basis TOTAL (§7.1). El nombre es el
 *   recordatorio de no anotar 75 el día que se te olvide.
 * - Los cuatro de cable van en LB/TOTAL: los stacks del gym están marcados en
 *   libras, así que no hay nada que calibrar (§7.4).
 * - STACK_POSITION no lo usa ningún ejercicio. Es deliberado.
 * - `target_sets` y `target_reps` van en null: DECISIONES.md §4 no registra los
 *   objetivos por ejercicio, y ponerlos sería inventar datos. La UI omite el
 *   badge de objetivo mientras sean null.
 */

const KG_TOTAL = { unit_type: "KG", weight_basis: "TOTAL", added_unit: null, stack_label: null } as const;
const LB_TOTAL = { unit_type: "LB", weight_basis: "TOTAL", added_unit: null, stack_label: null } as const;
const LB_PER_IMPLEMENT = { unit_type: "LB", weight_basis: "PER_IMPLEMENT", added_unit: null, stack_label: null } as const;
const BW = { unit_type: "BODYWEIGHT", weight_basis: null, added_unit: null, stack_label: null } as const;
const BW_PLUS_KG = { unit_type: "BODYWEIGHT_PLUS", weight_basis: "TOTAL", added_unit: "KG", stack_label: null } as const;
const BW_PLUS_LB = { unit_type: "BODYWEIGHT_PLUS", weight_basis: "TOTAL", added_unit: "LB", stack_label: null } as const;

export const SEED_EXERCISES: Exercise[] = [
  // ── Day 1 ────────────────────────────────────────────────────────────────
  { id: "ex-pull-up", nombre: "Pull Up", ...BW_PLUS_KG, laterality_default: "BILATERAL", activo: true },
  { id: "ex-pull-down", nombre: "Pull Down", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-incline-bench-medium", nombre: "Incline Bench Press Medium Grip", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-incline-db-press", nombre: "Incline DB Press (suma)", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },

  // ── Day 2 ────────────────────────────────────────────────────────────────
  { id: "ex-db-skull-crushers", nombre: "DB Skull Crushers", ...LB_PER_IMPLEMENT, laterality_default: "BILATERAL", activo: true },
  { id: "ex-db-oh-triceps-extension", nombre: "DB OH Triceps Extension", ...LB_PER_IMPLEMENT, laterality_default: "BILATERAL", activo: true },
  { id: "ex-db-lateral-raises", nombre: "DB Lateral Raises", ...LB_PER_IMPLEMENT, laterality_default: "BILATERAL", activo: true },
  { id: "ex-barbell-bicep-curls", nombre: "Barbell Bicep Curls", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-barbell-standing-wrist-curl", nombre: "Barbell Standing Wrist Curl", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },

  // ── Day 3 ────────────────────────────────────────────────────────────────
  { id: "ex-squats", nombre: "Squats", ...KG_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-hack-squats", nombre: "Hack Squats", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-matrix-hack-squats", nombre: "Matrix Hack Squats", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-leg-curl", nombre: "Leg Curl", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-lying-leg-curl", nombre: "Lying Leg Curl", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-hanging-leg-raises", nombre: "Hanging Leg Raises", ...BW, laterality_default: "BILATERAL", activo: true },
  { id: "ex-weighted-decline-crunches", nombre: "Weighted Decline Crunches", ...BW_PLUS_LB, laterality_default: "BILATERAL", activo: true },
  { id: "ex-leg-extensions", nombre: "Leg Extensions", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-calf-raises", nombre: "Calf Raises", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },

  // ── Day 4 ────────────────────────────────────────────────────────────────
  { id: "ex-incline-bench-wide", nombre: "Incline Bench Press Wide Grip", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-weighted-dips", nombre: "Weighted Dips", ...BW_PLUS_KG, laterality_default: "BILATERAL", activo: true },
  { id: "ex-wide-grip-pull-down", nombre: "Wide Grip Pull Down", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-wide-grip-pull-up", nombre: "Wide Grip Pull Up (bw)", ...BW_PLUS_KG, laterality_default: "BILATERAL", activo: true },
  { id: "ex-chest-supported-rows", nombre: "Chest Supported Rows", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-close-grip-bench-press", nombre: "Close Grip Bench Press", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },

  // ── Day 5 ────────────────────────────────────────────────────────────────
  { id: "ex-ez-bar-curl", nombre: "EZ Bar Curl", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-db-bicep-curl", nombre: "DB Bicep Curl", ...LB_PER_IMPLEMENT, laterality_default: "BILATERAL", activo: true },
  { id: "ex-cable-curl", nombre: "Cable Curl", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-single-arm-cable-curl", nombre: "Single Arm Cable Curl", ...LB_TOTAL, laterality_default: "UNILATERAL", activo: true },
  { id: "ex-cable-lateral-raises", nombre: "Cable Lateral Raises", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-single-arm-cable-push-down", nombre: "Single Arm Cable Push Down", ...LB_TOTAL, laterality_default: "UNILATERAL", activo: true },
  { id: "ex-forearm-curls", nombre: "Forearm Curls", ...LB_TOTAL, laterality_default: "BILATERAL", activo: true },
  { id: "ex-concentration-hammer-curls", nombre: "Concentration Hammer Curls", ...LB_PER_IMPLEMENT, laterality_default: "UNILATERAL", activo: true },
];

export const SEED_ROUTINE_DAYS: RoutineDay[] = [
  { id: "day-1", nombre: "Day 1", orden: 1 },
  { id: "day-2", nombre: "Day 2", orden: 2 },
  { id: "day-3", nombre: "Day 3", orden: 3 },
  { id: "day-4", nombre: "Day 4", orden: 4 },
  { id: "day-5", nombre: "Day 5", orden: 5 },
];

/**
 * Plantillas. Solo se declaran las tres relaciones de alternativa que
 * DECISIONES.md documenta explícitamente:
 *
 *   - Hack Squats es alternativa de Squats (§4, sustitución registrada en una
 *     sesión real). unit_type distinto: KG vs LB.
 *   - Wide Grip Pull Up (bw) es alternativa de Wide Grip Pull Down (§4).
 *     unit_type distinto: BODYWEIGHT_PLUS vs LB.
 *   - Single Arm Cable Curl es alternativa de Cable Curl (§3.1, el caso que
 *     motiva la tabla RoutineSlotAlternative).
 *
 * Todo lo demás de §4 tiene slot propio. `Matrix Hack Squats`, `Lying Leg Curl`
 * y `Cable Lateral Raises` quedan como slots independientes porque el documento
 * no los declara alternativas de nada.
 */
type SlotSeed = { exercise_id: string; alternatives?: string[] };

const SLOTS_BY_DAY: Record<string, SlotSeed[]> = {
  "day-1": [
    { exercise_id: "ex-pull-up" },
    { exercise_id: "ex-pull-down" },
    { exercise_id: "ex-incline-bench-medium" },
    { exercise_id: "ex-incline-db-press" },
  ],
  "day-2": [
    { exercise_id: "ex-db-skull-crushers" },
    { exercise_id: "ex-db-oh-triceps-extension" },
    { exercise_id: "ex-db-lateral-raises" },
    { exercise_id: "ex-barbell-bicep-curls" },
    { exercise_id: "ex-barbell-standing-wrist-curl" },
  ],
  "day-3": [
    { exercise_id: "ex-squats", alternatives: ["ex-hack-squats"] },
    { exercise_id: "ex-matrix-hack-squats" },
    { exercise_id: "ex-leg-curl" },
    { exercise_id: "ex-lying-leg-curl" },
    { exercise_id: "ex-hanging-leg-raises" },
    { exercise_id: "ex-weighted-decline-crunches" },
    { exercise_id: "ex-leg-extensions" },
    { exercise_id: "ex-calf-raises" },
  ],
  "day-4": [
    { exercise_id: "ex-incline-bench-wide" },
    { exercise_id: "ex-weighted-dips" },
    { exercise_id: "ex-wide-grip-pull-down", alternatives: ["ex-wide-grip-pull-up"] },
    { exercise_id: "ex-chest-supported-rows" },
    { exercise_id: "ex-close-grip-bench-press" },
  ],
  "day-5": [
    { exercise_id: "ex-ez-bar-curl" },
    { exercise_id: "ex-db-bicep-curl" },
    { exercise_id: "ex-cable-curl", alternatives: ["ex-single-arm-cable-curl"] },
    { exercise_id: "ex-cable-lateral-raises" },
    { exercise_id: "ex-single-arm-cable-push-down" },
    { exercise_id: "ex-forearm-curls" },
    { exercise_id: "ex-concentration-hammer-curls" },
  ],
};

export const SEED_ROUTINE_SLOTS: RoutineSlot[] = SEED_ROUTINE_DAYS.flatMap((day) =>
  SLOTS_BY_DAY[day.id].map((slot, i) => ({
    id: `slot-${day.id}-${i + 1}`,
    routine_day_id: day.id,
    exercise_id: slot.exercise_id,
    orden: i + 1,
    target_sets: null,
    target_reps: null,
    alternative_exercise_ids: slot.alternatives ?? [],
  })),
);

/**
 * DECISIONES.md §3.3 los marca [Guessing]: salen de una sola anotación en cinco
 * días de datos. Los chips reales emergen del uso.
 */
export const SEED_SESSION_TAGS: SessionTag[] = [
  { id: "tag-dormi-mal", nombre: "dormí mal" },
  { id: "tag-deload", nombre: "deload" },
  { id: "tag-maquina-distinta", nombre: "máquina distinta" },
  { id: "tag-molestia", nombre: "molestia" },
  { id: "tag-sin-tiempo", nombre: "sin tiempo" },
  { id: "tag-bajo-la-fuerza", nombre: "bajó la fuerza" },
];

/**
 * Corre una sola vez. La guarda es `exercises` vacía: si hay aunque sea un
 * ejercicio, no se toca nada — un seed que reescribe catálogo pisaría ediciones
 * del usuario y, peor, cambiaría unidades bajo series ya registradas.
 */
export async function seedIfEmpty(): Promise<boolean> {
  const count = await db.exercises.count();
  if (count > 0) return false;

  await db.transaction(
    "rw",
    [db.exercises, db.routineDays, db.routineSlots, db.sessionTags],
    async () => {
      // Re-chequeo dentro de la transacción: dos pestañas abriendo la app a la
      // vez llegarían aquí las dos.
      if ((await db.exercises.count()) > 0) return;
      await db.exercises.bulkAdd(SEED_EXERCISES);
      await db.routineDays.bulkAdd(SEED_ROUTINE_DAYS);
      await db.routineSlots.bulkAdd(SEED_ROUTINE_SLOTS);
      await db.sessionTags.bulkAdd(SEED_SESSION_TAGS);
    },
  );

  return true;
}
