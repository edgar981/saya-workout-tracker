import { db } from "./db";
import { getPerformanceHistory } from "./queries";
import { compareAppearances, type Verdict } from "@/lib/verdict";

/**
 * Loader del veredicto por sesión (Dexie). Vive aparte de la sesión activa: solo
 * el detalle de historial lo importa, así que el módulo de veredicto nunca entra
 * al bundle de `/sesion` por esta vía.
 *
 * Reusa `getPerformanceHistory` (§: una sola travesía de sessionExercises). NO
 * escribe nada — todo es derivado en lectura.
 */
export interface InstanceVerdict {
  verdict: Verdict;
  /** fecha (ISO) de la aparición anterior contra la que se comparó, para mostrar. */
  referenceFecha: string | null;
}

export async function loadSessionVerdicts(
  sessionId: string,
): Promise<Record<string, InstanceVerdict>> {
  const session = await db.sessions.get(sessionId);
  // Solo sesiones cerradas: la activa se está registrando y llegaría incompleto.
  if (!session || session.activa !== 0) return {};

  const instances = await db.sessionExercises.where("session_id").equals(sessionId).toArray();
  const result: Record<string, InstanceVerdict> = {};

  for (const inst of instances) {
    const sets = await db.setLogs.where("session_exercise_id").equals(inst.id).toArray();
    // Instancia sin series: sin veredicto (conserva su estado "no realizado" /
    // "se empezó, sin series" que el detalle ya renderiza).
    if (sets.length === 0) continue;

    // La aparición ANTERIOR de ESTE exercise_id (el que realmente se hizo, así que
    // una sustitución se compara contra sí misma, no contra el slot). Se excluye
    // esta sesión y se toma la más reciente que sea cronológicamente anterior —
    // correcto también al abrir el detalle de una sesión que no es la última.
    const history = await getPerformanceHistory(inst.exercise_id, {
      limit: 10000,
      excludeSessionId: sessionId,
    });
    const prev = history.find((h) => h.session.iniciada_en < session.iniciada_en) ?? null;

    result[inst.id] = {
      verdict: compareAppearances(sets, prev?.sets ?? null),
      referenceFecha: prev?.session.fecha ?? null,
    };
  }

  return result;
}
