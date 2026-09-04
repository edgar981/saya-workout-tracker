/**
 * Nombres de las ocho tablas, aislados de Dexie.
 *
 * Vive aparte de `db.ts` a propósito: `db.ts` importa Dexie e instancia
 * `WorkoutDB` al cargar, y Dexie no existe fuera del navegador. El respaldo a
 * Postgres corre en rutas de API (Node), que necesitan esta lista para validar
 * un volcado SIN arrastrar Dexie al servidor. Un solo lugar la define; `db.ts`
 * la reexporta para que el resto de la app la siga importando desde ahí.
 */
export const TABLE_NAMES = [
  "exercises",
  "routineDays",
  "routineSlots",
  "sessions",
  "sessionExercises",
  "setLogs",
  "sessionTags",
  "bodyweightLogs",
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
