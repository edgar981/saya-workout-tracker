"use client";

import { Plus, X } from "lucide-react";

import { SetRow } from "@/components/session/set-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addOppositeSide, addSegment, deleteSetGroup } from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";

/**
 * Un grupo = un `set_index`. Puede contener:
 *   - una fila (serie normal),
 *   - dos filas L y R (unilateral asimétrico: 6L/7R),
 *   - N filas con segment_index 0..n-1 (giant set).
 *
 * Seis segmentos son UNA serie con seis tramos, no seis series
 * (DECISIONES.md §3.2). De ahí que el botón diga "segmento" y no "serie".
 */
export function SetGroup({
  sessionExerciseId,
  setIndex,
  sets,
  stackLabel,
}: {
  sessionExerciseId: string;
  setIndex: number;
  sets: SetLog[];
  stackLabel: string | null;
}) {
  const segments = new Set(sets.map((s) => s.segment_index));
  const isGiant = segments.size > 1;
  const esExtra = sets.some((s) => s.es_extra);

  // Serie unilateral con un solo lado: se puede agregar el opuesto (heredando
  // el peso). No aplica a bilaterales (sin lado), ni a giant sets, ni cuando ya
  // están los dos lados.
  const sidesPresent = new Set(sets.map((s) => s.side).filter((x): x is "L" | "R" => x !== null));
  const missingSide = !isGiant && sidesPresent.size === 1 ? (sidesPresent.has("L") ? "R" : "L") : null;

  return (
    <div className="rounded-lg border p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold">Serie {setIndex}</span>
        {esExtra && (
          <Badge variant="secondary" className="text-[10px]">
            extra
          </Badge>
        )}
        {isGiant && (
          <Badge variant="outline" className="text-[10px]">
            giant set · {segments.size} segmentos
          </Badge>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void deleteSetGroup(sessionExerciseId, setIndex)}
          aria-label={`Borrar serie ${setIndex} completa`}
          className="text-muted-foreground hover:text-destructive"
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {sets.map((set) => (
          <div key={set.id} className="flex items-center gap-2">
            {isGiant && (
              <span className="text-muted-foreground w-5 shrink-0 text-center text-xs tabular-nums">
                {set.segment_index + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <SetRow set={set} stackLabel={stackLabel} />
            </div>
          </div>
        ))}
      </div>

      {missingSide && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void addOppositeSide(sessionExerciseId, setIndex)}
          className="mt-2 h-8 w-full"
        >
          <Plus /> Agregar lado {missingSide === "L" ? "izquierdo" : "derecho"}
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => void addSegment(sessionExerciseId, setIndex)}
        className="text-muted-foreground mt-2 h-8 w-full"
      >
        <Plus /> Agregar segmento
      </Button>
    </div>
  );
}
