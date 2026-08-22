import { db } from "./db";
import type {
  Exercise,
  RoutineDay,
  RoutineSlot,
  Session,
  SessionExercise,
  SetLog,
  Side,
} from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

/** Fecha local, no UTC: una sesión de las 9pm no debe caer al día siguiente. */
export function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Orden de lectura de las series: por serie, luego por segmento del giant set,
 * luego L antes que R.
 */
export function compareSets(a: SetLog, b: SetLog): number {
  if (a.set_index !== b.set_index) return a.set_index - b.set_index;
  if (a.segment_index !== b.segment_index) return a.segment_index - b.segment_index;
  const rank = (s: Side | null) => (s === null ? 0 : s === "L" ? 1 : 2);
  return rank(a.side) - rank(b.side);
}

// ── Sesión ──────────────────────────────────────────────────────────────────

/**
 * IndexedDB no indexa null ni booleanos de forma confiable, por eso esto va
 * contra `activa` (1|0) y no contra `cerrada_en`.
 */
export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where("activa").equals(1).first();
}

export async function startSession(routineDayId: string | null): Promise<string> {
  const existing = await getActiveSession();
  if (existing) return existing.id;

  const sessionId = newId();
  const now = new Date().toISOString();
  const slots = routineDayId
    ? await db.routineSlots.where("routine_day_id").equals(routineDayId).sortBy("orden")
    : [];

  await db.transaction("rw", [db.sessions, db.sessionExercises], async () => {
    await db.sessions.add({
      id: sessionId,
      fecha: todayISO(),
      routine_day_id: routineDayId,
      iniciada_en: now,
      cerrada_en: null,
      activa: 1,
      nota: null,
      tag_ids: [],
    });
    await db.sessionExercises.bulkAdd(
      slots.map((slot, i) => ({
        id: newId(),
        session_id: sessionId,
        routine_slot_id: slot.id,
        exercise_id: slot.exercise_id,
        orden: i + 1,
        nota: null,
      })),
    );
  });

  return sessionId;
}

export interface CloseSessionInput {
  nota: string | null;
  tagIds: string[];
  bodyweight: { valor: number; unidad: "KG" | "LB" } | null;
}

export async function closeSession(sessionId: string, input: CloseSessionInput): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction("rw", [db.sessions, db.bodyweightLogs], async () => {
    await db.sessions.update(sessionId, {
      activa: 0,
      cerrada_en: now,
      nota: input.nota,
      tag_ids: input.tagIds,
    });
    if (input.bodyweight) {
      await db.bodyweightLogs.add({
        id: newId(),
        fecha: todayISO(),
        valor: input.bodyweight.valor,
        unidad: input.bodyweight.unidad,
      });
    }
  });
}

/** Borrado duro (D8). Un log de gym no es un registro auditable. */
export async function discardSession(sessionId: string): Promise<void> {
  await db.transaction("rw", [db.sessions, db.sessionExercises, db.setLogs], async () => {
    const items = await db.sessionExercises.where("session_id").equals(sessionId).toArray();
    for (const item of items) {
      await db.setLogs.where("session_exercise_id").equals(item.id).delete();
    }
    await db.sessionExercises.where("session_id").equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

// ── Vista compuesta de la sesión ────────────────────────────────────────────

export interface SessionExerciseView {
  sessionExercise: SessionExercise;
  /** El que realmente se está haciendo. */
  exercise: Exercise;
  slot: RoutineSlot | null;
  /** El que la plantilla planeaba. Null si la instancia no viene de un slot. */
  slotExercise: Exercise | null;
  /**
   * Derivada, no almacenada (DECISIONES.md §3.2): hay sustitución cuando la
   * instancia viene de un slot y el ejercicio ejecutado difiere del planeado.
   */
  isSubstitution: boolean;
  alternatives: Exercise[];
  sets: SetLog[];
}

export interface SessionView {
  session: Session;
  routineDay: RoutineDay | null;
  items: SessionExerciseView[];
}

export async function loadSessionView(sessionId: string): Promise<SessionView | null> {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;

  const routineDay = session.routine_day_id
    ? ((await db.routineDays.get(session.routine_day_id)) ?? null)
    : null;

  const sessionExercises = await db.sessionExercises
    .where("session_id")
    .equals(sessionId)
    .sortBy("orden");

  const items: SessionExerciseView[] = [];
  for (const se of sessionExercises) {
    const exercise = await db.exercises.get(se.exercise_id);
    if (!exercise) continue;

    const slot = se.routine_slot_id ? ((await db.routineSlots.get(se.routine_slot_id)) ?? null) : null;
    const slotExercise = slot ? ((await db.exercises.get(slot.exercise_id)) ?? null) : null;

    const alternatives: Exercise[] = [];
    if (slot) {
      for (const altId of slot.alternative_exercise_ids) {
        const alt = await db.exercises.get(altId);
        if (alt) alternatives.push(alt);
      }
    }

    const sets = await db.setLogs.where("session_exercise_id").equals(se.id).toArray();
    sets.sort(compareSets);

    items.push({
      sessionExercise: se,
      exercise,
      slot,
      slotExercise,
      isSubstitution: !!slot && slot.exercise_id !== se.exercise_id,
      alternatives,
      sets,
    });
  }

  return { session, routineDay, items };
}

// ── Precarga desde la última sesión ─────────────────────────────────────────

export interface LastPerformance {
  session: Session;
  sets: SetLog[];
}

/**
 * Busca por `exercise_id`, NO por slot. Si la vez pasada sustituiste Squats por
 * Hack Squats, hoy al hacer Hack Squats ves el historial de Hack Squats — que
 * es el único que sirve para elegir el peso de la próxima serie.
 */
export async function getLastPerformance(
  exerciseId: string,
  excludeSessionId: string,
): Promise<LastPerformance | null> {
  const instances = await db.sessionExercises.where("exercise_id").equals(exerciseId).toArray();
  const others = instances.filter((i) => i.session_id !== excludeSessionId);
  if (others.length === 0) return null;

  const sessionIds = [...new Set(others.map((o) => o.session_id))];
  const sessions = await db.sessions.bulkGet(sessionIds);
  const byId = new Map<string, Session>();
  sessions.forEach((s) => {
    if (s) byId.set(s.id, s);
  });

  const candidates = others
    .map((inst) => ({ inst, session: byId.get(inst.session_id) }))
    .filter((c): c is { inst: SessionExercise; session: Session } => !!c.session)
    .sort((a, b) => b.session.iniciada_en.localeCompare(a.session.iniciada_en));

  for (const c of candidates) {
    const sets = await db.setLogs.where("session_exercise_id").equals(c.inst.id).toArray();
    if (sets.length > 0) {
      sets.sort(compareSets);
      return { session: c.session, sets };
    }
  }

  return null;
}

// ── Series ──────────────────────────────────────────────────────────────────

interface Prefill {
  reps: number;
  weight: number | null;
}

/**
 * De dónde salen los valores por defecto de una serie nueva:
 *   1. la última serie de este mismo ejercicio en esta sesión,
 *   2. si no hay, la última sesión donde se hizo este exercise_id,
 *   3. si no hay, vacío.
 *
 * El peso solo se arrastra si los snapshots de unidad coinciden. Si el
 * ejercicio cambió de unidad desde entonces, se hereda las reps y el peso queda
 * en blanco: convertirlo está prohibido (D5) y copiarlo tal cual sería peor.
 */
async function computePrefill(sessionExerciseId: string, exercise: Exercise): Promise<Prefill> {
  const own = await db.setLogs.where("session_exercise_id").equals(sessionExerciseId).toArray();
  if (own.length > 0) {
    own.sort(compareSets);
    return fromSet(own[own.length - 1], exercise);
  }

  const se = await db.sessionExercises.get(sessionExerciseId);
  if (se) {
    const last = await getLastPerformance(exercise.id, se.session_id);
    if (last && last.sets.length > 0) return fromSet(last.sets[0], exercise);
  }

  return { reps: 0, weight: null };
}

function fromSet(set: SetLog, exercise: Exercise): Prefill {
  const sameUnit =
    set.weight_unit === exercise.unit_type &&
    set.weight_basis === exercise.weight_basis &&
    set.added_unit === exercise.added_unit;
  return { reps: set.reps, weight: sameUnit ? set.weight_value : null };
}

/**
 * "AUTO" respeta la lateralidad del ejercicio: en UNILATERAL crea dos filas
 * (mismo set_index, side L y R); en BILATERAL, una sola con side null.
 * Un lado explícito crea una sola fila — que es el caso de la serie extra a un
 * lado.
 */
export type SideChoice = "AUTO" | "L" | "R";

export async function addSet(
  sessionExerciseId: string,
  opts: { esExtra: boolean; side: SideChoice },
): Promise<void> {
  const se = await db.sessionExercises.get(sessionExerciseId);
  if (!se) return;
  const exercise = await db.exercises.get(se.exercise_id);
  if (!exercise) return;

  const existing = await db.setLogs.where("session_exercise_id").equals(sessionExerciseId).toArray();
  const nextIndex = existing.length === 0 ? 1 : Math.max(...existing.map((s) => s.set_index)) + 1;
  const prefill = await computePrefill(sessionExerciseId, exercise);

  const sides: (Side | null)[] =
    opts.side === "AUTO"
      ? exercise.laterality_default === "UNILATERAL"
        ? ["L", "R"]
        : [null]
      : [opts.side];

  const rows: SetLog[] = sides.map((side) => ({
    id: newId(),
    session_exercise_id: sessionExerciseId,
    set_index: nextIndex,
    segment_index: 0,
    reps: prefill.reps,
    weight_value: exercise.unit_type === "BODYWEIGHT" ? null : prefill.weight,
    // Snapshots (D4). Copiados aquí y nunca releídos por join.
    weight_unit: exercise.unit_type,
    weight_basis: exercise.weight_basis,
    added_unit: exercise.added_unit,
    side,
    es_extra: opts.esExtra,
  }));

  await db.setLogs.bulkAdd(rows);
}

/**
 * Giant set: MISMO set_index, segment_index incremental. Seis segmentos son una
 * serie con seis tramos, no seis series (DECISIONES.md §3.2).
 */
export async function addSegment(sessionExerciseId: string, setIndex: number): Promise<void> {
  const group = (await db.setLogs.where("session_exercise_id").equals(sessionExerciseId).toArray())
    .filter((s) => s.set_index === setIndex)
    .sort(compareSets);
  if (group.length === 0) return;

  const source = group[group.length - 1];
  const nextSegment = Math.max(...group.map((s) => s.segment_index)) + 1;

  await db.setLogs.add({
    ...source,
    id: newId(),
    segment_index: nextSegment,
  });
}

export async function updateSet(setId: string, changes: Partial<SetLog>): Promise<void> {
  await db.setLogs.update(setId, changes);
}

/** Borrado duro, sin modal (D8). */
export async function deleteSet(setId: string): Promise<void> {
  await db.setLogs.delete(setId);
}

export async function deleteSetGroup(sessionExerciseId: string, setIndex: number): Promise<void> {
  const ids = (await db.setLogs.where("session_exercise_id").equals(sessionExerciseId).toArray())
    .filter((s) => s.set_index === setIndex)
    .map((s) => s.id);
  await db.setLogs.bulkDelete(ids);
}

// ── Ejercicio dentro de la sesión ───────────────────────────────────────────

/**
 * Cambiar el ejercicio ejecutado. La sustitución no se escribe en ningún campo:
 * queda implícita en que exercise_id ya no coincide con el del slot.
 *
 * Las series ya registradas conservan sus snapshots de unidad y se siguen
 * mostrando con ellos, aunque el ejercicio nuevo use otra unidad. Es feo a
 * propósito: es más honesto que reescribir historia.
 */
export async function substituteExercise(
  sessionExerciseId: string,
  exerciseId: string,
): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { exercise_id: exerciseId });
}

export async function updateSessionExerciseNote(
  sessionExerciseId: string,
  nota: string | null,
): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { nota });
}

export async function listActiveExercises(): Promise<Exercise[]> {
  const all = await db.exercises.toArray();
  return all.filter((e) => e.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
