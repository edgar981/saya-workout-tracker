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
  refSets,
}: {
  sessionExerciseId: string;
  setIndex: number;
  sets: SetLog[];
  stackLabel: string | null;
  /** Series de la vez pasada (comparables), para el placeholder de reps (§2). */
  refSets: SetLog[];
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
    <div className="bg-surface overflow-hidden rounded-xl border">
      {/* Franja de encabezado (v2): rótulo de la serie, badges de estado y el
          borrado sin guarda (D8) de la serie completa. */}
      <div className="bg-surface-2 flex items-center gap-2 px-3 py-2">
        <span className="text-muted-foreground font-mono text-[11px] font-semibold tracking-wide">
          SERIE {setIndex}
        </span>
        {esExtra && (
          <Badge variant="secondary" className="text-[10px]">
            extra
          </Badge>
        )}
        {isGiant && (
          <Badge variant="outline" className="text-[10px]">
            giant · {segments.size}
          </Badge>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void deleteSetGroup(sessionExerciseId, setIndex)}
          aria-label={`Borrar serie ${setIndex} completa`}
          className="text-muted-foreground hover:text-destructive -mr-1"
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {sets.map((set) => (
          <div key={set.id} className="flex items-center gap-2">
            {isGiant && (
              <span className="text-muted-foreground w-5 shrink-0 text-center font-mono text-xs tabular-nums">
                {set.segment_index + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <SetRow set={set} stackLabel={stackLabel} refSets={refSets} />
            </div>
          </div>
        ))}
      </div>

      {/* Serie unilateral con un solo lado: la fila para agregar el opuesto va en
          acento (es un prompt de completar, hereda el peso). Reemplaza al botón
          genérico anterior (§2). */}
      {missingSide && (
        <button
          type="button"
          onClick={() => void addOppositeSide(sessionExerciseId, setIndex)}
          className="text-primary flex w-full items-center justify-center gap-1.5 border-t border-dashed py-2.5 text-xs font-semibold"
        >
          <Plus className="size-3.5" /> Falta el lado {missingSide === "L" ? "izquierdo" : "derecho"}
        </button>
      )}

      <button
        type="button"
        onClick={() => void addSegment(sessionExerciseId, setIndex)}
        className="text-muted-foreground flex w-full items-center justify-center gap-1.5 border-t py-2 text-xs font-medium"
      >
        <Plus className="size-3.5" /> Agregar segmento
      </button>
    </div>
  );
}
