"use client";

import { ExercisePicker, unitTag } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { substituteExercise, type SessionExerciseView } from "@/lib/db/queries";
import type { Exercise } from "@/lib/db/types";

/**
 * La sustitución no se escribe en ningún campo: cambiar el exercise_id de la
 * instancia ES la sustitución, y el badge se deriva de que ya no coincida con
 * el del slot (DECISIONES.md §3.2).
 *
 * Las alternativas del slot pueden tener unit_type distinto al del planeado —
 * Wide Grip Pull Down (LB) contra Wide Grip Pull Up (peso corporal + kg).
 *
 * Va dentro del panel «Cambiar ejercicio» (`Panel`, lo monta la tarjeta). Tocar
 * una opción sustituye al momento; «Listo» sólo cierra el panel.
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

  const alternativas = item.alternatives.filter((alt) => alt.id !== item.exercise.id);

  const opcion = (exercise: Exercise, marcada: boolean, onClick: () => void) => (
    <button
      key={exercise.id}
      type="button"
      role="radio"
      aria-checked={marcada}
      onClick={onClick}
      className="opt"
    >
      <span className="rd" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="fila-t block truncate">{exercise.nombre}</span>
        <span className="fila-s block">{unitTag(exercise)}</span>
      </span>
    </button>
  );

  return (
    <div>
      <p className="dek">
        Solo en esta sesión. Las series que ya registraste quedan con este ejercicio.
      </p>

      <div role="radiogroup" className="mt-3">
        {opcion(item.exercise, true, () => {})}
        {item.isSubstitution && item.slotExercise && (
          <button
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => void pick(item.slotExercise!.id)}
            className="opt"
          >
            <span className="rd" aria-hidden="true" />
            <span className="fila-t min-w-0 flex-1 truncate">
              Volver a {item.slotExercise.nombre}
            </span>
          </button>
        )}
      </div>

      <div className="fg">
        <h3 className="kicker">Alternativas del plan</h3>
        {alternativas.length > 0 ? (
          <div role="radiogroup" aria-label="Alternativas del plan" className="mt-1">
            {alternativas.map((alt) => opcion(alt, false, () => void pick(alt.id)))}
          </div>
        ) : (
          <p className="dek mt-1.5">Este ejercicio no tiene alternativas en la plantilla.</p>
        )}
      </div>

      <div className="fg">
        <label htmlFor="filtro-sustitucion" className="kicker block">
          Cualquier ejercicio del catálogo
        </label>
        <ExercisePicker
          inputId="filtro-sustitucion"
          excludeIds={[item.exercise.id]}
          onPick={(exercise) => void pick(exercise.id)}
          className="mt-2"
        />
      </div>

      <Button className="mt-6 w-full" onClick={onDone}>
        Listo
      </Button>
    </div>
  );
}
