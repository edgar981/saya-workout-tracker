"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ScissorsLineDashed } from "lucide-react";

import { unitTag } from "@/components/exercise-picker";
import { SetLines } from "@/components/history/set-lines";
import { EstadoLinea } from "@/components/progress/estado";
import { MarcaChart } from "@/components/progress/marca-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadExerciseHistory, todayISO, type ExerciseHistory } from "@/lib/db/queries";
import { aparicionesDe, evaluarProgreso } from "@/lib/progress";
import { formatSetWeight, unitSuffix } from "@/lib/units";
import { EjercicioSkeleton } from "@/components/skeletons";

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Etiqueta de unidad del snapshot vigente (no del catálogo): la línea de
 *  metadatos describe lo que se registró, no lo que dice el catálogo hoy. */
function unidadSnapshot(snap: NonNullable<ExerciseHistory["recentSnapshot"]>, stackLabel: string | null): string {
  if (snap.unit_type === "BODYWEIGHT") return "peso corporal";
  if (snap.unit_type === "BODYWEIGHT_PLUS")
    return `+${unitSuffix(snap.unit_type, snap.weight_basis, snap.added_unit)}`;
  return unitSuffix(snap.unit_type, snap.weight_basis, snap.added_unit, stackLabel);
}

export default function EjercicioScreen() {
  const params = useParams<{ exerciseId: string }>();
  const exerciseId = params.exerciseId;
  const router = useRouter();

  // §2: volver a DONDE se estaba, no al historial general. Desde la sesión
  // activa, el back del navegador regresa a /sesion — que restaura el ejercicio
  // exacto desde localStorage (saya:ejercicio:<id>), sin tocar el estado de la
  // sesión. Desde /historial/[id], regresa a esa sesión. Fallback a /historial
  // si se abrió esta pantalla directamente y no hay historial al que volver.
  const volver = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/historial");
  };

  // Capa 2 (§11) sale de la MISMA travesía: `todas` ya viene en el historial.
  const history = useLiveQuery(async () => {
    const h = await loadExerciseHistory(exerciseId);
    return { ...h, progreso: evaluarProgreso(aparicionesDe(h.todas), todayISO()) };
  }, [exerciseId]);

  if (history === undefined) {
    return <EjercicioSkeleton />;
  }

  const { exercise, entries, recentSnapshot, esUnilateral, totalSeries, bestSet, progreso } = history;
  const fuera = [
    progreso.otraCarga > 0 &&
      `${progreso.otraCarga} ${progreso.otraCarga === 1 ? "sesión no comparable" : "sesiones no comparables"} (otra carga, unidad o lateralidad)`,
    progreso.deload > 0 && `${progreso.deload} de descarga`,
  ].filter(Boolean);

  // Línea de metadatos (§4): unidad del snapshot vigente · lateralidad · total de
  // series. Sin apariciones, cae a la unidad del catálogo.
  const metaLine = recentSnapshot
    ? [
        unidadSnapshot(recentSnapshot, exercise?.stack_label ?? null),
        esUnilateral ? "unilateral" : "bilateral",
        `${totalSeries} ${totalSeries === 1 ? "serie" : "series"}`,
      ].join(" · ")
    : exercise
      ? unitTag(exercise)
      : "";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button variant="ghost" size="icon-sm" onClick={volver} aria-label="Volver">
          <ChevronLeft />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            {exercise?.nombre ?? "Ejercicio"}
          </h1>
          {metaLine && <p className="text-muted-foreground text-xs">{metaLine}</p>}
        </div>
      </header>

      {/* Mejor serie registrada: mayor peso dentro del snapshot vigente (§4). En
          unilateral, con su lado. Sin e1RM. */}
      {bestSet && (
        <div className="bg-surface rounded-xl border p-3.5">
          <span className="text-muted-foreground text-xs">Mejor serie registrada</span>
          <p className="mt-1 font-mono text-xl tabular-nums">
            {bestSet.isBodyweight
              ? `${bestSet.set.reps} reps`
              : `${bestSet.set.reps} × ${formatSetWeight(bestSet.set, exercise?.stack_label ?? null)}`}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {formatFecha(bestSet.fecha)}
            {bestSet.set.side && ` · lado ${bestSet.set.side}`}
          </p>
        </div>
      )}

      {/* Progreso (§11.7): estado y línea de marcas de las comparables. La marca
          no se muestra como número; al tocar un punto se leen sus series. */}
      {progreso.estado !== "sin_registros" && (
        <section className="bg-surface flex flex-col gap-3 rounded-xl border p-3.5">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Progreso</span>
            <EstadoLinea progreso={progreso} />
          </div>
          {progreso.mejor && progreso.puntos.length >= 2 && (
            <MarcaChart
              puntos={progreso.puntos}
              mejor={progreso.mejor}
              stackLabel={exercise?.stack_label ?? null}
            />
          )}
          <p className="text-muted-foreground text-xs">
            Cada punto: el promedio de tus dos mejores series de esa sesión. El anillo marca tu
            mejor sesión.
            {fuera.length > 0 && ` Fuera de la línea: ${fuera.join(" y ")}.`}
          </p>
        </section>
      )}

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
