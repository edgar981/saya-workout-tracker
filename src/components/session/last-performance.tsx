"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";

import { getLastPerformance } from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";
import { formatSetWeight } from "@/lib/units";

function formatFecha(iso: string): string {
  // Partido a mano: new Date('2026-08-14') se parsea como UTC y en América
  // muestra el día anterior.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}

function summarize(sets: SetLog[], stackLabel: string | null): string[] {
  const groups = new Map<number, SetLog[]>();
  for (const set of sets) {
    const list = groups.get(set.set_index) ?? [];
    list.push(set);
    groups.set(set.set_index, list);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, rows]) => {
      const reps = rows
        .map((r) => (r.side ? `${r.reps}${r.side}` : String(r.reps)))
        .join(rows.some((r) => r.segment_index > 0) ? "+" : "/");
      return `${reps} × ${formatSetWeight(rows[0], stackLabel)}`;
    });
}

/**
 * Los valores de la última vez que se hizo ESTE ejercicio, buscados por
 * exercise_id y no por slot (DECISIONES.md §5). Si la vez pasada sustituiste
 * Squats por Hack Squats, hoy al hacer Hack Squats ves Hack Squats.
 *
 * No es un adorno: es la pantalla donde eliges el peso de la siguiente serie.
 */
export function LastPerformance({
  exerciseId,
  sessionId,
  stackLabel,
}: {
  exerciseId: string;
  sessionId: string;
  stackLabel: string | null;
}) {
  const last = useLiveQuery(
    () => getLastPerformance(exerciseId, sessionId),
    [exerciseId, sessionId],
  );

  if (last === undefined) return null;

  if (last === null) {
    return (
      <p className="text-muted-foreground text-xs">Sin registro previo de este ejercicio.</p>
    );
  }

  return (
    // Enlace al historial completo del ejercicio: es el punto donde vas a querer
    // más contexto que la última sesión.
    <Link
      href={`/ejercicio/${exerciseId}`}
      className="bg-muted/50 hover:bg-muted flex items-center gap-2 rounded-lg px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          Última vez · {formatFecha(last.session.fecha)}
        </p>
        <p className="mt-0.5 text-sm tabular-nums">
          {summarize(last.sets, stackLabel).join("  ·  ")}
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}
