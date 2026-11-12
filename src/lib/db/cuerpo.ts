import { db } from "./db";
import { loadProgreso, type ProgresoView } from "./progress";
import { listSessionSummaries, type SessionSummary } from "./queries";
import { loadSessionVerdictNets, type SessionVerdictNet } from "./verdicts";
import type { BodyweightLog } from "./types";

/** Cuántas sesiones muestra «Últimas sesiones». */
export const ULTIMAS_SESIONES = 3;

export interface CuerpoView {
  pesos: BodyweightLog[];
  /** Descendente por fecha; incluye la abierta. */
  sesiones: SessionSummary[];
  progreso: ProgresoView;
  /** Neto de las `ULTIMAS_SESIONES` primeras de `sesiones`, por id. */
  nets: Record<string, SessionVerdictNet>;
}

/**
 * Loader de `/cuerpo`. Solo LECTURA de tablas que ya existen; no escribe nada y
 * no guarda nada derivado. Reusa `loadProgreso` (la misma regla de Progreso, así
 * los números coinciden) y `loadSessionVerdictNets` (el neto de Historial).
 */
export async function loadCuerpo(): Promise<CuerpoView> {
  const [pesos, sesiones, progreso] = await Promise.all([
    db.bodyweightLogs.toArray(),
    listSessionSummaries(),
    loadProgreso(),
  ]);
  const nets = await loadSessionVerdictNets(
    sesiones.slice(0, ULTIMAS_SESIONES).map((s) => s.session.id),
  );
  return { pesos, sesiones, progreso, nets };
}
