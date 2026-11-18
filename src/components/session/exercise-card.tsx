"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { unitTag } from "@/components/exercise-picker";
import { LastPerformance } from "@/components/session/last-performance";
import { SetGroup } from "@/components/session/set-group";
import { SubstitutePicker } from "@/components/session/substitute-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Panel } from "@/components/ui/panel";
import { Pildora } from "@/components/ui/pildora";
import {
  addSet,
  deleteSessionExercise,
  getLastPerformance,
  updateSessionExerciseNote,
  type SessionExerciseView,
} from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";
import { useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

const ARMED_MS = 5000;

function groupBySetIndex(sets: SetLog[]): [number, SetLog[]][] {
  const groups = new Map<number, SetLog[]>();
  for (const set of sets) {
    const list = groups.get(set.set_index) ?? [];
    list.push(set);
    groups.set(set.set_index, list);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

type OpcionesSerie = Parameters<typeof addSet>[1];

export function ExerciseCard({
  item,
  sessionId,
  posicion,
  total,
}: {
  item: SessionExerciseView;
  sessionId: string;
  /** Posición (1-based) del ejercicio en la sesión, para el kicker. */
  posicion: number;
  total: number;
}) {
  const [showSubstitute, setShowSubstitute] = useState(false);
  const [showNote, setShowNote] = useState(!!item.sessionExercise.nota);
  const [showExtra, setShowExtra] = useState(false);
  const [note, setNote] = useState(item.sessionExercise.nota ?? "");
  const [armed, setArmed] = useState(false);
  // Estado `error` de «Nueva serie» / «Extra»: la llamada que falló, para repetirla.
  const [fallo, setFallo] = useState<OpcionesSerie | null>(null);
  const pendingNote = useRef<string | null>(null);
  const { schedule, flush } = useAutosave();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

  // Última aparición del ejercicio: la MISMA fuente que ya alimenta la precarga
  // de peso (getLastPerformance → getPerformanceHistory, la única travesía). Se
  // carga una vez aquí y se reusa para «La pasada» y para los placeholders de
  // reps (§2 / criterio 11).
  const anterior = useLiveQuery(
    () => getLastPerformance(item.exercise.id, sessionId),
    [item.exercise.id, sessionId],
  );
  const prevSets = anterior?.sets ?? [];
  // §3.5: la aparición anterior seed la captura solo si su snapshot de unidad
  // coincide con el ejercicio de hoy. Si cambió, no hay placeholder y se avisa.
  const comparable =
    prevSets.length > 0 &&
    prevSets[0].weight_unit === item.exercise.unit_type &&
    prevSets[0].weight_basis === item.exercise.weight_basis;
  const unidadCambio = anterior != null && !comparable;
  const refSets = comparable ? prevSets : [];

  const groups = groupBySetIndex(item.sets);
  const { exercise, slot, sessionExercise } = item;

  const commitNote = () => {
    const value = pendingNote.current;
    pendingNote.current = null;
    if (value !== null) {
      void updateSessionExerciseNote(sessionExercise.id, value.trim() === "" ? null : value);
    }
  };

  const onNote = (value: string) => {
    setNote(value);
    pendingNote.current = value;
    schedule(commitNote);
  };

  // La misma `addSet` de siempre, con los mismos argumentos; sólo se atrapa su
  // rechazo para mostrarlo.
  const agregarSerie = (opciones: OpcionesSerie) => {
    addSet(sessionExercise.id, opciones).then(
      () => setFallo(null),
      () => setFallo(opciones),
    );
  };

  return (
    <div>
      <p className="kicker mt-[18px]">
        Ejercicio {posicion} de {total} · {unitTag(exercise)}
      </p>
      <div className="mt-2 flex items-start justify-between gap-2.5">
        <h2 className="tit-2 min-w-0 leading-tight">{exercise.nombre}</h2>
        <Button variant="link" onClick={() => setShowSubstitute(true)} className="shrink-0">
          Cambiar
        </Button>
      </div>

      <div className="badges">
        {item.isSubstitution && item.slotExercise && (
          <Badge variant="secondary">sustituye a {item.slotExercise.nombre}</Badge>
        )}
        {item.isAdHoc && <Badge variant="outline">fuera de plantilla</Badge>}
        {/* Derivado, nunca editable. Se muestra para que la secuencia real sea
            legible sin reacomodar la lista. */}
        {sessionExercise.orden_ejecucion !== null && (
          <Badge variant="outline" className="tabular-nums">
            ejecutado {sessionExercise.orden_ejecucion}º
          </Badge>
        )}
        {slot && slot.target_sets !== null && slot.target_reps !== null && (
          <Badge variant="outline">
            objetivo {slot.target_sets} × {slot.target_reps}
          </Badge>
        )}
      </div>

      <Panel
        abierto={showSubstitute}
        alCerrar={() => setShowSubstitute(false)}
        titulo="Cambiar ejercicio"
      >
        <SubstitutePicker item={item} onDone={() => setShowSubstitute(false)} />
      </Panel>

      <LastPerformance
        exerciseId={exercise.id}
        stackLabel={exercise.stack_label}
        last={anterior}
      />

      {/* §3: hay historial pero no comparable (cambió la unidad). Se avisa y no
          se propone placeholder de reps de la aparición vieja (§3.5). */}
      {unidadCambio && (
        <p className="fila-s mt-2">
          La unidad cambió desde la última vez. No se compara ni se propone.
        </p>
      )}

      <section className="sets">
        <h3 className="kicker">Hoy</h3>
        {groups.length === 0 ? (
          <p className="dek mt-1.5">Sin series todavía.</p>
        ) : (
          groups.map(([setIndex, sets]) => (
            <SetGroup
              key={setIndex}
              sessionExerciseId={sessionExercise.id}
              setIndex={setIndex}
              sets={sets}
              stackLabel={exercise.stack_label}
              refSets={refSets}
            />
          ))
        )}
      </section>

      {fallo && (
        <ErrorEnLinea className="mt-3">
          <p>No se pudo guardar la serie {groups.length + 1}. Sigue en pantalla.</p>
          <p className="err-s">Tus datos no se tocaron.</p>
          <Button variant="link" className="danger" onClick={() => agregarSerie(fallo)}>
            Reintentar
          </Button>
        </ErrorEnLinea>
      )}

      <div className="mt-[18px] flex w-full gap-2.5">
        <Button className="flex-1" onClick={() => agregarSerie({ esExtra: false, side: "AUTO" })}>
          {/* "Nueva serie" cuando aún no hay ninguna; "Otra" a partir de la segunda. */}
          {groups.length === 0 ? "Nueva serie" : "Otra serie"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            // Unilateral: elegir con qué lado empieza la extra (el opuesto se
            // agrega después). Bilateral: agrega una fila directo, sin menú.
            if (exercise.laterality_default === "UNILATERAL") setShowExtra((v) => !v);
            else agregarSerie({ esExtra: true, side: "AUTO" });
          }}
        >
          + Extra
        </Button>
      </div>

      {showExtra && exercise.laterality_default === "UNILATERAL" && (
        <div className="mt-3 flex gap-2">
          {(["L", "R"] as const).map((side) => (
            <Pildora
              key={side}
              onClick={() => {
                agregarSerie({ esExtra: true, side });
                setShowExtra(false);
              }}
            >
              {side === "L" ? "Izquierdo" : "Derecho"}
            </Pildora>
          ))}
        </div>
      )}

      <div className="mt-2">
        <Button variant="link" aria-expanded={showNote} onClick={() => setShowNote((v) => !v)}>
          Nota del ejercicio
          <span
            aria-hidden="true"
            className={cn(
              "inline-block transition-transform duration-200 motion-reduce:transition-none",
              showNote && "rotate-180",
            )}
          >
            ▾
          </span>
        </Button>
        {showNote && (
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            onBlur={flush}
            placeholder="Máquina distinta, molestia, agarre…"
            aria-label="Nota del ejercicio"
            className="nota"
          />
        )}
      </div>

      {/* Borra la instancia y sus series en una sola transacción. Sin cascada
          en Dexie, borrar solo la instancia dejaría SetLog huérfanos que la
          verificación de conteos del import no vería. Guarda de doble toque. */}
      <div>
        <Button
          variant="link"
          className="danger"
          onClick={() => (armed ? void deleteSessionExercise(sessionExercise.id) : setArmed(true))}
        >
          {armed ? `Tocar de nuevo: borra ${item.sets.length} series` : "Quitar de la sesión"}
        </Button>
      </div>
    </div>
  );
}
