"use client";

import { Badge } from "@/components/ui/badge";
import { groupSetLines } from "@/lib/history-format";
import type { SetLog } from "@/lib/db/types";

/**
 * Render de solo lectura de las series de una instancia. Toda la unidad y el
 * peso salen del snapshot del SetLog (ver groupSetLines). No escribe nada.
 */
export function SetLines({ sets, stackLabel }: { sets: SetLog[]; stackLabel: string | null }) {
  const lines = groupSetLines(sets, stackLabel);

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
        </div>
      ))}
    </div>
  );
}
