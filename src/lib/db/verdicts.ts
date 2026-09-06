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
    // Solo series REALES: una serie sin teclear (reps 0) no cuenta. Una instancia
    // sin series reales no recibe veredicto (conserva "se empezó, sin series" /
    // "no realizado" que el detalle ya renderiza).
    const reales = sets.filter((s) => s.reps > 0);
    if (reales.length === 0) continue;

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
      verdict: compareAppearances(reales, prev?.sets ?? null),
      referenceFecha: prev?.session.fecha ?? null,
    };
  }

  return result;
}

/**
 * Veredicto compacto de una sesión para la fila del historial (§1): el neto
 * `mejor − peor`. "igual" y "sin comparación" no entran al neto — pero
 * `sinComparacion` se expone aparte para que la fila pueda avisar que la
 * cobertura no fue completa (un punto discreto), sin que el número lo esconda.
 *
 * Deriva del MISMO `Record` de veredictos que ya calcula `loadSessionVerdicts`:
 * ni una segunda travesía ni una segunda regla de comparación (§13).
 */
export interface SessionVerdictNet {
  /** mejor − peor. */
  net: number;
  /** Ejercicios comparados sin aparición previa (cobertura incompleta). */
  sinComparacion: number;
  /** Instancias con veredicto (mejor + igual + peor + sin comparación). */
  comparados: number;
}

export function netFromVerdicts(verdicts: Record<string, InstanceVerdict>): SessionVerdictNet {
  let mejor = 0;
  let peor = 0;
  let sinComparacion = 0;
  let comparados = 0;
  for (const id in verdicts) {
    comparados++;
    switch (verdicts[id].verdict.category) {
      case "mejor":
        mejor++;
        break;
      case "peor":
        peor++;
        break;
      case "sin_comparacion":
        sinComparacion++;
        break;
    }
  }
  return { net: mejor - peor, sinComparacion, comparados };
}

/** Neto por sesión para una lista de ids, reusando `loadSessionVerdicts`. */
export async function loadSessionVerdictNets(
  sessionIds: string[],
): Promise<Record<string, SessionVerdictNet>> {
  const out: Record<string, SessionVerdictNet> = {};
  for (const id of sessionIds) {
    out[id] = netFromVerdicts(await loadSessionVerdicts(id));
  }
  return out;
}
