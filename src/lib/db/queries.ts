import { db } from "./db";
import type {
  AddedUnit,
  BodyweightLog,
  Exercise,
  Laterality,
  RoutineDay,
  RoutineSlot,
  Session,
  SessionExercise,
  SessionTag,
  SetLog,
  Side,
  UnitType,
  WeightBasis,
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

/**
 * IndexedDB no indexa booleanos, así que `activo` se filtra en memoria aunque
 * esté declarado en el índice. `where("activo").equals(true)` devuelve vacío
 * siempre — mismo problema que `cerrada_en` con null.
 */
function soloActivos<T extends { activo: boolean }>(filas: T[]): T[] {
  return filas.filter((f) => f.activo);
}

// ── Sesión ──────────────────────────────────────────────────────────────────

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where("activa").equals(1).first();
}

export async function startSession(routineDayId: string | null): Promise<string> {
  const sessionId = newId();
  const now = new Date().toISOString();

  const slots = routineDayId
    ? soloActivos(
        await db.routineSlots.where("routine_day_id").equals(routineDayId).toArray(),
      ).sort((a, b) => a.orden - b.orden)
    : [];

  await db.transaction("rw", [db.sessions, db.sessionExercises], async () => {
    // §1.1 — Invariante de sesión única. getLastPerformance NO filtra por
    // `activa`: su corrección depende de que exista una sola sesión abierta, y
    // el llamador le pasa el id de esa. Aquí se hace cumplir cerrando cualquier
    // otra sesión abierta en la MISMA transacción que crea la nueva, para que no
    // exista un instante con dos activas.
    const abiertas = await db.sessions.where("activa").equals(1).toArray();
    for (const abierta of abiertas) {
      await db.sessions.update(abierta.id, { activa: 0, cerrada_en: now });
    }

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
        orden_visual: i + 1,
        // Se asigna en la primera serie, no aquí. Null es "no lo hice".
        orden_ejecucion: null,
        creado_en: now,
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

/**
 * Borrado duro en cascada (D8). Dexie no tiene claves foráneas ni ON DELETE
 * CASCADE: si esto no barre a mano, quedan SetLog huérfanos que la verificación
 * de conteos del import NO detecta — cuenta lo que hay, y los huérfanos están
 * ahí. Todo en una sola transacción.
 */
export async function discardSession(sessionId: string): Promise<void> {
  await db.transaction("rw", [db.sessions, db.sessionExercises, db.setLogs], async () => {
    const instancias = await db.sessionExercises.where("session_id").equals(sessionId).toArray();
    for (const instancia of instancias) {
      await db.setLogs.where("session_exercise_id").equals(instancia.id).delete();
    }
    await db.sessionExercises.where("session_id").equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

/** Igual que arriba, para una sola instancia: primero las hojas, luego la rama. */
export async function deleteSessionExercise(sessionExerciseId: string): Promise<void> {
  await db.transaction("rw", [db.sessionExercises, db.setLogs], async () => {
    await db.setLogs.where("session_exercise_id").equals(sessionExerciseId).delete();
    await db.sessionExercises.delete(sessionExerciseId);
  });
}

// ── Vista compuesta de la sesión ────────────────────────────────────────────

export interface SessionExerciseView {
  sessionExercise: SessionExercise;
  exercise: Exercise;
  slot: RoutineSlot | null;
  slotExercise: Exercise | null;
  /**
   * Derivada, no almacenada (DECISIONES.md §3.2): hay sustitución cuando la
   * instancia viene de un slot y el ejercicio ejecutado difiere del planeado.
   */
  isSubstitution: boolean;
  /** Agregado en sesión, fuera de plantilla. */
  isAdHoc: boolean;
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

  // Siempre por orden_visual. La pantalla NO se reacomoda según se ejecuta.
  const sessionExercises = (
    await db.sessionExercises.where("session_id").equals(sessionId).toArray()
  ).sort((a, b) => a.orden_visual - b.orden_visual || a.creado_en.localeCompare(b.creado_en));

  const items: SessionExerciseView[] = [];
  for (const se of sessionExercises) {
    const exercise = await db.exercises.get(se.exercise_id);
    if (!exercise) continue;

    // Sin filtro por `activo`: el histórico resuelve contra TODOS los slots.
    // Un slot dado de baja hoy tiene que seguir explicando la sustitución que
    // registraste en julio.
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
      isAdHoc: se.routine_slot_id === null,
      alternatives,
      sets,
    });
  }

  return { session, routineDay, items };
}

// ── Precarga desde la última sesión ─────────────────────────────────────────

export interface PerformanceEntry {
  session: Session;
  sessionExercise: SessionExercise;
  sets: SetLog[];
}

export interface LastPerformance {
  session: Session;
  sets: SetLog[];
}

/**
 * La ÚNICA travesía de `sessionExercises` por ejercicio (§2). Devuelve las
 * instancias CON series, descendente por `iniciada_en`, hasta `limit`.
 *
 * Busca por `exercise_id`, NO por slot. Con `excludeSessionId` se descarta una
 * sesión completa: es lo que hace que "ÚLTIMA VEZ" signifique *una sesión
 * anterior* y no muestre algo de hoy.
 *
 * Sin bucle de consultas: los sets de todos los candidatos se traen en bloque
 * con `anyOf` y se agrupan en memoria. A este volumen da igual, pero una sola
 * query es una sola query.
 */
export async function getPerformanceHistory(
  exerciseId: string,
  opts: { limit: number; excludeSessionId?: string },
): Promise<PerformanceEntry[]> {
  const instances = await db.sessionExercises.where("exercise_id").equals(exerciseId).toArray();
  const filtered = opts.excludeSessionId
    ? instances.filter((i) => i.session_id !== opts.excludeSessionId)
    : instances;
  if (filtered.length === 0) return [];

  const allSets = await db.setLogs
    .where("session_exercise_id")
    .anyOf(filtered.map((i) => i.id))
    .toArray();
  const setsByInstance = new Map<string, SetLog[]>();
  for (const set of allSets) {
    const list = setsByInstance.get(set.session_exercise_id) ?? [];
    list.push(set);
    setsByInstance.set(set.session_exercise_id, list);
  }

  const sessionIds = [...new Set(filtered.map((i) => i.session_id))];
  const sessions = await db.sessions.bulkGet(sessionIds);
  const byId = new Map<string, Session>();
  sessions.forEach((s) => {
    if (s) byId.set(s.id, s);
  });

  return filtered
    .map((inst) => {
      const session = byId.get(inst.session_id);
      const sets = (setsByInstance.get(inst.id) ?? []).slice().sort(compareSets);
      // Solo instancias con series: una instancia vacía no es "última vez".
      return session && sets.length > 0 ? { session, sessionExercise: inst, sets } : null;
    })
    .filter((e): e is PerformanceEntry => e !== null)
    .sort((a, b) => b.session.iniciada_en.localeCompare(a.session.iniciada_en))
    .slice(0, opts.limit);
}

/** Caso particular de getPerformanceHistory: la más reciente con series. */
export async function getLastPerformance(
  exerciseId: string,
  excludeSessionId: string,
): Promise<LastPerformance | null> {
  const [entry] = await getPerformanceHistory(exerciseId, { limit: 1, excludeSessionId });
  return entry ? { session: entry.session, sets: entry.sets } : null;
}

// ── Series ──────────────────────────────────────────────────────────────────

interface Prefill {
  reps: number;
  weight: number | null;
}

function mismoSnapshot(set: SetLog, exercise: Exercise): boolean {
  return (
    set.weight_unit === exercise.unit_type &&
    set.weight_basis === exercise.weight_basis &&
    set.added_unit === exercise.added_unit
  );
}

/**
 * La serie de referencia en la posición pedida. Si hoy haces más series que la
 * vez pasada, cae a la última disponible.
 */
function enPosicion(sets: SetLog[], setIndex: number): SetLog | null {
  if (sets.length === 0) return null;
  const exacta = sets.find((s) => s.set_index === setIndex);
  if (exacta) return exacta;
  const maxIndex = Math.max(...sets.map((s) => s.set_index));
  return sets.find((s) => s.set_index === maxIndex) ?? null;
}

/**
 * Series de HOY para este exercise_id, en CUALQUIER instancia de la sesión.
 * Deliberadamente no filtra por session_exercise_id: desde que existe el
 * ad-hoc, el mismo ejercicio puede aparecer dos veces en la misma sesión y el
 * peso es del ejercicio, no de la instancia.
 */
async function seriesDeHoy(sessionId: string, exerciseId: string): Promise<SetLog[]> {
  const instancias = (await db.sessionExercises.where("session_id").equals(sessionId).toArray())
    .filter((se) => se.exercise_id === exerciseId)
    .sort((a, b) => {
      const ea = a.orden_ejecucion ?? Number.MAX_SAFE_INTEGER;
      const eb = b.orden_ejecucion ?? Number.MAX_SAFE_INTEGER;
      return ea - eb || a.creado_en.localeCompare(b.creado_en);
    });

  const out: SetLog[] = [];
  for (const instancia of instancias) {
    const sets = await db.setLogs.where("session_exercise_id").equals(instancia.id).toArray();
    sets.sort(compareSets);
    out.push(...sets);
  }
  return out;
}

/**
 * Precarga POR POSICIÓN, con fuentes distintas para peso y reps.
 *
 * Reps: la serie en la misma posición (`set_index`) de la última sesión con
 * datos. Las reps son el resultado que decae serie a serie y la posición lo
 * predice: con `12, 10, 8` a peso fijo, precargar siempre la serie 1 propone
 * reps que ya se sabe que no se van a hacer.
 *
 * Peso: la referencia histórica de esa misma posición, salvo que hoy te hayas
 * apartado de ella — ahí gana el peso de hoy. El peso es una decisión que se
 * toma una vez por ejercicio: si hoy subiste a 105, la serie 3 no debe
 * proponerte volver a 100. Pero si hoy vas siguiendo la curva de la vez pasada
 * sin tocarla, se sigue la curva.
 *
 * En ambos casos, si el snapshot de unidad de la referencia no coincide con el
 * ejercicio actual, se heredan las reps y el peso queda en blanco: convertirlo
 * está prohibido (D5) y copiarlo tal cual sería peor.
 */
async function computePrefill(
  sessionExerciseId: string,
  exercise: Exercise,
  setIndex: number,
): Promise<Prefill> {
  const se = await db.sessionExercises.get(sessionExerciseId);
  if (!se) return { reps: 0, weight: null };

  const anterior = await getLastPerformance(exercise.id, se.session_id);
  const historicos = anterior?.sets ?? [];
  const referencia = enPosicion(historicos, setIndex);

  const reps = referencia ? referencia.reps : 0;

  let weight: number | null =
    referencia && mismoSnapshot(referencia, exercise) ? referencia.weight_value : null;

  const hoy = await seriesDeHoy(se.session_id, exercise.id);
  const ultimaDeHoy =
    [...hoy].reverse().find((s) => s.weight_value !== null && mismoSnapshot(s, exercise)) ?? null;

  if (ultimaDeHoy) {
    const suReferencia = enPosicion(historicos, ultimaDeHoy.set_index);
    const esperado =
      suReferencia && mismoSnapshot(suReferencia, exercise) ? suReferencia.weight_value : null;
    if (esperado === null || ultimaDeHoy.weight_value !== esperado) {
      weight = ultimaDeHoy.weight_value;
    }
  }

  return { reps, weight };
}

/**
 * El orden de ejecución se asigna en la PRIMERA escritura de serie, nunca al
 * crear la instancia. Es un hecho observado, no una declaración.
 */
async function ensureOrdenEjecucion(sessionExerciseId: string): Promise<void> {
  const se = await db.sessionExercises.get(sessionExerciseId);
  if (!se || se.orden_ejecucion !== null) return;

  const hermanas = await db.sessionExercises.where("session_id").equals(se.session_id).toArray();
  const usados = hermanas
    .map((h) => h.orden_ejecucion)
    .filter((n): n is number => n !== null);
  const siguiente = usados.length === 0 ? 1 : Math.max(...usados) + 1;

  await db.sessionExercises.update(sessionExerciseId, { orden_ejecucion: siguiente });
}

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
  const prefill = await computePrefill(sessionExerciseId, exercise, nextIndex);

  // Unilateral: "Serie" (AUTO) crea UN solo lado (L). El opuesto se agrega
  // aparte, heredando el peso del lado ya registrado (§2). Antes creaba ambos a
  // la vez con el mismo prefill; en la primera serie ese prefill es null, así
  // que ambos nacían sin peso y llenar uno dejaba el otro en null.
  const sides: (Side | null)[] =
    opts.side === "AUTO"
      ? exercise.laterality_default === "UNILATERAL"
        ? ["L"]
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

  await db.transaction("rw", [db.setLogs, db.sessionExercises], async () => {
    await db.setLogs.bulkAdd(rows);
    await ensureOrdenEjecucion(sessionExerciseId);
  });
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

/**
 * Crea el lado que falta de una serie unilateral, dentro del MISMO set_index,
 * heredando el weight_value del lado ya registrado (§2). El peso es el mismo por
 * definición física — misma máquina, misma carga. Las reps NO se heredan: el
 * punto de registrar por lado es que difieren (6L / 7R). Si el lado existente no
 * tiene peso, el nuevo nace sin peso: no se inventa valor.
 */
export async function addOppositeSide(
  sessionExerciseId: string,
  setIndex: number,
): Promise<void> {
  const rows = (await db.setLogs.where("session_exercise_id").equals(sessionExerciseId).toArray())
    .filter((s) => s.set_index === setIndex);
  if (rows.length === 0) return;

  const sides = new Set(rows.map((r) => r.side));
  const hasL = sides.has("L");
  const hasR = sides.has("R");
  // Solo cuando hay exactamente un lado (L xor R). Ni bilateral, ni ya completo.
  if (hasL === hasR) return;

  const present: Side = hasL ? "L" : "R";
  const missing: Side = hasL ? "R" : "L";
  const src = rows.find((r) => r.side === present);
  if (!src) return;

  await db.setLogs.add({
    ...src,
    id: newId(),
    side: missing,
    reps: 0,
    weight_value: src.weight_value,
    segment_index: 0,
  });
}

export async function updateSet(setId: string, changes: Partial<SetLog>): Promise<void> {
  await db.setLogs.update(setId, changes);
}

/** SetLog es hoja: su borrado no necesita cascada. */
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

/**
 * Ejercicio ad-hoc: instancia sin slot, al final de la lista visual. No crea
 * ejercicios nuevos — el picker solo elige del catálogo, porque fijar
 * unit_type/weight_basis/added_unit es una decisión que se snapshotea en cada
 * serie y se toma en frío, en /catalogo.
 */
export async function addAdHocExercise(sessionId: string, exerciseId: string): Promise<void> {
  const hermanas = await db.sessionExercises.where("session_id").equals(sessionId).toArray();
  const ordenVisual =
    hermanas.length === 0 ? 1 : Math.max(...hermanas.map((h) => h.orden_visual)) + 1;

  await db.sessionExercises.add({
    id: newId(),
    session_id: sessionId,
    routine_slot_id: null,
    exercise_id: exerciseId,
    orden_visual: ordenVisual,
    orden_ejecucion: null,
    creado_en: new Date().toISOString(),
    nota: null,
  });
}

// ── Catálogo ────────────────────────────────────────────────────────────────

export async function listActiveExercises(): Promise<Exercise[]> {
  const all = await db.exercises.toArray();
  return soloActivos(all).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Cuántas series tiene registradas este ejercicio, en toda la historia. */
export async function countSetLogsForExercise(exerciseId: string): Promise<number> {
  const instancias = await db.sessionExercises.where("exercise_id").equals(exerciseId).toArray();
  let total = 0;
  for (const instancia of instancias) {
    total += await db.setLogs.where("session_exercise_id").equals(instancia.id).count();
  }
  return total;
}

export interface NewExerciseInput {
  nombre: string;
  unit_type: UnitType;
  weight_basis: WeightBasis | null;
  added_unit: AddedUnit | null;
  stack_label: string | null;
  laterality_default: Laterality;
}

export async function createExercise(input: NewExerciseInput): Promise<string> {
  const id = newId();
  await db.exercises.add({ id, ...input, activo: true });
  return id;
}

export async function renameExercise(exerciseId: string, nombre: string): Promise<void> {
  await db.exercises.update(exerciseId, { nombre });
}

/**
 * Bloqueado en cuanto el ejercicio tenga al menos un SetLog. Los snapshots ya
 * escritos no cambiarían y el histórico quedaría partido en dos tramos
 * incomparables. La UI deshabilita los campos; esto es la segunda cerradura.
 */
export async function updateExerciseUnits(
  exerciseId: string,
  patch: Pick<Exercise, "unit_type" | "weight_basis" | "added_unit" | "stack_label">,
): Promise<void> {
  const series = await countSetLogsForExercise(exerciseId);
  if (series > 0) {
    throw new Error(
      `Este ejercicio ya tiene ${series} series registradas. Cambiar su unidad partiría el histórico: los snapshots ya escritos no cambian. Si necesitas otra unidad, crea un ejercicio nuevo.`,
    );
  }
  await db.exercises.update(exerciseId, patch);
}

/** Borrado suave. Nunca duro: el histórico apunta aquí. */
export async function softDeleteExercise(exerciseId: string): Promise<void> {
  await db.exercises.update(exerciseId, { activo: false });
}

// ── Plantillas ──────────────────────────────────────────────────────────────

export interface SlotView {
  slot: RoutineSlot;
  exercise: Exercise | null;
  alternatives: Exercise[];
}

export async function listRoutineDays(): Promise<RoutineDay[]> {
  return db.routineDays.orderBy("orden").toArray();
}

/**
 * Conteo de slots ACTIVOS de un día, para el selector del home. IndexedDB no
 * indexa booleanos, así que se filtra en memoria (soloActivos), no con
 * .count() sobre el índice — que contaría también los dados de baja.
 */
export async function countActiveSlots(routineDayId: string): Promise<number> {
  const slots = await db.routineSlots.where("routine_day_id").equals(routineDayId).toArray();
  return soloActivos(slots).length;
}

/** Solo slots activos: las plantillas renderizan `activo === true`. */
export async function loadDaySlots(routineDayId: string): Promise<SlotView[]> {
  const slots = soloActivos(
    await db.routineSlots.where("routine_day_id").equals(routineDayId).toArray(),
  ).sort((a, b) => a.orden - b.orden);

  const out: SlotView[] = [];
  for (const slot of slots) {
    const exercise = (await db.exercises.get(slot.exercise_id)) ?? null;
    const alternatives: Exercise[] = [];
    for (const altId of slot.alternative_exercise_ids) {
      const alt = await db.exercises.get(altId);
      if (alt) alternatives.push(alt);
    }
    out.push({ slot, exercise, alternatives });
  }
  return out;
}

/**
 * Renumera los slots activos del día como enteros consecutivos, en una sola
 * transacción. Sin índices fraccionarios.
 *
 * Los slots inactivos conservan su `orden` viejo: no se renderizan nunca y el
 * índice [routine_day_id+orden] no es único, así que un empate entre un activo
 * y un inactivo no rompe nada.
 *
 * Reordenar NO toca el histórico: `SessionExercise.orden_visual` ya está
 * escrito en las sesiones pasadas y `orden_ejecucion` es independiente.
 */
export async function moveSlot(
  routineDayId: string,
  slotId: string,
  direccion: -1 | 1,
): Promise<void> {
  await db.transaction("rw", [db.routineSlots], async () => {
    const activos = soloActivos(
      await db.routineSlots.where("routine_day_id").equals(routineDayId).toArray(),
    ).sort((a, b) => a.orden - b.orden);

    const i = activos.findIndex((s) => s.id === slotId);
    const j = i + direccion;
    if (i === -1 || j < 0 || j >= activos.length) return;

    [activos[i], activos[j]] = [activos[j], activos[i]];

    for (let k = 0; k < activos.length; k++) {
      if (activos[k].orden !== k + 1) {
        await db.routineSlots.update(activos[k].id, { orden: k + 1 });
      }
    }
  });
}

export async function addSlot(routineDayId: string, exerciseId: string): Promise<void> {
  const todos = await db.routineSlots.where("routine_day_id").equals(routineDayId).toArray();
  const orden = todos.length === 0 ? 1 : Math.max(...todos.map((s) => s.orden)) + 1;

  await db.routineSlots.add({
    id: newId(),
    routine_day_id: routineDayId,
    exercise_id: exerciseId,
    orden,
    target_sets: null,
    target_reps: null,
    alternative_exercise_ids: [],
    activo: true,
  });
}

export async function updateSlotTargets(
  slotId: string,
  targetSets: number | null,
  targetReps: number | null,
): Promise<void> {
  await db.routineSlots.update(slotId, { target_sets: targetSets, target_reps: targetReps });
}

/**
 * Borrado suave. Duro dejaría `SessionExercise.routine_slot_id` colgando sin
 * error, y las sesiones viejas dejarían de mostrar el badge de sustitución: un
 * entrenamiento donde sustituiste Squats por Hack Squats pasaría a verse como
 * si Hack Squats siempre hubiera estado en el plan.
 */
export async function softDeleteSlot(slotId: string): Promise<void> {
  await db.routineSlots.update(slotId, { activo: false });
}

export async function addSlotAlternative(slotId: string, exerciseId: string): Promise<void> {
  const slot = await db.routineSlots.get(slotId);
  if (!slot || slot.alternative_exercise_ids.includes(exerciseId)) return;
  await db.routineSlots.update(slotId, {
    alternative_exercise_ids: [...slot.alternative_exercise_ids, exerciseId],
  });
}

export async function removeSlotAlternative(slotId: string, exerciseId: string): Promise<void> {
  const slot = await db.routineSlots.get(slotId);
  if (!slot) return;
  await db.routineSlots.update(slotId, {
    alternative_exercise_ids: slot.alternative_exercise_ids.filter((id) => id !== exerciseId),
  });
}

// ── Historial (solo lectura) ─────────────────────────────────────────────────

export interface SessionSummary {
  session: Session;
  routineDay: RoutineDay | null;
  /** Ejercicios que realmente se registraron (con al menos una serie). */
  ejerciciosConSeries: number;
  totalSeries: number;
  tags: SessionTag[];
  tieneNota: boolean;
}

/**
 * Lista de sesiones, descendente por fecha (desempate por iniciada_en). Incluye
 * la sesión activa: la UI la marca como en curso, no la esconde.
 */
export async function listSessionSummaries(): Promise<SessionSummary[]> {
  const [sessions, allSE, allSets, days, tags] = await Promise.all([
    db.sessions.toArray(),
    db.sessionExercises.toArray(),
    db.setLogs.toArray(),
    db.routineDays.toArray(),
    db.sessionTags.toArray(),
  ]);

  const dayById = new Map(days.map((d) => [d.id, d]));
  const tagById = new Map(tags.map((t) => [t.id, t]));

  const seBySession = new Map<string, SessionExercise[]>();
  for (const se of allSE) {
    const list = seBySession.get(se.session_id) ?? [];
    list.push(se);
    seBySession.set(se.session_id, list);
  }
  const setCountByInstance = new Map<string, number>();
  for (const set of allSets) {
    setCountByInstance.set(
      set.session_exercise_id,
      (setCountByInstance.get(set.session_exercise_id) ?? 0) + 1,
    );
  }

  return sessions
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.iniciada_en.localeCompare(a.iniciada_en))
    .map((session) => {
      const instancias = seBySession.get(session.id) ?? [];
      let ejerciciosConSeries = 0;
      let totalSeries = 0;
      for (const se of instancias) {
        const count = setCountByInstance.get(se.id) ?? 0;
        if (count > 0) ejerciciosConSeries++;
        totalSeries += count;
      }
      return {
        session,
        routineDay: session.routine_day_id ? (dayById.get(session.routine_day_id) ?? null) : null,
        ejerciciosConSeries,
        totalSeries,
        tags: session.tag_ids
          .map((id) => tagById.get(id))
          .filter((t): t is SessionTag => t !== undefined),
        tieneNota: !!session.nota && session.nota.trim() !== "",
      };
    });
}

export interface SessionDetail {
  session: Session;
  routineDay: RoutineDay | null;
  tags: SessionTag[];
  bodyweight: BodyweightLog | null;
  items: SessionExerciseView[];
}

/**
 * Detalle de una sesión pasada. Reusa loadSessionView (que resuelve el slot
 * contra TODOS los slots, activos o no — el badge de sustitución de julio debe
 * sobrevivir a que el slot se dé de baja en agosto) y reordena por ejecución:
 * esta pantalla es el registro de lo que pasó, no del plan.
 *
 * Orden: orden_ejecucion ascendente, nulls al final.
 */
export async function loadSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const view = await loadSessionView(sessionId);
  if (!view) return null;

  const items = view.items.slice().sort((a, b) => {
    const ea = a.sessionExercise.orden_ejecucion;
    const eb = b.sessionExercise.orden_ejecucion;
    if (ea === null && eb === null) {
      return a.sessionExercise.orden_visual - b.sessionExercise.orden_visual;
    }
    if (ea === null) return 1;
    if (eb === null) return -1;
    return ea - eb;
  });

  const tags = await db.sessionTags.toArray();
  const tagById = new Map(tags.map((t) => [t.id, t]));

  const mismaFecha = await db.bodyweightLogs.where("fecha").equals(view.session.fecha).toArray();
  const bodyweight = mismaFecha.length > 0 ? mismaFecha[mismaFecha.length - 1] : null;

  return {
    session: view.session,
    routineDay: view.routineDay,
    tags: view.session.tag_ids
      .map((id) => tagById.get(id))
      .filter((t): t is SessionTag => t !== undefined),
    bodyweight,
    items,
  };
}

export interface ExerciseHistoryEntry extends PerformanceEntry {
  isSubstitution: boolean;
  slotExerciseNombre: string | null;
  /** Tupla de comparabilidad del snapshot (§3.5), para cortar la serie visual. */
  unitKey: string;
}

export interface ExerciseHistory {
  exercise: Exercise | null;
  entries: ExerciseHistoryEntry[];
}

/**
 * Últimas 5 sesiones CON series de un ejercicio, vía getPerformanceHistory. La
 * unitKey sale del snapshot de la primera serie de cada entrada: si cambia
 * entre sesiones, la UI corta la serie en vez de fingir continuidad, porque
 * §3.5 solo compara dentro de la misma tupla (unit, basis, added).
 */
export async function loadExerciseHistory(exerciseId: string): Promise<ExerciseHistory> {
  const exercise = (await db.exercises.get(exerciseId)) ?? null;
  const raw = await getPerformanceHistory(exerciseId, { limit: 5 });

  const entries: ExerciseHistoryEntry[] = [];
  for (const entry of raw) {
    let isSubstitution = false;
    let slotExerciseNombre: string | null = null;

    if (entry.sessionExercise.routine_slot_id) {
      const slot = await db.routineSlots.get(entry.sessionExercise.routine_slot_id);
      if (slot && slot.exercise_id !== entry.sessionExercise.exercise_id) {
        isSubstitution = true;
        const slotEx = await db.exercises.get(slot.exercise_id);
        slotExerciseNombre = slotEx?.nombre ?? null;
      }
    }

    const first = entry.sets[0];
    const unitKey = `${first.weight_unit}|${first.weight_basis ?? "NA"}|${first.added_unit ?? "NA"}`;
    entries.push({ ...entry, isSubstitution, slotExerciseNombre, unitKey });
  }

  return { exercise, entries };
}
