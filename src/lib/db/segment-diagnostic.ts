import { db } from "./db";
import { compareSets } from "./queries";
import type { SetLog } from "./types";

/**
 * Diagnóstico READ-ONLY (§4 fase 1). No escribe nada.
 *
 * Encuentra los SetLog con `segment_index > 0` y los agrupa por ejercicio y por
 * serie, para poder distinguir dos usos del mismo campo:
 *
 *   - Giant set legítimo: una serie con varios tramos (16+15+11+8+10+9).
 *   - Lados registrados como segmentos: antes de que existiera `side`, un
 *     ejercicio unilateral guardaba izquierdo/derecho como segment_index 0 y 1.
 *
 * La distinción NO se adivina aquí: se reporta la forma (cuántos segmentos por
 * serie, con qué valores) y el humano decide. La heurística `todosDosSegmentos`
 * es solo una pista, no una decisión.
 */
export interface SegmentGroup {
  sessionExerciseId: string;
  sessionId: string;
  fecha: string;
  setIndex: number;
  esExtra: boolean;
  segments: {
    segment_index: number;
    reps: number;
    weight_value: number | null;
    weight_unit: string;
    side: string | null;
  }[];
}

export interface ExerciseSegmentReport {
  exerciseId: string;
  nombre: string;
  unitType: string;
  /** Grupos (set_index) que usan más de un segmento. */
  gruposConSegmentos: number;
  maxSegmentosEnUnaSerie: number;
  /** Pista: todos los grupos multi-segmento tienen exactamente 2 segmentos. */
  todosDosSegmentos: boolean;
  grupos: SegmentGroup[];
}

export interface SegmentDiagnostic {
  totalSetLogsConSegmento: number;
  exercises: ExerciseSegmentReport[];
}

export async function diagnoseSegmentSides(): Promise<SegmentDiagnostic> {
  const [setLogs, sessionExercises, exercises, sessions] = await Promise.all([
    db.setLogs.toArray(),
    db.sessionExercises.toArray(),
    db.exercises.toArray(),
    db.sessions.toArray(),
  ]);

  const seById = new Map(sessionExercises.map((se) => [se.id, se]));
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // Instancias que tienen al menos un SetLog con segment_index > 0.
  const conSegmento = new Set(
    setLogs.filter((s) => s.segment_index > 0).map((s) => s.session_exercise_id),
  );

  const setsByInstance = new Map<string, SetLog[]>();
  for (const s of setLogs) {
    if (!conSegmento.has(s.session_exercise_id)) continue;
    const list = setsByInstance.get(s.session_exercise_id) ?? [];
    list.push(s);
    setsByInstance.set(s.session_exercise_id, list);
  }

  // Agrupar por exercise_id.
  const porEjercicio = new Map<string, SegmentGroup[]>();

  for (const [instanceId, sets] of setsByInstance) {
    const se = seById.get(instanceId);
    if (!se) continue;
    const session = sessionById.get(se.session_id);

    // Dentro de una instancia, agrupar por set_index; quedarnos con los grupos
    // que tengan más de un segmento.
    const bySetIndex = new Map<number, SetLog[]>();
    for (const s of sets) {
      const l = bySetIndex.get(s.set_index) ?? [];
      l.push(s);
      bySetIndex.set(s.set_index, l);
    }

    for (const [setIndex, rows] of bySetIndex) {
      const segmentos = new Set(rows.map((r) => r.segment_index));
      if (segmentos.size <= 1) continue;

      const ordered = rows.slice().sort(compareSets);
      const grupo: SegmentGroup = {
        sessionExerciseId: instanceId,
        sessionId: se.session_id,
        fecha: session?.fecha ?? "?",
        setIndex,
        esExtra: rows.some((r) => r.es_extra),
        segments: ordered.map((r) => ({
          segment_index: r.segment_index,
          reps: r.reps,
          weight_value: r.weight_value,
          weight_unit: r.weight_unit,
          side: r.side,
        })),
      };

      const list = porEjercicio.get(se.exercise_id) ?? [];
      list.push(grupo);
      porEjercicio.set(se.exercise_id, list);
    }
  }

  const reports: ExerciseSegmentReport[] = [];
  for (const [exerciseId, grupos] of porEjercicio) {
    const ex = exById.get(exerciseId);
    grupos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.setIndex - b.setIndex);
    const maxSeg = Math.max(...grupos.map((g) => g.segments.length));
    reports.push({
      exerciseId,
      nombre: ex?.nombre ?? "(ejercicio no encontrado)",
      unitType: ex?.unit_type ?? "?",
      gruposConSegmentos: grupos.length,
      maxSegmentosEnUnaSerie: maxSeg,
      todosDosSegmentos: grupos.every((g) => g.segments.length === 2),
      grupos,
    });
  }

  reports.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    totalSetLogsConSegmento: setLogs.filter((s) => s.segment_index > 0).length,
    exercises: reports,
  };
}
