"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Input } from "@/components/ui/input";
import { listActiveExercises } from "@/lib/db/queries";
import type { Exercise } from "@/lib/db/types";
import { unitSuffix } from "@/lib/units";

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
}: {
  excludeIds?: string[];
  onPick: (exercise: Exercise) => void;
  inputId?: string;
  placeholder?: string;
}) {
  const [filter, setFilter] = useState("");
  const catalog = useLiveQuery(() => listActiveExercises(), []);

  const needle = filter.trim().toLowerCase();
  const filtered = (catalog ?? []).filter(
    (e) => !excludeIds.includes(e.id) && e.nombre.toLowerCase().includes(needle),
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={inputId}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={placeholder}
      />
      <div className="max-h-64 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">Nada coincide.</p>
        ) : (
          filtered.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => onPick(exercise)}
              className="hover:bg-accent flex w-full items-center gap-2 border-b px-3 py-2.5 text-left last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{exercise.nombre}</span>
              <span className="text-muted-foreground shrink-0 text-xs">{unitTag(exercise)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
