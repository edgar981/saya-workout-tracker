"use client";

import { Badge } from "@/components/ui/badge";
import { groupSetLines } from "@/lib/history-format";
import { formatGap } from "@/lib/rest-gap";
import type { SetLog } from "@/lib/db/types";

/**
 * Render de solo lectura de las series de una instancia. Toda la unidad y el
 * peso salen del snapshot del SetLog (ver groupSetLines). No escribe nada.
 *
 * `gaps` (setId → ms) es opcional: solo el detalle de sesión lo pasa, para
 * mostrar el hueco contra la serie anterior (§4). El hueco es sólo el tiempo
 * («2:40»): sin la palabra «descanso», sin ícono y sin color por tiempo — el
 * comentario de `creado_en` en `types.ts` lo prohíbe.
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
    <div className="mt-2.5">
      {lines.map((line) => (
        <div key={line.setIndex} className="l-ln">
          <span className="l-ix">S{line.setIndex}</span>
          <span className="font-medium">
            {line.repsText}
            {line.total !== null && <span className="text-ink2 font-normal"> ({line.total})</span>}
          </span>
          {line.isBodyweight ? (
            <span className="l-s">peso corporal</span>
          ) : (
            <>
              <span className="text-ink3">×</span>
              <span>{line.weightText}</span>
            </>
          )}
          {line.esExtra && <Badge variant="secondary">extra</Badge>}
          {line.gap !== null && <span className="l-hueco">{formatGap(line.gap)}</span>}
        </div>
      ))}
    </div>
  );
}
