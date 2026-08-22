"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ScissorsLineDashed } from "lucide-react";

import { unitTag } from "@/components/exercise-picker";
import { SetLines } from "@/components/history/set-lines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadExerciseHistory } from "@/lib/db/queries";

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function EjercicioScreen() {
  const params = useParams<{ exerciseId: string }>();
  const exerciseId = params.exerciseId;

  const history = useLiveQuery(() => loadExerciseHistory(exerciseId), [exerciseId]);

  if (history === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Cargando…</p>;
  }

  const { exercise, entries } = history;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/historial" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            {exercise?.nombre ?? "Ejercicio"}
          </h1>
          {exercise && <p className="text-muted-foreground text-xs">{unitTag(exercise)}</p>}
        </div>
      </header>

      <p className="text-muted-foreground text-xs">Últimas 5 sesiones con series.</p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay series registradas de este ejercicio.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry, i) => {
            // §3.5: si el snapshot de unidad cambia entre sesiones, se corta la
            // serie en vez de fingir continuidad. Se compara contra la entrada
            // anterior (más reciente) de la lista.
            const cambioUnidad = i > 0 && entries[i - 1].unitKey !== entry.unitKey;

            return (
              <Fragment key={entry.sessionExercise.id}>
                {cambioUnidad && (
                  <div className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
                    <ScissorsLineDashed className="size-3.5" />
                    <span>
                      La unidad cambió aquí. Arriba y abajo de esta línea no son comparables.
                    </span>
                  </div>
                )}

                <Link
                  href={`/historial/${entry.session.id}`}
                  className="hover:bg-accent flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatFecha(entry.session.fecha)}</span>
                    {entry.isSubstitution && entry.slotExerciseNombre && (
                      <Badge variant="secondary" className="text-[10px]">
                        sustituye a {entry.slotExerciseNombre}
                      </Badge>
                    )}
                  </div>
                  <SetLines sets={entry.sets} stackLabel={exercise?.stack_label ?? null} />
                </Link>
              </Fragment>
            );
          })}
        </div>
      )}
    </main>
  );
}
