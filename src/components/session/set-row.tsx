"use client";

import { useRef, useState } from "react";
import { TriangleAlert, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteSet, updateSet } from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";
import { hasWeightField, unitSuffix } from "@/lib/units";
import { useAutosave } from "@/lib/use-autosave";

function parseReps(value: string): number {
  const n = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseWeight(value: string): number | null {
  // La coma se normaliza a punto porque el teclado en español da coma.
  // Esto es separador decimal, no conversión de unidad: 37,5 y 37.5 son el
  // mismo número en la misma unidad.
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  if (cleaned === "") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Una fila = un SetLog. El componente se monta con key={set.id}, así que el
 * estado local nunca se pisa cuando el liveQuery refresca.
 *
 * Todo lo que se muestra sale del SNAPSHOT de la propia fila (weight_unit,
 * weight_basis, added_unit), nunca del Exercise actual. Si el ejercicio cambió
 * de unidad después, esta fila sigue diciendo lo que se hizo ese día.
 */
export function SetRow({ set, stackLabel }: { set: SetLog; stackLabel: string | null }) {
  const [reps, setReps] = useState(() => (set.reps === 0 ? "" : String(set.reps)));
  const [weight, setWeight] = useState(() =>
    set.weight_value === null ? "" : String(set.weight_value),
  );
  const pending = useRef<Partial<SetLog>>({});
  const { schedule, flush } = useAutosave();

  const commit = () => {
    const changes = pending.current;
    pending.current = {};
    if (Object.keys(changes).length > 0) void updateSet(set.id, changes);
  };

  const onReps = (value: string) => {
    setReps(value);
    pending.current.reps = parseReps(value);
    schedule(commit);
  };

  const onWeight = (value: string) => {
    setWeight(value);
    pending.current.weight_value = parseWeight(value);
    schedule(commit);
  };

  const showWeight = hasWeightField(set.weight_unit);
  const suffix = unitSuffix(set.weight_unit, set.weight_basis, set.added_unit, stackLabel);
  const isAdded = set.weight_unit === "BODYWEIGHT_PLUS";

  // §3: serie con reps y SIN peso en un ejercicio que sí requiere peso. Se marca
  // en vivo (estado local, no el persistido) para que te agarre frente a la
  // máquina. BODYWEIGHT nunca se marca: no tener peso es su estado correcto.
  const faltaPeso = showWeight && parseReps(reps) > 0 && parseWeight(weight) === null;

  return (
    <div className="flex items-center gap-2">
      {set.side && (
        <span className="bg-secondary text-secondary-foreground w-7 shrink-0 rounded-md py-1 text-center text-xs font-semibold">
          {set.side}
        </span>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Input
          value={reps}
          onChange={(e) => onReps(e.target.value)}
          onBlur={flush}
          inputMode="numeric"
          placeholder="0"
          aria-label="Repeticiones"
          className="w-full text-center"
        />
        <span className="text-muted-foreground shrink-0 text-xs">reps</span>
      </div>

      {showWeight ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isAdded && <span className="text-muted-foreground shrink-0 text-sm">+</span>}
          <Input
            value={weight}
            onChange={(e) => onWeight(e.target.value)}
            onBlur={flush}
            inputMode="decimal"
            placeholder="—"
            aria-label={isAdded ? "Peso añadido" : "Peso"}
            className="w-full text-center"
          />
          <span className="text-muted-foreground shrink-0 text-xs">{suffix}</span>
          {faltaPeso && (
            <TriangleAlert
              className="size-4 shrink-0 text-amber-500"
              aria-label="Serie con reps y sin peso"
            />
          )}
        </div>
      ) : (
        <div className="text-muted-foreground flex-1 text-center text-xs">peso corporal</div>
      )}

      {/* Borrado duro, sin modal (D8). Un log de gym no es un registro auditable. */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => void deleteSet(set.id)}
        aria-label="Borrar serie"
        className="text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
