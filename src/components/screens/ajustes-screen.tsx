"use client";

import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { AjustesSkeleton } from "@/components/skeletons";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import {
  agruparPorGrupo,
  chipRespaldo,
  resumenCatalogo,
  resumenMesociclos,
  resumenPlantillas,
} from "@/lib/ajustes-resumen";
import { getBackupState, subscribeBackupState } from "@/lib/backup/client";
import { listActiveExercises, listMesociclos, listRoutineDays } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

/**
 * Ajustes (§2). Los destinos de cada varias semanas (Mesociclos · Plantillas ·
 * Catálogo · Datos), alcanzables desde la barra de navegación. Lee los
 * mesociclos, los días del activo y el catálogo para los subtítulos, y el
 * estado del respaldo para el chip de Datos.
 */
export default function AjustesScreen() {
  const mesociclos = useLiveQuery(() => listMesociclos(), []);
  const dias = useLiveQuery(() => listRoutineDays(), []);
  const ejercicios = useLiveQuery(() => listActiveExercises(), []);
  const estado = useSyncExternalStore(subscribeBackupState, getBackupState, getBackupState);

  if (mesociclos === undefined || dias === undefined || ejercicios === undefined) {
    return <AjustesSkeleton />;
  }

  const activo = mesociclos.find((m) => m.mesociclo.activo === 1)?.mesociclo.nombre ?? null;
  const grupos = agruparPorGrupo(ejercicios).filter((g) => g.grupo !== "Sin grupo").length;
  const chip = chipRespaldo(estado);

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Ajustes" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
            <Fila
              href="/mesociclos"
              titulo="Mesociclos"
              subtitulo={resumenMesociclos(mesociclos.length, activo)}
              chevron
            />
            <Fila
              href="/plantillas"
              titulo="Plantillas"
              subtitulo={resumenPlantillas(dias.length, activo)}
              chevron
            />
            <Fila
              href="/catalogo"
              titulo="Catálogo"
              subtitulo={resumenCatalogo(ejercicios.length, grupos)}
              chevron
            />
            <Fila
              href="/datos"
              titulo="Datos"
              subtitulo="Respaldo, archivo e integridad"
              valor={<span className={cn("bd", chip.cls)}>{chip.label}</span>}
              chevron
            />
          </div>
        </main>
      </Hoja>
    </>
  );
}
