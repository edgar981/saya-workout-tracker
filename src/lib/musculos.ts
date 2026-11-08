import type { Exercise, GrupoMuscular, RolMuscular } from "@/lib/db/types";

/**
 * Grupos musculares (DECISIONES.md §12.2). Puro, sin Dexie: lo importan la
 * migración v4 (`db.ts`), el seed y la pantalla.
 */

/** Orden de pantalla y de desempate: empuje, tirón, brazo, pierna, core. */
export const GRUPOS: { id: GrupoMuscular; nombre: string }[] = [
  { id: "pecho", nombre: "Pecho" },
  { id: "espalda", nombre: "Espalda" },
  { id: "hombros", nombre: "Hombros" },
  { id: "biceps", nombre: "Bíceps" },
  { id: "triceps", nombre: "Tríceps" },
  { id: "antebrazo", nombre: "Antebrazo" },
  { id: "cuadriceps", nombre: "Cuádriceps" },
  { id: "isquios", nombre: "Isquiotibiales" },
  { id: "gluteos", nombre: "Glúteos" },
  { id: "pantorrillas", nombre: "Pantorrillas" },
  { id: "abdomen", nombre: "Abdomen" },
];

export const GRUPO_NOMBRE = Object.fromEntries(GRUPOS.map((g) => [g.id, g.nombre])) as Record<
  GrupoMuscular,
  string
>;

/** Conteo fraccional: la serie de un ejercicio cuenta 1 para sus grupos
 *  directos y ½ para los indirectos (§12.2). */
export const PESO_ROL: Record<RolMuscular, number> = { directo: 1, indirecto: 0.5 };

type Grupos = Exercise["grupos"];

/** Compuestos de empuje: el pecho mueve la carga; tríceps y hombro asisten. */
const EMPUJE: Grupos = { pecho: "directo", hombros: "indirecto", triceps: "indirecto" };
/** Jalones, dominadas y remos: el bíceps flexiona el codo en todos. */
const TIRON: Grupos = { espalda: "directo", biceps: "indirecto" };
/** Curls con agarre de mano: el antebrazo sostiene. */
const CURL: Grupos = { biceps: "directo", antebrazo: "indirecto" };
/** Sentadillas: el cuádriceps manda; el glúteo extiende la cadera. */
const SENTADILLA: Grupos = { cuadriceps: "directo", gluteos: "indirecto" };

/**
 * Clasificación de los ejercicios semilla, por id. Vive aquí y no en `seed.ts`
 * porque la usan dos caminos: el seed (instalación fresca) y la migración v4
 * (base existente), y `seed.ts` importa `db.ts`.
 *
 * Es una clasificación propuesta, no un dato observado: se corrige en el
 * catálogo. Editar esta tabla DESPUÉS del deploy de v4 no llega a una base que ya
 * migró — llega solo a instalaciones nuevas.
 *
 * Los ejercicios creados por el usuario no están aquí (su id es un uuid): nacen
 * sin grupo y /progreso los señala.
 */
export const GRUPOS_SEMILLA: Record<string, Grupos> = {
  // Day 1
  "ex-pull-up": TIRON,
  "ex-pull-down": TIRON,
  "ex-incline-bench-medium": EMPUJE,
  "ex-incline-db-press": EMPUJE,
  // Day 2
  "ex-db-skull-crushers": { triceps: "directo" },
  "ex-db-oh-triceps-extension": { triceps: "directo" },
  "ex-db-lateral-raises": { hombros: "directo" },
  "ex-barbell-bicep-curls": CURL,
  "ex-barbell-standing-wrist-curl": { antebrazo: "directo" },
  // Day 3
  "ex-squats": SENTADILLA,
  "ex-hack-squats": SENTADILLA,
  "ex-matrix-hack-squats": SENTADILLA,
  "ex-leg-curl": { isquios: "directo" },
  "ex-lying-leg-curl": { isquios: "directo" },
  "ex-hanging-leg-raises": { abdomen: "directo" },
  "ex-weighted-decline-crunches": { abdomen: "directo" },
  "ex-leg-extensions": { cuadriceps: "directo" },
  "ex-calf-raises": { pantorrillas: "directo" },
  // Day 4
  "ex-incline-bench-wide": EMPUJE,
  "ex-weighted-dips": EMPUJE,
  "ex-wide-grip-pull-down": TIRON,
  "ex-wide-grip-pull-up": TIRON,
  "ex-chest-supported-rows": TIRON,
  // Agarre cerrado: el tríceps es el objetivo; el pecho y el hombro asisten.
  "ex-close-grip-bench-press": { triceps: "directo", pecho: "indirecto", hombros: "indirecto" },
  // Day 5
  "ex-ez-bar-curl": CURL,
  "ex-db-bicep-curl": CURL,
  "ex-cable-curl": CURL,
  "ex-single-arm-cable-curl": CURL,
  "ex-cable-lateral-raises": { hombros: "directo" },
  "ex-single-arm-cable-push-down": { triceps: "directo" },
  "ex-forearm-curls": { antebrazo: "directo" },
  "ex-concentration-hammer-curls": CURL,
};

/** Copia de la clasificación semilla (nunca el objeto compartido: Dexie y React
 *  no deberían poder mutar la tabla de arriba). */
export function gruposSemilla(exerciseId: string): Grupos {
  return { ...(GRUPOS_SEMILLA[exerciseId] ?? {}) };
}

/** "Pecho" · "Bíceps, Antebrazo" — solo los directos; vacío si no hay. */
export function nombresDirectos(grupos: Grupos): string {
  return GRUPOS.filter((g) => grupos[g.id] === "directo")
    .map((g) => g.nombre)
    .join(", ");
}

export function sinGrupo(grupos: Grupos | undefined): boolean {
  return !grupos || Object.keys(grupos).length === 0;
}
