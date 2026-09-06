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
  // Cargando: esqueleto con la MISMA estructura y clases de texto que la tarjeta
  // real, así que reserva su altura EXACTA (§3). Antes devolvía `null` (cero
  // altura) y "Otra serie" —en acento— ocupaba este hueco hasta que llegaba el
  // dato: eso era el destello verde. Con el hueco reservado no hay destello ni el
  // desplazamiento de la nota "La unidad cambió…" que venía debajo. Las barras
  // van dentro de spans con las clases de texto reales para que la altura de
  // línea coincida al pixel.
  if (last === undefined) {
    return (
      <div
        className="bg-surface-2 flex flex-col gap-2.5 rounded-xl px-3.5 py-3"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-medium tracking-wide uppercase">
            <span className="bg-border inline-block h-2.5 w-24 rounded align-middle" />
          </span>
          <span className="bg-border ml-auto size-3.5 shrink-0 rounded" />
        </div>
        <div className="flex gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <p className="font-mono text-[9px] tabular-nums">
                <span className="bg-border inline-block h-2 w-4 rounded align-middle" />
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums">
                <span className="bg-border inline-block h-3.5 w-11 rounded align-middle" />
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (last === null) {
    return (
      <p className="text-muted-foreground text-xs">Sin registro previo de este ejercicio.</p>
    );
  }

  // v2: las series de la vez pasada por posición (S1 · S2 · S3), en DM Mono. El
  // enlace al historial completo del ejercicio se conserva — es el punto donde
  // vas a querer más contexto que la última sesión.
  return (
    <Link
      href={`/ejercicio/${exerciseId}`}
      className="bg-surface-2 hover:bg-surface flex flex-col gap-2.5 rounded-xl px-3.5 py-3"
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-wide uppercase">
          La pasada · {formatFecha(last.session.fecha)}
        </span>
        <ChevronRight className="text-muted-foreground ml-auto size-3.5 shrink-0" />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {summarize(last.sets, stackLabel).map((valor, i) => (
          <div key={i}>
            <p className="text-muted-foreground font-mono text-[9px] tabular-nums">S{i + 1}</p>
            <p className="mt-0.5 font-mono text-sm tabular-nums">{valor}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
