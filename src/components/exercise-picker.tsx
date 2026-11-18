"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Input } from "@/components/ui/input";
import { listActiveExercises } from "@/lib/db/queries";
import type { Exercise } from "@/lib/db/types";
import { unitSuffix } from "@/lib/units";
import { cn } from "@/lib/utils";

/** Etiqueta corta de unidad, para no elegir a ciegas en el picker. */
export function unitTag(exercise: Exercise): string {
  if (exercise.unit_type === "BODYWEIGHT") return "peso corporal";
  if (exercise.unit_type === "BODYWEIGHT_PLUS")
    return `+${unitSuffix(exercise.unit_type, exercise.weight_basis, exercise.added_unit)}`;
  return unitSuffix(
    exercise.unit_type,
    exercise.weight_basis,
    exercise.added_unit,
    exercise.stack_label,
  );
}

/**
 * Picker del catálogo activo. NO permite crear ejercicios: fijar unit_type,
 * weight_basis y added_unit es una decisión que se snapshotea en cada serie y
 * queda para siempre — `Incline DB Press (suma)` es el resultado de decidir eso
 * rápido. Se hace en frío, en /catalogo.
 */
export function ExercisePicker({
  excludeIds = [],
  onPick,
  inputId = "filtro-catalogo",
  placeholder = "Buscar…",
  className,
}: {
  excludeIds?: string[];
  onPick: (exercise: Exercise) => void;
  inputId?: string;
  placeholder?: string;
  className?: string;
}) {
  const [filter, setFilter] = useState("");
  const catalog = useLiveQuery(() => listActiveExercises(), []);

  const needle = filter.trim().toLowerCase();
  const filtered = (catalog ?? []).filter(
    (e) => !excludeIds.includes(e.id) && e.nombre.toLowerCase().includes(needle),
  );

  return (
    <div className={cn("flex flex-col", className)}>
      <Input
        id={inputId}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={placeholder}
      />
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="dek mt-3">Nada coincide.</p>
        ) : (
          filtered.map((exercise) => (
            <button key={exercise.id} type="button" onClick={() => onPick(exercise)} className="opt">
              <span className="min-w-0 flex-1">
                <span className="fila-t block truncate">{exercise.nombre}</span>
                <span className="fila-s block">{unitTag(exercise)}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
