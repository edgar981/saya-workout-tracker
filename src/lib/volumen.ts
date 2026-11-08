import type { Exercise, GrupoMuscular, RolMuscular, SetLog } from "@/lib/db/types";
import { GRUPOS, PESO_ROL, sinGrupo } from "@/lib/musculos";
import { lunesDe, sumarDias } from "@/lib/progress";

/**
 * Volumen por grupo muscular (DECISIONES.md §12). Reglas puras, sin Dexie: el
 * loader (`lib/db/progress.ts`) junta las sesiones y esto cuenta. Nada se
 * almacena (§3.5).
 */

/** Semanas que promedia la semana típica (§12.3). */
export const SEMANAS_TIPICAS = 4;
/** Semanas de la tira por grupo: las mismas que el balance (§11.6). */
export const SEMANAS_VOLUMEN = 8;

/**
 * Series de una aparición (§12.1): un `set_index` distinto con reps > 0. Los
 * segmentos de un giant set son UNA serie (§3.2), y L + R con el mismo índice
 * también: cada lado recibió una serie.
 */
export function seriesDeAparicion(sets: Pick<SetLog, "set_index" | "reps">[]): number {
  return new Set(sets.filter((s) => s.reps > 0).map((s) => s.set_index)).size;
}

export interface SesionVolumen {
  fecha: string;
  deload: boolean;
  /** Series por ejercicio en esta sesión (solo los que tuvieron alguna). */
  series: { exerciseId: string; series: number }[];
}

export interface SemanaVolumen {
  lunes: string;
  sesiones: number;
  deload: boolean;
}

export interface AporteEjercicio {
  exerciseId: string;
  nombre: string;
  rol: RolMuscular;
  /** Series por semana en la semana típica, SIN ponderar (lo que hiciste). */
  series: number;
}

export interface VolumenGrupo {
  grupo: GrupoMuscular;
  nombre: string;
  /** Series por semana, ya ponderadas: directas + ½ · indirectas. */
  tipica: number;
  directas: number;
  /** Sin ponderar. En la barra pesan la mitad. */
  indirectas: number;
  /** Ponderado, alineado con `Volumen.semanas`; null = semana sin sesiones. */
  porSemana: (number | null)[];
  /** Ejercicios que suman en la semana típica, de mayor a menor aporte. */
  aportes: AporteEjercicio[];
}

export interface Volumen {
  /** Lunes de las semanas que promedia la típica, ascendente. Vacío = no hay. */
  tipicas: string[];
  /** La tira: últimas `SEMANAS_VOLUMEN`, la actual incluida. */
  semanas: SemanaVolumen[];
  /** Los once grupos, de mayor a menor semana típica (empate: orden de GRUPOS). */
  grupos: VolumenGrupo[];
  /** Ejercicios sin grupo con series en la tira: lo que el volumen NO cuenta. */
  sinGrupo: { exerciseId: string; nombre: string; series: number }[];
}

interface Semana extends SemanaVolumen {
  /** Series por ejercicio en la semana, sin ponderar. */
  porEjercicio: Map<string, number>;
}

/**
 * `sesiones`: cerradas y con series (la activa no entra: una sesión a medias
 * contaría una semana a medias). `ejercicios`: todos, activos o no — una serie de
 * un ejercicio dado de baja sigue siendo trabajo hecho.
 */
export function calcularVolumen(
  sesiones: SesionVolumen[],
  ejercicios: Map<string, Pick<Exercise, "nombre" | "grupos">>,
  hoy: string,
): Volumen {
  const porSemana = new Map<string, Semana>();
  for (const s of sesiones) {
    const lunes = lunesDe(s.fecha);
    const sem = porSemana.get(lunes) ?? {
      lunes,
      sesiones: 0,
      deload: false,
      porEjercicio: new Map<string, number>(),
    };
    sem.sesiones += 1;
    sem.deload ||= s.deload;
    for (const { exerciseId, series } of s.series) {
      sem.porEjercicio.set(exerciseId, (sem.porEjercicio.get(exerciseId) ?? 0) + series);
    }
    porSemana.set(lunes, sem);
  }

  const actual = lunesDe(hoy);

  // Semana típica (§12.3): las últimas N semanas COMPLETAS con sesiones y sin
  // descarga. Una semana vacía es una pausa y una de descarga es volumen recortado
  // a propósito: ninguna describe una semana normal de entrenamiento.
  const tipicas = [...porSemana.values()]
    .filter((w) => w.lunes < actual && !w.deload)
    .map((w) => w.lunes)
    .sort()
    .slice(-SEMANAS_TIPICAS);

  // La tira, con el mismo recorte que el balance: nada antes de la primera sesión.
  const primera = [...porSemana.keys()].sort()[0];
  const semanas: Semana[] = [];
  for (let i = SEMANAS_VOLUMEN - 1; i >= 0; i--) {
    const lunes = sumarDias(actual, -7 * i);
    if (primera === undefined || lunes < primera) continue;
    semanas.push(
      porSemana.get(lunes) ?? { lunes, sesiones: 0, deload: false, porEjercicio: new Map() },
    );
  }

  const ponderado = (w: Semana, grupo: GrupoMuscular): number => {
    let total = 0;
    for (const [id, series] of w.porEjercicio) {
      const rol = ejercicios.get(id)?.grupos?.[grupo];
      if (rol) total += series * PESO_ROL[rol];
    }
    return total;
  };

  // Series por ejercicio en la semana típica (suma; se divide al usarla).
  const enTipicas = new Map<string, number>();
  for (const lunes of tipicas) {
    for (const [id, series] of porSemana.get(lunes)!.porEjercicio) {
      enTipicas.set(id, (enTipicas.get(id) ?? 0) + series);
    }
  }
  const n = tipicas.length;

  const grupos: VolumenGrupo[] = GRUPOS.map(({ id: grupo, nombre }) => {
    const aportes: AporteEjercicio[] = [];
    let directas = 0;
    let indirectas = 0;
    for (const [exerciseId, total] of enTipicas) {
      const e = ejercicios.get(exerciseId);
      const rol = e?.grupos?.[grupo];
      if (!e || !rol) continue;
      const series = total / n;
      aportes.push({ exerciseId, nombre: e.nombre, rol, series });
      if (rol === "directo") directas += series;
      else indirectas += series;
    }
    aportes.sort((a, b) => b.series * PESO_ROL[b.rol] - a.series * PESO_ROL[a.rol]);
    return {
      grupo,
      nombre,
      tipica: directas + indirectas * PESO_ROL.indirecto,
      directas,
      indirectas,
      porSemana: semanas.map((w) => (w.sesiones === 0 ? null : ponderado(w, grupo))),
      aportes,
    };
  });
  // Estable: a igual volumen, el orden de GRUPOS.
  grupos.sort((a, b) => b.tipica - a.tipica);

  const sinGrupoEnTira = new Map<string, number>();
  for (const w of semanas) {
    for (const [id, series] of w.porEjercicio) {
      if (sinGrupo(ejercicios.get(id)?.grupos)) {
        sinGrupoEnTira.set(id, (sinGrupoEnTira.get(id) ?? 0) + series);
      }
    }
  }

  return {
    tipicas,
    semanas: semanas.map(({ lunes, sesiones, deload }) => ({ lunes, sesiones, deload })),
    grupos,
    sinGrupo: [...sinGrupoEnTira].map(([exerciseId, series]) => ({
      exerciseId,
      nombre: ejercicios.get(exerciseId)?.nombre ?? "Ejercicio desconocido",
      series,
    })),
  };
}

/** Redondeo de pantalla: a medias series, que es la resolución real del conteo. */
export function redondearMedia(x: number): number {
  return Math.round(x * 2) / 2;
}
