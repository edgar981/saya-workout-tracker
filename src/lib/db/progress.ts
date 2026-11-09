import {
  getActiveMesociclo,
  getPerformanceHistory,
  listRoutineDays,
  listSessionSummaries,
  loadDaySlots,
  todayISO,
} from "./queries";
import { db } from "./db";
import { loadSessionVerdictNets } from "./verdicts";
import type { Exercise, Mesociclo, SetLog } from "./types";
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
import { calcularVolumen, seriesDeAparicion, type SesionVolumen, type Volumen } from "@/lib/volumen";

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
  volumen: Volumen;
}

export async function loadProgreso(): Promise<ProgresoView> {
  const hoy = todayISO();
  const mesociclo = (await getActiveMesociclo()) ?? null;

  // El plan vigente: slots activos del mesociclo activo, el ejercicio del slot (no
  // sus alternativas). Un ejercicio en dos días aparece una vez, en el primero.
  const filas: ProgresoFila[] = [];
  const vistos = new Set<string>();
  const pesos = await db.bodyweightLogs.toArray();
  for (const day of await listRoutineDays()) {
    for (const { exercise } of await loadDaySlots(day.id)) {
      if (!exercise || vistos.has(exercise.id)) continue;
      vistos.add(exercise.id);
      const todas = await getPerformanceHistory(exercise.id, { limit: Number.MAX_SAFE_INTEGER });
      filas.push({ exercise, progreso: evaluarProgreso(aparicionesDe(todas, pesos), hoy) });
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

  return { mesociclo, bloque, semanas, filas, volumen: await loadVolumen(hoy) };
}

/**
 * Volumen por grupo (§12). TODOS los ejercicios hechos, no solo los del plan: una
 * sustitución o un ad-hoc también son trabajo. Por eso no sale de las travesías
 * de arriba (que son por ejercicio del plan) sino de una lectura de las cuatro
 * tablas — chicas, y se cuentan una vez.
 */
async function loadVolumen(hoy: string): Promise<Volumen> {
  const [sessions, instancias, sets, exercises] = await Promise.all([
    db.sessions.where("activa").equals(0).toArray(),
    db.sessionExercises.toArray(),
    db.setLogs.toArray(),
    db.exercises.toArray(),
  ]);

  const setsPorInstancia = new Map<string, SetLog[]>();
  for (const s of sets) {
    const lista = setsPorInstancia.get(s.session_exercise_id) ?? [];
    lista.push(s);
    setsPorInstancia.set(s.session_exercise_id, lista);
  }
  const porSesion = new Map<string, SesionVolumen["series"]>();
  for (const se of instancias) {
    const series = seriesDeAparicion(setsPorInstancia.get(se.id) ?? []);
    if (series === 0) continue;
    const lista = porSesion.get(se.session_id) ?? [];
    lista.push({ exerciseId: se.exercise_id, series });
    porSesion.set(se.session_id, lista);
  }

  const sesiones: SesionVolumen[] = sessions
    .filter((s) => porSesion.has(s.id))
    .map((s) => ({
      fecha: s.fecha,
      deload: s.tag_ids.includes(TAG_DELOAD),
      series: porSesion.get(s.id)!,
    }));

  return calcularVolumen(sesiones, new Map(exercises.map((e) => [e.id, e])), hoy);
}
