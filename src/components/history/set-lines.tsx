"use client";

import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { groupSetLines } from "@/lib/history-format";
import { formatGap } from "@/lib/rest-gap";
import type { SetLog } from "@/lib/db/types";

/**
 * Render de solo lectura de las series de una instancia. Toda la unidad y el
 * peso salen del snapshot del SetLog (ver groupSetLines). No escribe nada.
 *
 * `gaps` (setId → ms) es opcional: solo el detalle de sesión lo pasa, para
 * mostrar el hueco contra la serie anterior (§4). El historial de ejercicio no.
 */
export function SetLines({
  sets,
  stackLabel,
  gaps,
}: {
  sets: SetLog[];
  stackLabel: string | null;
  gaps?: Map<string, number>;
}) {
  const lines = groupSetLines(sets, stackLabel, gaps);

  return (
    <div className="flex flex-col gap-1">
      {lines.map((line) => (
        <div key={line.setIndex} className="flex items-baseline gap-2 text-sm">
          <span className="text-muted-foreground w-12 shrink-0 text-xs">Serie {line.setIndex}</span>
          <span className="font-medium tabular-nums">
            {line.repsText}
            {line.total !== null && (
              <span className="text-muted-foreground font-normal"> ({line.total})</span>
            )}
          </span>
          {line.isBodyweight ? (
            <span className="text-muted-foreground text-xs">peso corporal</span>
          ) : (
            <>
              <span className="text-muted-foreground">×</span>
              <span className="tabular-nums">{line.weightText}</span>
            </>
          )}
          {line.esExtra && (
            <Badge variant="secondary" className="text-[10px]">
              extra
            </Badge>
          )}
          {/* Hueco contra la serie anterior (§4). Discreto y neutro: sin rótulo
              "descanso", sin color por tiempo. Ausente en la primera serie y en
              las filas anteriores a creado_en. */}
          {line.gap !== null && (
            <span className="text-muted-foreground ml-auto flex items-center gap-1 self-center text-xs tabular-nums">
              <Clock className="size-3 shrink-0" />
              {formatGap(line.gap)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
