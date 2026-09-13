import { db } from "./db";
import { listSessionSummaries, loadDaySlots, type SlotView } from "./queries";
import { loadSessionVerdicts, netFromVerdicts, type SessionVerdictNet } from "./verdicts";
import type { RoutineDay } from "./types";

/**
 * Datos de la hoja de vista previa del día (§1). Solo LECTURA: abrir, mirar y
 * cerrar la hoja no escribe nada en Dexie — ese es el punto entero.
 *
 * Reusa lo que ya existe: `loadDaySlots` (slots activos, en orden, con objetivo)
 * y, para "cómo fue la última vez", `loadSessionVerdicts` + `netFromVerdicts`
 * (misma travesía `getPerformanceHistory` y misma regla `compareAppearances` que
 * alimenta `/historial`). Ni una segunda travesía ni una segunda regla.
 */
export interface DayPreview {
  day: RoutineDay | null;
  slots: SlotView[];
  /** Última sesión CERRADA de este día con series; null si nunca se hizo. */
  ultima: { fecha: string; net: SessionVerdictNet } | null;
}

export async function loadDayPreview(dayId: string): Promise<DayPreview> {
  const day = (await db.routineDays.get(dayId)) ?? null;
  const slots = await loadDaySlots(dayId);

  // La última sesión de este día: cerrada, con series reales. listSessionSummaries
  // ya viene descendente por fecha, así que la primera que cuadre es la más
  // reciente.
  const summaries = await listSessionSummaries();
  const last = summaries.find(
    (s) => s.session.routine_day_id === dayId && s.session.activa === 0 && s.totalSeries > 0,
  );
  const ultima = last
    ? { fecha: last.session.fecha, net: netFromVerdicts(await loadSessionVerdicts(last.session.id)) }
    : null;

  return { day, slots, ultima };
}
