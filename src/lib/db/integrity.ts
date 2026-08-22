import { db } from "./db";

/**
 * Detección de huérfanos.
 *
 * Existe porque el manifiesto del export verifica CONTEOS, y un huérfano no
 * altera ningún conteo: la fila sigue ahí, solo apunta a algo que ya no
 * existe. Dexie no tiene claves foráneas, así que esta clase de daño es
 * invisible salvo que se busque a propósito.
 *
 * Solo reporta. No repara: decidir si un SetLog huérfano se borra o se
 * reasocia no es una decisión que deba tomar un botón.
 */
export interface IntegrityReport {
  setLogsSinInstancia: string[];
  sessionExercisesSinSesion: string[];
  sessionExercisesSinSlot: string[];
  sessionExercisesSinEjercicio: string[];
  /**
   * Sesiones con `activa === 1` de más (§1.1). Una sola es lo correcto; dos o
   * más rompen la invariante de la que depende getLastPerformance, que no
   * filtra por `activa`. Cuenta las que sobran: 0 si hay una o ninguna.
   */
  sesionesActivasDeMas: number;
  total: number;
}

export async function checkIntegrity(): Promise<IntegrityReport> {
  const [sessions, sessionExercises, setLogs, routineSlots, exercises] = await Promise.all([
    db.sessions.toArray(),
    db.sessionExercises.toArray(),
    db.setLogs.toArray(),
    db.routineSlots.toArray(),
    db.exercises.toArray(),
  ]);

  const activas = sessions.filter((s) => s.activa === 1);
  const sesionesActivasDeMas = Math.max(0, activas.length - 1);

  const idsSesiones = new Set(sessions.map((s) => s.id));
  const idsInstancias = new Set(sessionExercises.map((s) => s.id));
  const idsSlots = new Set(routineSlots.map((s) => s.id));
  const idsEjercicios = new Set(exercises.map((e) => e.id));

  const setLogsSinInstancia = setLogs
    .filter((s) => !idsInstancias.has(s.session_exercise_id))
    .map((s) => s.id);

  const sessionExercisesSinSesion = sessionExercises
    .filter((se) => !idsSesiones.has(se.session_id))
    .map((se) => se.id);

  // routine_slot_id null es legítimo: es un ejercicio ad-hoc.
  const sessionExercisesSinSlot = sessionExercises
    .filter((se) => se.routine_slot_id !== null && !idsSlots.has(se.routine_slot_id))
    .map((se) => se.id);

  const sessionExercisesSinEjercicio = sessionExercises
    .filter((se) => !idsEjercicios.has(se.exercise_id))
    .map((se) => se.id);

  return {
    setLogsSinInstancia,
    sessionExercisesSinSesion,
    sessionExercisesSinSlot,
    sessionExercisesSinEjercicio,
    sesionesActivasDeMas,
    total:
      setLogsSinInstancia.length +
      sessionExercisesSinSesion.length +
      sessionExercisesSinSlot.length +
      sessionExercisesSinEjercicio.length +
      sesionesActivasDeMas,
  };
}
