"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listActiveExercises, substituteExercise } from "@/lib/db/queries";
import type { SessionExerciseView } from "@/lib/db/queries";
import type { Exercise } from "@/lib/db/types";
import { unitSuffix } from "@/lib/units";

function unitTag(exercise: Exercise): string {
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
 * La sustitución no se escribe en ningún campo: cambiar el exercise_id de la
 * instancia ES la sustitución, y el badge se deriva de que ya no coincida con
 * el del slot (DECISIONES.md §3.2).
 *
 * Las alternativas del slot pueden tener unit_type distinto al del planeado —
 * Wide Grip Pull Down (LB) contra Wide Grip Pull Up (peso corporal + kg). Es
 * válido y esperado; por eso las alternativas son filas Exercise completas y no
 * un campo variante.
 */
export function SubstitutePicker({
  item,
  onDone,
}: {
  item: SessionExerciseView;
  onDone: () => void;
}) {
  const [filter, setFilter] = useState("");
  const catalog = useLiveQuery(() => listActiveExercises(), []);

  const pick = async (exerciseId: string) => {
    await substituteExercise(item.sessionExercise.id, exerciseId);
    onDone();
  };

  const needle = filter.trim().toLowerCase();
  const filtered = (catalog ?? []).filter(
    (e) => e.id !== item.exercise.id && e.nombre.toLowerCase().includes(needle),
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      {item.alternatives.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Alternativas del plan</Label>
          {item.alternatives
            .filter((alt) => alt.id !== item.exercise.id)
            .map((alt) => (
              <Button
                key={alt.id}
                variant="outline"
                className="h-auto justify-between py-2 text-left"
                onClick={() => void pick(alt.id)}
              >
                <span className="truncate">{alt.nombre}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{unitTag(alt)}</span>
              </Button>
            ))}
        </div>
      )}

      {item.isSubstitution && item.slotExercise && (
        <Button
          variant="ghost"
          className="h-auto justify-start py-2"
          onClick={() => void pick(item.slotExercise!.id)}
        >
          <RotateCcw /> Volver a {item.slotExercise.nombre}
        </Button>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filtro-catalogo">Cualquier ejercicio del catálogo</Label>
        <Input
          id="filtro-catalogo"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar…"
        />
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">Nada coincide.</p>
          ) : (
            filtered.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => void pick(exercise.id)}
                className="hover:bg-accent flex w-full items-center gap-2 border-b px-3 py-2.5 text-left last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{exercise.nombre}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{unitTag(exercise)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <Button variant="secondary" onClick={onDone}>
        <Check /> Listo
      </Button>
    </div>
  );
}
