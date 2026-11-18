"use client";

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
    <div className="set">
      {/* Cabecera: «Serie N» (y « · extra»), el badge de giant y el borrado sin
          guarda (D8) de la serie completa. */}
      <div className="set-cab">
        <div className="flex items-center gap-2">
          <h3 className="kicker">
            Serie {setIndex}
            {esExtra && " · extra"}
          </h3>
          {isGiant && <Badge>giant · {segments.size}</Badge>}
        </div>
        <button
          type="button"
          className="set-x"
          onClick={() => void deleteSetGroup(sessionExerciseId, setIndex)}
          aria-label={`Borrar serie ${setIndex}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {sets.map((set) => (
        <div key={set.id} className="flex items-center gap-2">
          {isGiant && (
            <span className="fila-s w-5 shrink-0 text-center tabular-nums">
              {set.segment_index + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <SetRow
              set={set}
              stackLabel={stackLabel}
              refSets={refSets}
              puedeBorrar={sets.length > 1}
            />
          </div>
        </div>
      ))}

      {/* Serie unilateral con un solo lado: el enlace para agregar el opuesto
          (hereda el peso). */}
      {missingSide && (
        <Button
          variant="link"
          onClick={() => void addOppositeSide(sessionExerciseId, setIndex)}
        >
          Falta el lado {missingSide === "L" ? "izquierdo" : "derecho"}
        </Button>
      )}

      <Button variant="link" onClick={() => void addSegment(sessionExerciseId, setIndex)}>
        Agregar segmento
      </Button>
    </div>
  );
}
