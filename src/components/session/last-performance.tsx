"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { LastPerformance as LastPerformanceData } from "@/lib/db/queries";
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
      // §4: el peso se toma del primer lado CON valor, no de rows[0] (que tras
      // compareSets es siempre L). Si L está en null y R tiene valor, mostrar el
      // valor real, no "—". Si ninguno tiene, entonces sí "—".
      const conPeso = rows.find((r) => r.weight_value !== null) ?? rows[0];
      return `${reps} × ${formatSetWeight(conPeso, stackLabel)}`;
    });
}

/**
 * Los valores de la última vez que se hizo ESTE ejercicio (DECISIONES.md §5).
 * No es un adorno: es la pantalla donde eliges el peso de la siguiente serie.
 *
 * Ya no consulta: recibe `last` de la tarjeta padre, que lo carga una sola vez
 * con `getLastPerformance` y lo reusa para el placeholder de reps (§2 / criterio
 * 11: una sola travesía). `undefined` = cargando; `null` = sin registro previo.
 */
export function LastPerformance({
  exerciseId,
  stackLabel,
  last,
}: {
  exerciseId: string;
  stackLabel: string | null;
  last: LastPerformanceData | null | undefined;
}) {
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
