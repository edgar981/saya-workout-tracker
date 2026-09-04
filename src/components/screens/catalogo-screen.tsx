"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronLeft, Lock, Plus, Trash2 } from "lucide-react";

import { unitTag } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countSetLogsForExercise,
  listActiveExercises,
  renameExercise,
  softDeleteExercise,
  updateExerciseUnits,
} from "@/lib/db/queries";
import type { Exercise, UnitType } from "@/lib/db/types";
import { UNIDADES, usaAddedUnit, usaBasis, usaStackLabel } from "@/lib/catalogo-units";
import { useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

const ARMED_MS = 5000;

export default function CatalogoScreen() {
  const exercises = useLiveQuery(() => listActiveExercises(), []);

  if (exercises === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Cargando…</p>;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Catálogo</h1>
        <span className="text-muted-foreground ml-auto text-xs">{exercises.length} activos</span>
      </header>

      {/* Crear ejercicio reemplaza la pantalla con un formulario completo, así que
          es ruta propia (/catalogo/nuevo): el gesto atrás vuelve aquí en vez de
          colapsar un panel. Expandir una fila, en cambio, se queda en estado. */}
      <Button asChild variant="outline">
        <Link href="/catalogo/nuevo">
          <Plus /> Crear ejercicio
        </Link>
      </Button>

      <div className="flex flex-col gap-2">
        {exercises.map((exercise) => (
          <FilaEjercicio key={exercise.id} exercise={exercise} />
        ))}
      </div>
    </main>
  );
}

function FilaEjercicio({ exercise }: { exercise: Exercise }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(exercise.nombre);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendiente = useRef(exercise.nombre);
  const { schedule, flush } = useAutosave();

  const series = useLiveQuery(() => countSetLogsForExercise(exercise.id), [exercise.id]);
  const bloqueado = (series ?? 0) > 0;

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const cambiarUnidad = async (unitType: UnitType) => {
    setError(null);
    try {
      await updateExerciseUnits(exercise.id, {
        unit_type: unitType,
        weight_basis: usaBasis(unitType) ? (exercise.weight_basis ?? "TOTAL") : null,
        added_unit: usaAddedUnit(unitType) ? (exercise.added_unit ?? "KG") : null,
        stack_label: usaStackLabel(unitType) ? (exercise.stack_label ?? "disc") : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la unidad.");
    }
  };

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{exercise.nombre}</span>
          <span className="text-muted-foreground text-xs">
            {unitTag(exercise)}
            {exercise.laterality_default === "UNILATERAL" ? " · unilateral" : ""}
            {series !== undefined ? ` · ${series} series` : ""}
          </span>
        </span>
        <ChevronDown className={cn("text-muted-foreground size-4", abierto && "rotate-180")} />
      </button>

      {abierto && (
        <div className="flex flex-col gap-3 border-t p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`nombre-${exercise.id}`}>Nombre</Label>
            <Input
              id={`nombre-${exercise.id}`}
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                pendiente.current = e.target.value;
                schedule(() => {
                  const limpio = pendiente.current.trim();
                  if (limpio !== "") void renameExercise(exercise.id, limpio);
                });
              }}
              onBlur={flush}
            />
            <span className="text-muted-foreground text-xs">
              Renombrar siempre se puede: el nombre no se snapshotea.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Unidad {bloqueado && <Lock className="size-3" />}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {UNIDADES.map((u) => (
                <Button
                  key={u.valor}
                  variant={exercise.unit_type === u.valor ? "default" : "outline"}
                  size="sm"
                  disabled={bloqueado}
                  onClick={() => void cambiarUnidad(u.valor)}
                >
                  {u.etiqueta}
                </Button>
              ))}
            </div>
            {bloqueado && (
              <p className="text-muted-foreground text-xs">
                Bloqueado: este ejercicio ya tiene {series} series registradas. Los snapshots ya
                escritos no cambiarían y el histórico quedaría partido en dos tramos incomparables.
                Si necesitas otra unidad, crea un ejercicio nuevo.
              </p>
            )}
            {error && <p className="text-destructive text-xs">{error}</p>}
          </div>

          <Button
            variant={armed ? "destructive" : "ghost"}
            size="sm"
            className={armed ? "" : "text-muted-foreground"}
            onClick={() => (armed ? void softDeleteExercise(exercise.id) : setArmed(true))}
          >
            <Trash2 />
            {armed ? "Tocar de nuevo para dar de baja" : "Dar de baja"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Baja lógica. Nunca se borra duro: el histórico lo referencia por exercise_id.
          </p>
        </div>
      )}
    </div>
  );
}
