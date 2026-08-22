"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Trash2 } from "lucide-react";

import { SetLines } from "@/components/history/set-lines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { discardSession, loadSessionDetail, type SessionExerciseView } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Tres estados de una instancia (§4). El proxy de ejecución es orden_ejecucion,
 * pero "se empezó" no es "tiene series" (types.ts §1.2), así que sets.length se
 * comprueba aparte. Ninguno de los dos vacíos se oculta: una instancia sin
 * series es el registro de que no lo hiciste.
 */
/** Ventana en la que el borrado queda armado tras el primer toque. */
const ARMED_MS = 5000;

type Estado = "realizado" | "iniciado_sin_registro" | "no_realizado";

function estadoDe(item: SessionExerciseView): Estado {
  if (item.sets.length > 0) return "realizado";
  return item.sessionExercise.orden_ejecucion !== null ? "iniciado_sin_registro" : "no_realizado";
}

export default function SessionDetailScreen() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const detail = useLiveQuery(() => loadSessionDetail(sessionId), [sessionId]);

  const router = useRouter();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

  if (detail === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Cargando…</p>;
  }
  if (detail === null) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
        <p className="text-muted-foreground text-sm">Esta sesión no existe.</p>
        <Button asChild variant="outline">
          <Link href="/historial">Volver al historial</Link>
        </Button>
      </main>
    );
  }

  const { session, routineDay, tags, bodyweight, items } = detail;

  // Borrado duro en cascada (D8), reusando discardSession — no una segunda
  // función de borrado. Editar una sesión pasada sigue fuera de alcance porque
  // reescribe datos en silencio; eliminarla completa es limpio.
  const eliminar = async () => {
    await discardSession(sessionId);
    router.replace("/historial");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/historial" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold capitalize">{formatFecha(session.fecha)}</h1>
          <p className="text-muted-foreground text-xs">
            {routineDay?.nombre ?? "Sesión libre"}
            {session.activa === 1 ? " · en curso" : ""}
          </p>
        </div>
      </header>

      {(tags.length > 0 || bodyweight || (session.nota && session.nota.trim() !== "")) && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px]">
                  {tag.nombre}
                </Badge>
              ))}
            </div>
          )}
          {bodyweight && (
            <p className="text-sm">
              Peso corporal:{" "}
              <span className="tabular-nums">
                {bodyweight.valor} {bodyweight.unidad.toLowerCase()}
              </span>
            </p>
          )}
          {session.nota && session.nota.trim() !== "" && (
            <p className="text-muted-foreground text-sm">{session.nota}</p>
          )}
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const estado = estadoDe(item);
          const atenuado = estado !== "realizado";
          const slot = item.slot;

          return (
            <div
              key={item.sessionExercise.id}
              className={cn("flex flex-col gap-2 rounded-lg border p-3", atenuado && "opacity-60")}
            >
              <div className="flex items-start gap-2">
                <Link
                  href={`/ejercicio/${item.exercise.id}`}
                  className="min-w-0 flex-1 text-base font-medium hover:underline"
                >
                  {item.exercise.nombre}
                </Link>
                {item.sessionExercise.orden_ejecucion !== null && (
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {item.sessionExercise.orden_ejecucion}º
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {item.isSubstitution && item.slotExercise && (
                  <Badge variant="secondary" className="text-[10px]">
                    sustituye a {item.slotExercise.nombre}
                  </Badge>
                )}
                {item.isAdHoc && (
                  <Badge variant="outline" className="text-[10px]">
                    fuera de plantilla
                  </Badge>
                )}
                {slot && slot.target_sets !== null && slot.target_reps !== null && (
                  <Badge variant="outline" className="text-[10px]">
                    objetivo {slot.target_sets} × {slot.target_reps}
                  </Badge>
                )}
              </div>

              {estado === "realizado" && (
                <SetLines sets={item.sets} stackLabel={item.exercise.stack_label} />
              )}
              {estado === "iniciado_sin_registro" && (
                <p className="text-muted-foreground text-xs italic">
                  Se empezó, sin series registradas.
                </p>
              )}
              {estado === "no_realizado" && (
                <p className="text-muted-foreground text-xs italic">No realizado.</p>
              )}

              {item.sessionExercise.nota && (
                <p className="text-muted-foreground border-t pt-2 text-xs">
                  {item.sessionExercise.nota}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Acción destructiva, discreta y al final: poco frecuente. */}
      {session.activa === 1 ? (
        // La sesión activa tiene su propio camino de descarte (en el cierre).
        // Borrarla desde aquí dejaría a la app apuntando a una sesión inexistente.
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/sesion">Sesión en curso · abrir para cerrarla o descartarla</Link>
        </Button>
      ) : (
        // Guarda de doble toque, como el descarte del cierre. Sin modal.
        <Button
          variant={armed ? "destructive" : "ghost"}
          size="sm"
          className={armed ? "self-start" : "text-muted-foreground self-start"}
          onClick={() => (armed ? void eliminar() : setArmed(true))}
        >
          <Trash2 />
          {armed ? "Tocar de nuevo para eliminar" : "Eliminar sesión"}
        </Button>
      )}
    </main>
  );
}
