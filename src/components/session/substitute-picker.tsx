"use client";

import { Check, RotateCcw } from "lucide-react";

import { ExercisePicker, unitTag } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { substituteExercise, type SessionExerciseView } from "@/lib/db/queries";

/**
 * La sustitución no se escribe en ningún campo: cambiar el exercise_id de la
 * instancia ES la sustitución, y el badge se deriva de que ya no coincida con
 * el del slot (DECISIONES.md §3.2).
 *
 * Las alternativas del slot pueden tener unit_type distinto al del planeado —
 * Wide Grip Pull Down (LB) contra Wide Grip Pull Up (peso corporal + kg).
 */
export function SubstitutePicker({
  item,
  onDone,
}: {
  item: SessionExerciseView;
  onDone: () => void;
}) {
  const pick = async (exerciseId: string) => {
    await substituteExercise(item.sessionExercise.id, exerciseId);
    onDone();
  };

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
        <Label htmlFor="filtro-sustitucion">Cualquier ejercicio del catálogo</Label>
        <ExercisePicker
          inputId="filtro-sustitucion"
          excludeIds={[item.exercise.id]}
          onPick={(exercise) => void pick(exercise.id)}
        />
      </div>

      <Button variant="secondary" onClick={onDone}>
        <Check /> Listo
      </Button>
    </div>
  );
}
