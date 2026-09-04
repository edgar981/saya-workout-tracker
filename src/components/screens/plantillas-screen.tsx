"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listRoutineDays, loadDaySlots } from "@/lib/db/queries";

export default function PlantillasScreen() {
  const days = useLiveQuery(async () => {
    const list = await listRoutineDays();
    return Promise.all(
      list.map(async (day) => ({
        day,
        activos: (await loadDaySlots(day.id)).length,
      })),
    );
  }, []);

  if (days === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Cargando…</p>;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Plantillas</h1>
      </header>

      <p className="text-muted-foreground text-sm">
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
