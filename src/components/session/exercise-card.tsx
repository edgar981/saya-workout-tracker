"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MessageSquare, Plus, Repeat, Trash2 } from "lucide-react";

import { LastPerformance } from "@/components/session/last-performance";
import { SetGroup } from "@/components/session/set-group";
import { SubstitutePicker } from "@/components/session/substitute-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addSet,
  deleteSessionExercise,
  updateSessionExerciseNote,
  type SessionExerciseView,
} from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";
import { useAutosave } from "@/lib/use-autosave";

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

export function ExerciseCard({
  item,
  sessionId,
}: {
  item: SessionExerciseView;
  sessionId: string;
}) {
  const [showSubstitute, setShowSubstitute] = useState(false);
  const [showNote, setShowNote] = useState(!!item.sessionExercise.nota);
  const [showExtra, setShowExtra] = useState(false);
  const [note, setNote] = useState(item.sessionExercise.nota ?? "");
  const [armed, setArmed] = useState(false);
  const pendingNote = useRef<string | null>(null);
  const { schedule, flush } = useAutosave();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-xl leading-tight font-semibold">{exercise.nombre}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSubstitute((v) => !v)}
            className="text-muted-foreground shrink-0"
          >
            <Repeat /> Cambiar
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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
      </div>

      {showSubstitute && (
        <SubstitutePicker item={item} onDone={() => setShowSubstitute(false)} />
      )}

      <LastPerformance
        exerciseId={exercise.id}
        sessionId={sessionId}
        stackLabel={exercise.stack_label}
      />

      {groups.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">Sin series todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(([setIndex, sets]) => (
            <SetGroup
              key={setIndex}
              sessionExerciseId={sessionExercise.id}
              setIndex={setIndex}
              sets={sets}
              stackLabel={exercise.stack_label}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => void addSet(sessionExercise.id, { esExtra: false, side: "AUTO" })}
        >
          <Plus /> Serie
        </Button>
        <Button variant="outline" onClick={() => setShowExtra((v) => !v)}>
          <Plus /> Extra
        </Button>
      </div>

      {showExtra && (
        <div className="flex gap-2 rounded-lg border p-2">
          {(["AUTO", "L", "R"] as const).map((side) => (
            <Button
              key={side}
              variant="secondary"
              className="flex-1"
              onClick={() => {
                void addSet(sessionExercise.id, { esExtra: true, side });
                setShowExtra(false);
              }}
            >
              {side === "AUTO" ? "Ambos" : side === "L" ? "Izquierdo" : "Derecho"}
            </Button>
          ))}
        </div>
      )}

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNote((v) => !v)}
          className="text-muted-foreground w-full justify-start"
        >
          <MessageSquare /> Nota del ejercicio
          <ChevronDown className={showNote ? "ml-auto rotate-180" : "ml-auto"} />
        </Button>
        {showNote && (
          <Textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            onBlur={flush}
            placeholder="Máquina distinta, molestia, agarre…"
            className="mt-2"
          />
        )}
      </div>

      {/* Borra la instancia y sus series en una sola transacción. Sin cascada
          en Dexie, borrar solo la instancia dejaría SetLog huérfanos que la
          verificación de conteos del import no vería. Guarda de doble toque. */}
      <Button
        variant={armed ? "destructive" : "ghost"}
        size="sm"
        className={armed ? "" : "text-muted-foreground"}
        onClick={() => (armed ? void deleteSessionExercise(sessionExercise.id) : setArmed(true))}
      >
        <Trash2 />
        {armed
          ? `Tocar de nuevo: borra ${item.sets.length} series`
          : "Quitar de la sesión"}
      </Button>
    </div>
  );
}
