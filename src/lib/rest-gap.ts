import type { SetLog } from "@/lib/db/types";

/**
 * Tiempo entre registros (§ del prompt "Tiempo entre registros"). Todo derivado
 * en lectura desde `SetLog.creado_en`; nada se almacena. Neutro: sin umbrales,
 * sin colores por tiempo, sin rotularlo "descanso".
 */

/** Formato corto y neutro: "1:24", "12:05"; a partir de una hora, "1 h 04". */
export function formatGap(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** Los SetLog con `creado_en`, en orden cronológico. Las filas viejas (sin él) se omiten. */
function cronologico(sets: SetLog[]): { id: string; t: number }[] {
  return sets
    .filter((s): s is SetLog & { creado_en: string } => !!s.creado_en)
    .map((s) => ({ id: s.id, t: new Date(s.creado_en).getTime() }))
    .sort((a, b) => a.t - b.t);
}

/**
 * Hueco (ms) de cada SetLog contra el SetLog ANTERIOR de la sesión — sin importar
 * el ejercicio, así queda capturada la transición entre ejercicios (§2). El
 * primero de la sesión no tiene hueco (no aparece en el mapa).
 */
export function gapsBySetId(allSessionSets: SetLog[]): Map<string, number> {
  const chrono = cronologico(allSessionSets);
  const out = new Map<string, number>();
  for (let i = 1; i < chrono.length; i++) out.set(chrono[i].id, chrono[i].t - chrono[i - 1].t);
  return out;
}

/** Duración de la sesión: del primer al último `creado_en`. null si hay menos de dos. */
export function sessionDurationMs(allSessionSets: SetLog[]): number | null {
  const chrono = cronologico(allSessionSets);
  if (chrono.length < 2) return null;
  return chrono[chrono.length - 1].t - chrono[0].t;
}
