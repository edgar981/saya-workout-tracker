"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { ExercisePicker } from "@/components/exercise-picker";
import { etiquetaUnidad, grupoDirecto } from "@/components/session/dial";
import { substituteExercise, type SessionExerciseView } from "@/lib/db/queries";

/**
 * La sustitución no se escribe en ningún campo: cambiar el exercise_id de la
 * instancia ES la sustitución, y el badge se deriva de que ya no coincida con
 * el del slot (DECISIONES.md §3.2).
 *
 * Las alternativas del slot pueden tener unit_type distinto al del planeado —
 * Wide Grip Pull Down (LB) contra Wide Grip Pull Up (peso corporal + kg).
 *
 * Va dentro de la hoja «Cambiar ejercicio» (`Panel`, la monta la pantalla). Tocar
 * una opción sustituye al momento y cierra; «Listo» sólo cierra la hoja.
 */
export function SubstitutePicker({
  item,
  enSesion,
  onDone,
}: {
  item: SessionExerciseView;
  /** Los ejercicios que ya están en la sesión: no se ofrecen. */
  enSesion: string[];
  onDone: () => void;
}) {
  const [filtro, setFiltro] = useState("");

  const pick = async (exerciseId: string) => {
    await substituteExercise(item.sessionExercise.id, exerciseId);
    onDone();
  };

  const alternativas = item.alternatives.filter((alt) => alt.id !== item.exercise.id);
  const volver = item.isSubstitution ? item.slotExercise : null;

  return (
    <div>
      {volver && (
        <div className="sec first">
          <div role="radiogroup" aria-label="Ejercicio en esta sesión">
            <button
              type="button"
              role="radio"
              aria-checked={false}
              className="row"
              onClick={() => void pick(volver.id)}
            >
              <span className="m">
                <span className="t">Volver a {volver.nombre}</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {alternativas.length > 0 && (
        <div className={volver ? "sec" : "sec first"}>
          <p className="kick">Alternativas del plan</p>
          {alternativas.map((alt) => (
            <button
              key={alt.id}
              type="button"
              className="row"
              onClick={() => void pick(alt.id)}
            >
              <span className="m">
                <span className="t">{alt.nombre}</span>
                <span className="s">
                  {etiquetaUnidad(alt)} · {grupoDirecto(alt)}
                </span>
              </span>
              <ChevronRight size={22} aria-hidden="true" style={{ color: "var(--ink3)" }} />
            </button>
          ))}
        </div>
      )}

      <div className={volver || alternativas.length > 0 ? "sec" : "sec first"}>
        <p className="kick">Cualquier ejercicio del catálogo</p>
        <input
          type="search"
          className="tin"
          style={{ marginTop: 10 }}
          placeholder="Buscar…"
          aria-label="Buscar en el catálogo"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <ExercisePicker
          variante="filas"
          sufijo="chevron"
          filtro={filtro}
          excludeIds={[...enSesion, ...alternativas.map((a) => a.id)]}
          onPick={(exercise) => void pick(exercise.id)}
        />
      </div>

      <div className="acts">
        <button type="button" className="btn2 w" onClick={onDone}>
          Listo
        </button>
      </div>
    </div>
  );
}
