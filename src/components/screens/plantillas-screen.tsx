"use client";

import { useLiveQuery } from "dexie-react-hooks";

import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { contar, resumenDia } from "@/lib/ajustes-resumen";
import { getActiveMesociclo, listRoutineDays, loadDaySlots } from "@/lib/db/queries";
import { PlantillasSkeleton } from "@/components/skeletons";

export default function PlantillasScreen() {
  // Muestra los días del mesociclo ACTIVO. El selector de mesociclo vive en
  // /mesociclos, no aquí: esta pantalla edita el plan vigente.
  const data = useLiveQuery(async () => {
    const mesociclo = await getActiveMesociclo();
    const list = await listRoutineDays();
    const days = await Promise.all(
      list.map(async (day) => {
        const views = await loadDaySlots(day.id);
        return {
          day,
          activos: views.length,
          nombres: views.map((v) => v.exercise?.nombre).filter((n): n is string => Boolean(n)),
        };
      }),
    );
    return { mesociclo, days };
  }, []);

  if (data === undefined) {
    return <PlantillasSkeleton />;
  }

  const { mesociclo, days } = data;

  return (
    <>
      <div className="px-4">
        <Cabeza
          titulo="Plantillas"
          subtitulo={mesociclo ? `${mesociclo.nombre} · ${contar(days.length, "día", "días")}` : undefined}
          empujada
        />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <p className="dek">
            Los días del mesociclo activo. Cambiar de mesociclo se hace en Ajustes → Mesociclos.
            Reordenar o dar de baja aquí no toca el histórico: las sesiones ya registradas guardan su
            propio orden y su propio slot.
          </p>

          {/* Cada día es su propia ruta (/plantillas/[dayId]): el gesto atrás desde el
              detalle vuelve a esta lista, no sale de plantillas. */}
          <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
            {days.map(({ day, nombres }, i) => (
              <Fila
                key={day.id}
                href={`/plantillas/${day.id}`}
                chevron
                indice={String(i + 1).padStart(2, "0")}
                titulo={day.nombre}
                subtitulo={resumenDia(nombres)}
              />
            ))}
          </div>
        </main>
      </Hoja>
    </>
  );
}
