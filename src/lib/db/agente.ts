import { db } from "./db";
import type { DatosCuerpo } from "@/lib/agente/filas";

/**
 * Lo que el agente lee de Cuerpo (SAYA-R2-6). Sólo LECTURA de tablas que ya
 * existen: nada se escribe (§3.5). Las etiquetas, los mesociclos y las plantillas
 * no se mandan.
 */
export async function leerDatosCuerpo(desde: string): Promise<DatosCuerpo> {
  return db.transaction(
    "r",
    [db.sessions, db.sessionExercises, db.setLogs, db.exercises, db.routineDays, db.bodyweightLogs],
    async () => {
      const sesiones = await db.sessions.where("fecha").aboveOrEqual(desde).toArray();
      const apariciones = await db.sessionExercises
        .where("session_id")
        .anyOf(sesiones.map((s) => s.id))
        .toArray();
      const sets = await db.setLogs
        .where("session_exercise_id")
        .anyOf(apariciones.map((a) => a.id))
        .toArray();
      const ejercicios = await db.exercises.toArray();
      const dias = await db.routineDays.toArray();
      const pesos = await db.bodyweightLogs.where("fecha").aboveOrEqual(desde).toArray();
      return { sesiones, apariciones, sets, ejercicios, dias, pesos };
    },
  );
}
