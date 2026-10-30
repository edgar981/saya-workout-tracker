import {
  getActiveMesociclo,
  getPerformanceHistory,
  listRoutineDays,
  listSessionSummaries,
  loadDaySlots,
  todayISO,
} from "./queries";
import { loadSessionVerdictNets } from "./verdicts";
import type { Exercise, Mesociclo } from "./types";
import {
  aparicionesDe,
  balanceSemanal,
  bloqueActual,
  evaluarProgreso,
  lunesDe,
  semanaDesde,
  SEMANAS_BALANCE,
  sumarDias,
  TAG_DELOAD,
  type Bloque,
  type ProgresoEjercicio,
  type SemanaBalance,
} from "@/lib/progress";

/**
 * Loader de `/progreso` (DECISIONES.md §11.7). Solo LECTURA. Reusa lo que ya
 * existe: `getPerformanceHistory` por ejercicio (la única travesía), y para el
 * balance, `loadSessionVerdictNets` — el mismo neto de los badges del historial.
 * Las reglas viven en `lib/progress`; aquí solo se junta el dato.
 */
export interface ProgresoFila {
  exercise: Exercise;
  progreso: ProgresoEjercicio;
}

export interface ProgresoView {
  mesociclo: Mesociclo | null;
  bloque: (Bloque & { semana: number }) | null;
  semanas: SemanaBalance[];
  /** Ejercicios del plan vigente, en el orden del plan (día, luego slot). */
  filas: ProgresoFila[];
}

export async function loadProgreso(): Promise<ProgresoView> {
  const hoy = todayISO();
  const mesociclo = (await getActiveMesociclo()) ?? null;

  // El plan vigente: slots activos del mesociclo activo, el ejercicio del slot (no
  // sus alternativas). Un ejercicio en dos días aparece una vez, en el primero.
  const filas: ProgresoFila[] = [];
  const vistos = new Set<string>();
  for (const day of await listRoutineDays()) {
    for (const { exercise } of await loadDaySlots(day.id)) {
      if (!exercise || vistos.has(exercise.id)) continue;
      vistos.add(exercise.id);
      const todas = await getPerformanceHistory(exercise.id, { limit: Number.MAX_SAFE_INTEGER });
      filas.push({ exercise, progreso: evaluarProgreso(aparicionesDe(todas), hoy) });
    }
  }

  // Sesiones cerradas con series: las que cuentan para la pausa y el balance.
  const cerradas = (await listSessionSummaries()).filter(
    (s) => s.session.activa === 0 && s.totalSeries > 0,
  );
  const esDescarga = (tagIds: string[]) => tagIds.includes(TAG_DELOAD);

  const b = bloqueActual(
    cerradas.map((s) => ({ fecha: s.session.fecha, deload: esDescarga(s.session.tag_ids) })),
  );
  const bloque = b ? { ...b, semana: semanaDesde(b.inicio, hoy) } : null;

  // Veredictos solo de la ventana: es lo único que se pinta. Las de antes van con
  // neto 0 — `balanceSemanal` las usa para saber desde cuándo hay datos, no suma.
  const desde = sumarDias(lunesDe(hoy), -7 * (SEMANAS_BALANCE - 1));
  const enVentana = cerradas.filter((s) => s.session.fecha >= desde);
  const nets = await loadSessionVerdictNets(enVentana.map((s) => s.session.id));
  const semanas = balanceSemanal(
    cerradas.map((s) => ({
      fecha: s.session.fecha,
      net: nets[s.session.id]?.net ?? 0,
      deload: esDescarga(s.session.tag_ids),
    })),
    hoy,
    SEMANAS_BALANCE,
  );

  return { mesociclo, bloque, semanas, filas };
}
