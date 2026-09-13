import Dexie, { type Table } from "dexie";
import type {
  BodyweightLog,
  Exercise,
  Mesociclo,
  RoutineDay,
  RoutineSlot,
  Session,
  SessionExercise,
  SessionTag,
  SetLog,
} from "./types";
import { TABLE_NAMES } from "./tables";

// Reexportadas desde su módulo puro (sin Dexie) para no romper los imports
// existentes de `@/lib/db/db`. La lista canónica vive en `./tables`.
export { TABLE_NAMES } from "./tables";
export type { TableName } from "./tables";

/**
 * Versión de esquema de Dexie. DECISIONES.md §6:
 *
 * Cada cambio de esquema es un bloque `version(n+1).stores({...}).upgrade(...)`
 * NUEVO. Nunca se edita un `version()` ya desplegado: el teléfono que ya está
 * en la versión N nunca vuelve a correr ese upgrade y el esquema declarado deja
 * de describir los datos reales.
 *
 * Y antes de desplegar cualquier migración: export manual (§5). Este número es
 * el que valida el import — un archivo de otra versión se rechaza entero en vez
 * de migrarse al vuelo.
 */
export const SCHEMA_VERSION = 3;

/** Id determinista del mesociclo que la migración v3 y el seed crean. Ninguno
 *  de los dos corre en la misma base (upgrade solo sobre datos previos, seed
 *  solo sobre base vacía), así que el id fijo nunca colisiona. */
export const MESOCICLO_INICIAL_ID = "meso-1";

class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, string>;
  mesociclos!: Table<Mesociclo, string>;
  routineDays!: Table<RoutineDay, string>;
  routineSlots!: Table<RoutineSlot, string>;
  sessions!: Table<Session, string>;
  sessionExercises!: Table<SessionExercise, string>;
  setLogs!: Table<SetLog, string>;
  sessionTags!: Table<SessionTag, string>;
  bodyweightLogs!: Table<BodyweightLog, string>;

  constructor() {
    super("saya-tracker");

    this.version(1).stores({
      exercises: "id, nombre, activo",
      routineDays: "id, orden",
      routineSlots:
        "id, routine_day_id, [routine_day_id+orden], *alternative_exercise_ids",
      sessions: "id, fecha, routine_day_id, activa, *tag_ids",
      sessionExercises: "id, session_id, exercise_id, [session_id+orden]",
      setLogs: "id, session_exercise_id, [session_exercise_id+set_index+segment_index]",
      sessionTags: "id, nombre",
      bodyweightLogs: "id, fecha",
    });

    // ── v2 ──────────────────────────────────────────────────────────────────
    // Solo se redeclaran las dos tablas que cambian. Las otras seis se heredan.
    this.version(2)
      .stores({
        routineSlots:
          "id, routine_day_id, [routine_day_id+orden], *alternative_exercise_ids, activo",
        sessionExercises: "id, session_id, exercise_id, [session_id+orden_visual]",
      })
      .upgrade(async (tx) => {
        await tx
          .table<RoutineSlot>("routineSlots")
          .toCollection()
          .modify((slot) => {
            slot.activo = true;
          });

        const sessions = await tx.table<Session>("sessions").toArray();
        const iniciadaPorSesion = new Map(sessions.map((s) => [s.id, s.iniciada_en]));

        const setLogs = await tx.table<SetLog>("setLogs").toArray();
        const conSeries = new Set(setLogs.map((s) => s.session_exercise_id));

        await tx
          .table("sessionExercises")
          .toCollection()
          .modify((se: SessionExercise & { orden?: number }) => {
            const ordenViejo = se.orden ?? 0;
            se.orden_visual = ordenViejo;

            // OJO al leer esto dentro de seis meses: para las sesiones
            // anteriores a v2 el orden de ejecución NO es un dato observado.
            // No existía forma de medirlo, así que se HEREDA del orden de
            // plantilla. Solo las sesiones registradas de v2 en adelante
            // tienen aquí una secuencia real.
            se.orden_ejecucion = conSeries.has(se.id) ? ordenViejo : null;

            se.creado_en = iniciadaPorSesion.get(se.session_id) ?? "1970-01-01T00:00:00.000Z";

            delete se.orden;
          });
      });

    // ── v3 ──────────────────────────────────────────────────────────────────
    // Mesociclos. `routineDays` gana `mesociclo_id` (indexado, por eso el bump).
    // La migración envuelve los cinco días existentes en "Mesociclo 1" activo,
    // sin tocar una sola fila de sesiones: Session sigue apuntando a
    // routine_day_id y el mesociclo es derivable por el día.
    this.version(3)
      .stores({
        mesociclos: "id, activo",
        routineDays: "id, orden, mesociclo_id",
      })
      .upgrade(async (tx) => {
        // iniciado_en = fecha de la sesión más antigua CON series reales. OJO al
        // leer esto en seis meses: es un valor DERIVADO, no observado — el
        // mesociclo no existía cuando se registraron esas sesiones, igual que
        // orden_ejecucion en v2. Sin ninguna sesión con series, queda null (no se
        // inventa una fecha).
        const setLogs = await tx.table<SetLog>("setLogs").toArray();
        const instanciasConSeries = new Set(
          setLogs.filter((s) => s.reps > 0).map((s) => s.session_exercise_id),
        );
        const sessionExercises = await tx.table<SessionExercise>("sessionExercises").toArray();
        const sesionesConSeries = new Set(
          sessionExercises
            .filter((se) => instanciasConSeries.has(se.id))
            .map((se) => se.session_id),
        );
        const sessions = await tx.table<Session>("sessions").toArray();
        const fechas = sessions
          .filter((s) => sesionesConSeries.has(s.id))
          .map((s) => s.fecha)
          .sort(); // YYYY-MM-DD: orden lexicográfico = cronológico
        const iniciado_en = fechas.length > 0 ? fechas[0] : null;

        await tx.table<Mesociclo>("mesociclos").add({
          id: MESOCICLO_INICIAL_ID,
          nombre: "Mesociclo 1",
          iniciado_en,
          terminado_en: null,
          activo: 1,
        });

        await tx
          .table<RoutineDay>("routineDays")
          .toCollection()
          .modify((d) => {
            d.mesociclo_id = MESOCICLO_INICIAL_ID;
          });
      });
  }
}

export const db = new WorkoutDB();

/** Las nueve tablas en el orden de TABLE_NAMES, para transacciones y volcados. */
export function allTables(): Table<unknown, string>[] {
  return TABLE_NAMES.map((name) => db.table(name));
}
