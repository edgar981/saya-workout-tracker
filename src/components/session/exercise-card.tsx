"use client";

import { useRef, useState } from "react";
import { ChevronDown, MessageSquare, Plus, Repeat } from "lucide-react";

import { LastPerformance } from "@/components/session/last-performance";
import { SetGroup } from "@/components/session/set-group";
import { SubstitutePicker } from "@/components/session/substitute-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addSet, updateSessionExerciseNote, type SessionExerciseView } from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";
import { useAutosave } from "@/lib/use-autosave";

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
  const pendingNote = useRef<string | null>(null);
  const { schedule, flush } = useAutosave();

  const groups = groupBySetIndex(item.sets);
  const { exercise, slot } = item;

  const commitNote = () => {
    const value = pendingNote.current;
    pendingNote.current = null;
    if (value !== null) {
      void updateSessionExerciseNote(item.sessionExercise.id, value.trim() === "" ? null : value);
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
          {/* Derivado, no almacenado: el slot planeaba otra cosa. */}
          {item.isSubstitution && item.slotExercise && (
            <Badge variant="secondary">sustituye a {item.slotExercise.nombre}</Badge>
          )}
          {/* target_sets/target_reps vienen null del seed: DECISIONES.md §4 no
              registra los objetivos por ejercicio y no se inventan. */}
          {slot?.target_sets !== null && slot?.target_reps !== null && slot && (
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
        <p className="text-muted-foreground py-2 text-sm">
          Sin series todavía.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(([setIndex, sets]) => (
            <SetGroup
              key={setIndex}
              sessionExerciseId={item.sessionExercise.id}
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
          onClick={() => void addSet(item.sessionExercise.id, { esExtra: false, side: "AUTO" })}
        >
          <Plus /> Serie
        </Button>
        <Button variant="outline" onClick={() => setShowExtra((v) => !v)}>
          <Plus /> Extra
        </Button>
      </div>

      {showExtra && (
        <div className="flex gap-2 rounded-lg border p-2">
          {/* Serie fuera de plantilla. El lado es explícito porque el caso real
              (`4L`) es exactamente ese: unas repes extra de un solo lado. */}
          {(["AUTO", "L", "R"] as const).map((side) => (
            <Button
              key={side}
              variant="secondary"
              className="flex-1"
              onClick={() => {
                void addSet(item.sessionExercise.id, { esExtra: true, side });
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
    </div>
  );
}
