"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Trash2 } from "lucide-react";

import { SetLines } from "@/components/history/set-lines";
import { VerdictBadge } from "@/components/history/verdict-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { discardSession, loadSessionDetail, type SessionExerciseView } from "@/lib/db/queries";
import { loadSessionVerdicts } from "@/lib/db/verdicts";
import type { VerdictCategory } from "@/lib/verdict";
import { cn } from "@/lib/utils";

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Ventana en la que el borrado queda armado tras el primer toque. */
const ARMED_MS = 5000;

type Estado = "realizado" | "iniciado_sin_registro" | "no_realizado";

function estadoDe(item: SessionExerciseView): Estado {
  if (item.sets.length > 0) return "realizado";
  return item.sessionExercise.orden_ejecucion !== null ? "iniciado_sin_registro" : "no_realizado";
}

const TALLY_ORDER: { key: VerdictCategory; label: string }[] = [
  { key: "mejor", label: "mejor" },
  { key: "igual", label: "igual" },
  { key: "peor", label: "peor" },
  { key: "sin_comparacion", label: "sin comparación" },
];

export default function SessionDetailScreen() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const detail = useLiveQuery(() => loadSessionDetail(sessionId), [sessionId]);
  // Solo el detalle de historial importa este loader; la sesión activa nunca lo
  // toca. Devuelve {} para sesiones activas (veredicto solo en cerradas).
  const verdicts = useLiveQuery(() => loadSessionVerdicts(sessionId), [sessionId]) ?? {};

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

  // Resumen del veredicto (§3): tally por categoría, solo en sesiones cerradas
  // con al menos un ejercicio comparado.
  const tally: Record<VerdictCategory, number> = { mejor: 0, igual: 0, peor: 0, sin_comparacion: 0 };
  for (const id in verdicts) tally[verdicts[id].verdict.category]++;
  const totalVeredictos = Object.keys(verdicts).length;
  const showSummary = totalVeredictos > 0;
  const tallyEntries = TALLY_ORDER.filter((t) => tally[t.key] > 0);

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

      {/* Resumen + tags juntos: "peor en 4 + dormí mal" se lee distinto que
          "peor en 4" a secas. Los tags empiezan a servir aquí (§3). */}
      {showSummary && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
            {tallyEntries.map((t) => (
              <span
                key={t.key}
                className={cn(
                  "font-medium",
                  t.key === "mejor" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                )}
              >
                {tally[t.key]} {t.label}
              </span>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="text-[10px]">
                  {tag.nombre}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contexto: peso corporal, nota, y los tags cuando NO hay resumen (sesión
          activa, o cerrada sin ejercicios comparados) — para no perderlos. */}
      {(bodyweight ||
        (session.nota && session.nota.trim() !== "") ||
        (!showSummary && tags.length > 0)) && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          {!showSummary && tags.length > 0 && (
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
          const veredicto = verdicts[item.sessionExercise.id];

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

              {/* Veredicto por ejercicio: solo instancias con series de sesiones
                  cerradas (el loader ya filtra ambas). Discreto. */}
              {veredicto && <VerdictBadge item={veredicto} />}

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
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/sesion">Sesión en curso · abrir para cerrarla o descartarla</Link>
        </Button>
      ) : (
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
