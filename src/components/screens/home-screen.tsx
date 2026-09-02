"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, ChevronRight, Database, History, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db/db";
import { countActiveSlots, getActiveSession, startSession } from "@/lib/db/queries";

export default function HomeScreen() {
  const router = useRouter();

  // `?? null` para poder distinguir "cargando" (undefined) de "no hay sesión
  // activa" (null). Sin eso, el arranque parpadea el selector de día encima de
  // una sesión que sí existía.
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

  // Sesión activa: se entra directo, sin preguntar. El teléfono se bloqueó a
  // mitad del entrenamiento y volver a elegir el día sería absurdo.
  useEffect(() => {
    if (active) router.replace("/sesion");
  }, [active, router]);

  if (active === undefined || days === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Abriendo…</p>;
  }

  if (active) {
    return <p className="text-muted-foreground p-6 text-sm">Reanudando la sesión…</p>;
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
