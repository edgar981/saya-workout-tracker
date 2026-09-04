"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronLeft, Plus, Trash2, X } from "lucide-react";

import { ExercisePicker, unitTag } from "@/components/exercise-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db/db";
import {
  addSlot,
  addSlotAlternative,
  loadDaySlots,
  moveSlot,
  removeSlotAlternative,
  softDeleteSlot,
  updateSlotTargets,
  type SlotView,
} from "@/lib/db/queries";
import { useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

const ARMED_MS = 5000;

/**
 * Detalle de un día. Antes vivía en `useState` dentro de PlantillasScreen; ahora
 * es su propia ruta (/plantillas/[dayId]) para que el gesto atrás vuelva a la
 * lista de días en vez de salir de plantillas. El `dayId` sale de la URL.
 */
export default function PlantillaDiaScreen() {
  const params = useParams<{ dayId: string }>();
  const dayId = params.dayId;
  const [showPicker, setShowPicker] = useState(false);

  const day = useLiveQuery(() => db.routineDays.get(dayId), [dayId]);
  const slots = useLiveQuery(() => loadDaySlots(dayId), [dayId]);

  if (slots === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Cargando…</p>;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/plantillas" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">{day?.nombre ?? "Día"}</h1>
        <span className="text-muted-foreground ml-auto text-xs">{slots.length} ejercicios</span>
      </header>

      <div className="flex flex-col gap-2">
        {slots.map((view, i) => (
          <SlotFila
            key={view.slot.id}
            view={view}
            dayId={dayId}
            esPrimero={i === 0}
            esUltimo={i === slots.length - 1}
          />
        ))}
      </div>

      {showPicker ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="filtro-nuevo-slot">Agregar ejercicio al día</Label>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              onClick={() => setShowPicker(false)}
              aria-label="Cerrar"
            >
              <X />
            </Button>
          </div>
          <ExercisePicker
            inputId="filtro-nuevo-slot"
            onPick={async (exercise) => {
              await addSlot(dayId, exercise.id);
              setShowPicker(false);
            }}
          />
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowPicker(true)}>
          <Plus /> Agregar ejercicio
        </Button>
      )}
    </main>
  );
}

function SlotFila({
  view,
  dayId,
  esPrimero,
  esUltimo,
}: {
  view: SlotView;
  dayId: string;
  esPrimero: boolean;
  esUltimo: boolean;
}) {
  const { slot, exercise, alternatives } = view;
  const [sets, setSets] = useState(slot.target_sets === null ? "" : String(slot.target_sets));
  const [reps, setReps] = useState(slot.target_reps === null ? "" : String(slot.target_reps));
  const [abierto, setAbierto] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const [armed, setArmed] = useState(false);
  const pendiente = useRef({ sets, reps });
  const { schedule, flush } = useAutosave();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

  // Autosave, como en el resto de la app: no hay botón de guardar en ninguna
  // pantalla. Confiar solo en el blur pierde lo tecleado si sales con el gesto
  // de atrás, que no dispara focusout.
  const guardarObjetivos = () => {
    const n = (v: string) => {
      const parsed = Number.parseInt(v.replace(/\D/g, ""), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    const { sets: s, reps: r } = pendiente.current;
    void updateSlotTargets(slot.id, n(s), n(r));
  };

  const onSets = (v: string) => {
    setSets(v);
    pendiente.current = { ...pendiente.current, sets: v };
    schedule(guardarObjetivos);
  };

  const onReps = (v: string) => {
    setReps(v);
    pendiente.current = { ...pendiente.current, reps: v };
    schedule(guardarObjetivos);
  };

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-1 p-2">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={esPrimero}
            onClick={() => void moveSlot(dayId, slot.id, -1)}
            aria-label="Subir"
            className="h-6"
          >
            <ChevronDown className="rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={esUltimo}
            onClick={() => void moveSlot(dayId, slot.id, 1)}
            aria-label="Bajar"
            className="h-6"
          >
            <ChevronDown />
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-sm font-medium">
            {exercise?.nombre ?? "— ejercicio no encontrado —"}
          </span>
          <span className="text-muted-foreground text-xs">
            {exercise ? unitTag(exercise) : ""}
            {slot.target_sets !== null && slot.target_reps !== null
              ? ` · objetivo ${slot.target_sets} × ${slot.target_reps}`
              : " · sin objetivo"}
            {alternatives.length > 0 ? ` · ${alternatives.length} alt` : ""}
          </span>
        </button>

        <ChevronDown className={cn("text-muted-foreground size-4", abierto && "rotate-180")} />
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 border-t p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor={`sets-${slot.id}`}>Series objetivo</Label>
              <Input
                id={`sets-${slot.id}`}
                value={sets}
                onChange={(e) => onSets(e.target.value)}
                onBlur={flush}
                inputMode="numeric"
                placeholder="—"
                className="mt-1 text-center"
              />
            </div>
            <span className="text-muted-foreground pb-3">×</span>
            <div className="flex-1">
              <Label htmlFor={`reps-${slot.id}`}>Reps objetivo</Label>
              <Input
                id={`reps-${slot.id}`}
                value={reps}
                onChange={(e) => onReps(e.target.value)}
                onBlur={flush}
                inputMode="numeric"
                placeholder="—"
                className="mt-1 text-center"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Alternativas</Label>
            <div className="flex flex-wrap gap-1.5">
              {alternatives.length === 0 && (
                <span className="text-muted-foreground text-xs">Ninguna declarada.</span>
              )}
              {alternatives.map((alt) => (
                <Badge key={alt.id} variant="secondary" className="gap-1 py-1">
                  {alt.nombre}
                  <button
                    type="button"
                    onClick={() => void removeSlotAlternative(slot.id, alt.id)}
                    aria-label={`Quitar ${alt.nombre}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {showAlt ? (
              <ExercisePicker
                inputId={`alt-${slot.id}`}
                excludeIds={[slot.exercise_id, ...alternatives.map((a) => a.id)]}
                onPick={async (exercise) => {
                  await addSlotAlternative(slot.id, exercise.id);
                  setShowAlt(false);
                }}
              />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAlt(true)} className="self-start">
                <Plus /> Alternativa
              </Button>
            )}
          </div>

          {/* Borrado SUAVE. Duro dejaría colgando SessionExercise.routine_slot_id
              y las sesiones viejas perderían el badge de sustitución. */}
          <Button
            variant={armed ? "destructive" : "ghost"}
            size="sm"
            className={armed ? "" : "text-muted-foreground"}
            onClick={() => (armed ? void softDeleteSlot(slot.id) : setArmed(true))}
          >
            <Trash2 />
            {armed ? "Tocar de nuevo para dar de baja" : "Quitar del día"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Se da de baja, no se borra: el histórico sigue apuntando a este slot para explicar las
            sustituciones que registraste.
          </p>
        </div>
      )}
    </div>
  );
}
