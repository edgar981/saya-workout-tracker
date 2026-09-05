"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, ChevronRight, Database, Flag, History, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/db";
import { countActiveSlots, getActiveSession, startSession } from "@/lib/db/queries";

/**
 * Antigüedad relativa corta de la sesión abierta (§1). Es lo que decide si vas a
 * retomarla ("hace 41 min") o si quedó abierta de un entrenamiento ya terminado
 * ("hace 3 días"). Dentro del día, minutos/horas; luego, días de calendario para
 * que "ayer" sea ayer y no depender de la hora exacta.
 */
function antiguedad(iso: string): string {
  const inicio = new Date(iso);
  const ahora = new Date();
  const min = Math.floor((ahora.getTime() - inicio.getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;

  const diaInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const diaAhora = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.round((diaAhora.getTime() - diaInicio.getTime()) / 86_400_000);
  if (dias === 0) return `hace ${Math.floor(min / 60)} h`;
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

export default function HomeScreen() {
  const router = useRouter();

  // `?? null` para distinguir "cargando" (undefined) de "no hay sesión activa"
  // (null). El home ya NO redirige a /sesion cuando hay sesión activa: en su
  // lugar muestra la entrada "Sesión en curso · continuar" (abajo). Así salir de
  // la sesión al home es un estado estable — sin esto, salir rebotaría de vuelta
  // (FLUJOS.md §2.3).
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, []);

  const days = useLiveQuery(async () => {
    const list = await db.routineDays.orderBy("orden").toArray();
    return Promise.all(
      list.map(async (day) => ({
        day,
        // Solo slots activos: el conteo debe coincidir con la plantilla real
        // (que ya filtra por activo en /plantillas). Ver §1.
        ejercicios: await countActiveSlots(day.id),
      })),
    );
  }, []);

  if (active === undefined || days === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Abriendo…</p>;
  }

  const start = async (routineDayId: string) => {
    await startSession(routineDayId);
    router.replace("/sesion");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4">
      <header className="pt-4">
        <h1 className="text-2xl font-semibold">saya</h1>
        <p className="text-muted-foreground text-sm">
          Elige el día. La app no propone ninguno.
        </p>
      </header>

      {/* Sesión en curso: retomar cuesta un tap. Elegir un día empieza una
          sesión NUEVA (y cierra esta, invariante de startSession), así que la
          entrada de continuar va primero y visible para no perderla de vista. */}
      {active && (
        <Button asChild className="h-auto justify-between px-4 py-4">
          <Link href="/sesion">
            <span className="flex flex-col gap-0.5 text-left">
              <span className="flex items-center gap-2 text-base font-medium">
                <Flag className="size-4" /> Sesión en curso
              </span>
              <span className="pl-6 text-xs font-normal opacity-80">
                {antiguedad(active.iniciada_en)}
              </span>
            </span>
            <span className="flex items-center gap-2 text-sm">
              continuar
              <ChevronRight />
            </span>
          </Link>
        </Button>
      )}

      <div className="flex flex-col gap-2">
        {days.map(({ day, ejercicios }) => (
          <Button
            key={day.id}
            variant="outline"
            className="h-auto justify-between px-4 py-4"
            onClick={() => void start(day.id)}
          >
            <span className="text-base font-medium">{day.nombre}</span>
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              {ejercicios} ejercicios
              <ChevronRight />
            </span>
          </Button>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-start gap-1 pb-2">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/historial">
            <History /> Historial
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/plantillas">
            <ListChecks /> Plantillas
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/catalogo">
            <BookOpen /> Catálogo
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/datos">
            <Database /> Respaldo y restauración
          </Link>
        </Button>
      </div>
    </main>
  );
}
