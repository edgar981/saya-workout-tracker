"use client";

import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Input } from "@/components/ui/input";
import { deleteSet, updateSet } from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";
import { hasWeightField, unitSuffix } from "@/lib/units";
import { repsPlaceholder } from "@/lib/reps-hint";
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
export function SetRow({
  set,
  stackLabel,
  refSets,
  puedeBorrar = false,
}: {
  set: SetLog;
  stackLabel: string | null;
  /** Series comparables de la vez pasada, para el placeholder de reps (§2). */
  refSets: SetLog[];
  /** El botón de borrar por fila: sólo en un grupo de más de una fila. */
  puedeBorrar?: boolean;
}) {
  const [reps, setReps] = useState(() => (set.reps === 0 ? "" : String(set.reps)));
  const [weight, setWeight] = useState(() =>
    set.weight_value === null ? "" : String(set.weight_value),
  );
  // Estado `error`: la escritura rechazó; el valor se queda en pantalla y se
  // puede repetir. Guarda qué campos fallaron para repetirlos con el valor de ahora.
  const [fallidos, setFallidos] = useState<("reps" | "weight_value")[]>([]);
  const pending = useRef<Partial<SetLog>>({});
  const { schedule, flush } = useAutosave();

  const escribir = (changes: Partial<SetLog>) => {
    const claves = Object.keys(changes) as ("reps" | "weight_value")[];
    updateSet(set.id, changes).then(
      () => setFallidos([]),
      () => setFallidos((prev) => [...new Set([...prev, ...claves])]),
    );
  };

  const commit = () => {
    const changes = pending.current;
    pending.current = {};
    if (Object.keys(changes).length > 0) escribir(changes);
  };

  const reintentar = () => {
    const changes: Partial<SetLog> = {};
    if (fallidos.includes("reps")) changes.reps = parseReps(reps);
    if (fallidos.includes("weight_value")) changes.weight_value = parseWeight(weight);
    escribir(changes);
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
  const n = set.set_index;

  // §3: serie con reps y SIN peso en un ejercicio que sí requiere peso. Se marca
  // en vivo (estado local, no el persistido) para que te agarre frente a la
  // máquina. BODYWEIGHT nunca se marca: no tener peso es su estado correcto.
  const faltaPeso = showWeight && parseReps(reps) > 0 && parseWeight(weight) === null;

  // Placeholder de reps: las de esta misma posición/lado la vez pasada (§2). Es
  // placeholder, no valor: si no se teclea, la serie queda con reps vacías. null
  // → sin dato comparable (sin registro previo o cambió la unidad); cae a "0".
  const phReps = repsPlaceholder(refSets, set);

  return (
    <div>
      <div className="campos">
        {set.side && <Badge className="shrink-0">{set.side}</Badge>}

        <Input
          variante="serie"
          unidad="reps"
          value={reps}
          onChange={(e) => onReps(e.target.value)}
          onBlur={flush}
          inputMode="numeric"
          placeholder={phReps !== null ? String(phReps) : "0"}
          aria-label={`Repeticiones serie ${n}`}
          className="flex-1"
        />

        {showWeight ? (
          <>
            <span className="por" aria-hidden="true">
              ×
            </span>
            <Input
              variante="serie"
              unidad={suffix}
              prefijo={isAdded ? "+" : undefined}
              value={weight}
              onChange={(e) => onWeight(e.target.value)}
              onBlur={flush}
              inputMode="decimal"
              placeholder="—"
              aria-label={`Peso serie ${n}`}
              className="flex-1"
            />
            {faltaPeso && (
              <span className="warn" role="img" aria-label="Falta el peso">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path className="fill-amber" d="M12 2.5 22.5 20.5h-21z" />
                  <path fill="#1A1200" d="M11 8.5h2v6.5h-2zM11 16.5h2v2h-2z" />
                </svg>
              </span>
            )}
          </>
        ) : (
          <span className="fila-s flex-1 text-center">peso corporal</span>
        )}

        {/* Borrado duro, sin modal (D8). Un log de gym no es un registro auditable. */}
        {puedeBorrar && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void deleteSet(set.id)}
            aria-label="Borrar serie"
            className="text-ink3 shrink-0 text-[22px]"
          >
            <span aria-hidden="true">×</span>
          </Button>
        )}
      </div>

      {fallidos.length > 0 && (
        <ErrorEnLinea className="mt-2">
          <p>No se pudo guardar la serie {n}. Sigue en pantalla.</p>
          <p className="err-s">Tus datos no se tocaron.</p>
          <Button variant="link" className="danger" onClick={reintentar}>
            Reintentar
          </Button>
        </ErrorEnLinea>
      )}
    </div>
  );
}
