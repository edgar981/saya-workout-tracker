import { db } from "./db";
import {
  getActiveMesociclo,
  listSessionSummaries,
  loadDaySlots,
  loadSessionDetail,
  type SlotView,
} from "./queries";
import { loadSessionVerdicts, netFromVerdicts, type SessionVerdictNet } from "./verdicts";
import { groupSetLines, type SetLine } from "@/lib/history-format";
import type { RoutineDay } from "./types";

/**
 * Datos de la hoja de vista previa del día (§1). Solo LECTURA: abrir, mirar y
 * cerrar la hoja no escribe nada en Dexie — ese es el punto entero.
 *
 * Reusa lo que ya existe: `loadDaySlots` (slots activos, en orden, con objetivo)
 * y, para "cómo fue la última vez", `loadSessionVerdicts` + `netFromVerdicts`
 * (misma travesía `getPerformanceHistory` y misma regla `compareAppearances` que
 * alimenta `/historial`). Ni una segunda travesía ni una segunda regla. Las series
 * de la última vez salen de `loadSessionDetail` + `groupSetLines`, las mismas del
 * detalle de Historial.
 */
export interface DayPreview {
  day: RoutineDay | null;
  slots: SlotView[];
  /** Nombre del mesociclo activo, o null si no hay. */
  mesocicloNombre: string | null;
  /** Última sesión CERRADA de este día con series; null si nunca se hizo. */
  ultima: {
    fecha: string;
    net: SessionVerdictNet;
    /** Por `routine_slot_id`: el ejercicio que se hizo y sus líneas. */
    porSlot: Record<string, { exerciseId: string; lineas: SetLine[] }>;
  } | null;
}

export async function loadDayPreview(dayId: string): Promise<DayPreview> {
  const day = (await db.routineDays.get(dayId)) ?? null;
  const slots = await loadDaySlots(dayId);
  const mesocicloNombre = (await getActiveMesociclo())?.nombre ?? null;

  // La última sesión de este día: cerrada, con series reales. listSessionSummaries
  // ya viene descendente por fecha, así que la primera que cuadre es la más
  // reciente.
  const summaries = await listSessionSummaries();
  const last = summaries.find(
    (s) => s.session.routine_day_id === dayId && s.session.activa === 0 && s.totalSeries > 0,
  );
  let ultima: DayPreview["ultima"] = null;
  if (last) {
    const net = netFromVerdicts(await loadSessionVerdicts(last.session.id));
    const detalle = await loadSessionDetail(last.session.id);
    const porSlot: Record<string, { exerciseId: string; lineas: SetLine[] }> = {};
    for (const item of detalle?.items ?? []) {
      const slotId = item.sessionExercise.routine_slot_id;
      if (!slotId) continue;
      porSlot[slotId] = {
        exerciseId: item.exercise.id,
        lineas: groupSetLines(item.sets, item.exercise.stack_label),
      };
    }
    ultima = { fecha: last.session.fecha, net, porSlot };
  }

  return { day, slots, mesocicloNombre, ultima };
}
