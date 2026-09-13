"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getActiveMesociclo, listRoutineDays, loadDaySlots } from "@/lib/db/queries";
import { PlantillasSkeleton } from "@/components/skeletons";
import { useVolver } from "@/lib/use-volver";

export default function PlantillasScreen() {
  // /plantillas es alcanzable desde /ajustes y desde /plantillas/[dayId] (chevron
  // de vuelta), así que el chevron sigue el historial real (= el edge-swipe), con
  // respaldo a /ajustes en frío. Ver src/lib/use-volver.ts.
  const volver = useVolver("/ajustes");

  // Muestra los días del mesociclo ACTIVO. El selector de mesociclo vive en
  // /mesociclos, no aquí: esta pantalla edita el plan vigente.
  const data = useLiveQuery(async () => {
    const mesociclo = await getActiveMesociclo();
    const list = await listRoutineDays();
    const days = await Promise.all(
      list.map(async (day) => ({
        day,
        activos: (await loadDaySlots(day.id)).length,
      })),
    );
    return { mesociclo, days };
  }, []);

  if (data === undefined) {
    return <PlantillasSkeleton />;
  }

  const { mesociclo, days } = data;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button variant="ghost" size="icon-sm" onClick={volver} aria-label="Volver">
          <ChevronLeft />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Plantillas</h1>
          {mesociclo && (
            <p className="text-muted-foreground truncate text-xs">
              Editando <span className="text-foreground">{mesociclo.nombre}</span>
            </p>
          )}
        </div>
      </header>

      <p className="text-muted-foreground text-sm">
        Los días del mesociclo activo. Cambiar de mesociclo se hace en Ajustes → Mesociclos.
        Reordenar o dar de baja aquí no toca el histórico: las sesiones ya registradas guardan su
        propio orden y su propio slot.
      </p>

      {/* Cada día es su propia ruta (/plantillas/[dayId]): el gesto atrás desde el
          detalle vuelve a esta lista, no sale de plantillas. */}
      <div className="flex flex-col gap-2">
        {days.map(({ day, activos }) => (
          <Button
            key={day.id}
            asChild
            variant="outline"
            className="h-auto justify-between px-4 py-4"
          >
            <Link href={`/plantillas/${day.id}`}>
              <span className="text-base font-medium">{day.nombre}</span>
              <span className="text-muted-foreground flex items-center gap-2 text-sm">
                {activos} ejercicios
                <ChevronRight />
              </span>
            </Link>
          </Button>
        ))}
      </div>
    </main>
  );
}
