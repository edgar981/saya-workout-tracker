import { agruparPorSemana, type SesionDia } from "@/components/progress/semanas";
import { listRoutineDays, listSessionSummaries, todayISO } from "@/lib/db/queries";
import { loadSessionVerdictNets } from "@/lib/db/verdicts";
import type { RoutineDay } from "@/lib/db/types";
import { lunesDe, SEMANAS_BALANCE, sumarDias } from "@/lib/progress";

/**
 * Lo que Progreso necesita además de `loadProgreso` (SAYA-R2-5): los días de la
 * rutina, las sesiones de la ventana del balance agrupadas por semana (con su
 * neto) y las cifras de la cabeza. Sólo lecturas.
 */
export interface SemanasDias {
  dias: RoutineDay[];
  porSemana: Record<string, SesionDia[]>;
  /** Todas las sesiones cerradas con series, no sólo las de la ventana. */
  cerradas: number;
  /** La fecha más vieja de ellas. */
  primera: string | null;
}

export async function loadSemanasDias(): Promise<SemanasDias> {
  const dias = await listRoutineDays();
  const cerradas = (await listSessionSummaries()).filter(
    (s) => s.session.activa === 0 && s.totalSeries > 0,
  );
  const primera = cerradas.reduce<string | null>(
    (a, s) => (a === null || s.session.fecha < a ? s.session.fecha : a),
    null,
  );

  const desde = sumarDias(lunesDe(todayISO()), -7 * (SEMANAS_BALANCE - 1));
  const enVentana = cerradas.filter((s) => s.session.fecha >= desde);
  const nets = await loadSessionVerdictNets(enVentana.map((s) => s.session.id));
  const porSemana = agruparPorSemana(
    enVentana.map((s) => ({
      id: s.session.id,
      fecha: s.session.fecha,
      net: nets[s.session.id]?.net ?? 0,
      routineDayId: s.session.routine_day_id,
    })),
  );
  return { dias, porSemana, cerradas: cerradas.length, primera };
}
