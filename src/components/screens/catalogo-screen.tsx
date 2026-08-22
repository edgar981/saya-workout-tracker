"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronLeft, Lock, Plus, Trash2, X } from "lucide-react";

import { unitTag } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countSetLogsForExercise,
  createExercise,
  listActiveExercises,
  renameExercise,
  softDeleteExercise,
  updateExerciseUnits,
} from "@/lib/db/queries";
import type { AddedUnit, Exercise, Laterality, UnitType, WeightBasis } from "@/lib/db/types";
import { useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

const ARMED_MS = 5000;

const UNIDADES: { valor: UnitType; etiqueta: string }[] = [
  { valor: "LB", etiqueta: "Libras" },
  { valor: "KG", etiqueta: "Kilos" },
  { valor: "BODYWEIGHT", etiqueta: "Peso corporal" },
  { valor: "BODYWEIGHT_PLUS", etiqueta: "Peso corporal + añadido" },
  // Sin ejercicios en la semilla (§7.4) pero disponible para la máquina sin
  // marcar que aparezca algún día.
  { valor: "STACK_POSITION", etiqueta: "Posición de stack" },
];

/** Qué campos tienen sentido según la unidad. */
function usaBasis(u: UnitType) {
  return u === "KG" || u === "LB" || u === "BODYWEIGHT_PLUS";
}
function usaAddedUnit(u: UnitType) {
  return u === "BODYWEIGHT_PLUS";
}
function usaStackLabel(u: UnitType) {
  return u === "STACK_POSITION";
}

export default function CatalogoScreen() {
  const [creando, setCreando] = useState(false);
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

      {creando ? (
        <FormularioNuevo onDone={() => setCreando(false)} />
      ) : (
        <Button variant="outline" onClick={() => setCreando(true)}>
          <Plus /> Crear ejercicio
        </Button>
      )}

      <div className="flex flex-col gap-2">
        {exercises.map((exercise) => (
          <FilaEjercicio key={exercise.id} exercise={exercise} />
        ))}
      </div>
    </main>
  );
}

function FormularioNuevo({ onDone }: { onDone: () => void }) {
  const [nombre, setNombre] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("LB");
  const [basis, setBasis] = useState<WeightBasis>("TOTAL");
  const [addedUnit, setAddedUnit] = useState<AddedUnit>("KG");
  const [stackLabel, setStackLabel] = useState("disc");
  const [lateralidad, setLateralidad] = useState<Laterality>("BILATERAL");

  const crear = async () => {
    if (nombre.trim() === "") return;
    await createExercise({
      nombre: nombre.trim(),
      unit_type: unitType,
      weight_basis: usaBasis(unitType) ? basis : null,
      added_unit: usaAddedUnit(unitType) ? addedUnit : null,
      stack_label: usaStackLabel(unitType) ? stackLabel.trim() || "disc" : null,
      laterality_default: lateralidad,
    });
    onDone();
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="nuevo-nombre">Ejercicio nuevo</Label>
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onDone} aria-label="Cerrar">
          <X />
        </Button>
      </div>

      <Input
        id="nuevo-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre"
      />

      <div className="flex flex-col gap-1.5">
        <Label>Unidad</Label>
        <div className="flex flex-wrap gap-1.5">
          {UNIDADES.map((u) => (
            <Button
              key={u.valor}
              variant={unitType === u.valor ? "default" : "outline"}
              size="sm"
              onClick={() => setUnitType(u.valor)}
            >
              {u.etiqueta}
            </Button>
          ))}
        </div>
      </div>

      {usaBasis(unitType) && (
        <div className="flex flex-col gap-1.5">
          <Label>Base del peso</Label>
          <div className="flex gap-1.5">
            <Button
              variant={basis === "TOTAL" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setBasis("TOTAL")}
            >
              Total
            </Button>
            <Button
              variant={basis === "PER_IMPLEMENT" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setBasis("PER_IMPLEMENT")}
            >
              Por mancuerna
            </Button>
          </div>
        </div>
      )}

      {usaAddedUnit(unitType) && (
        <div className="flex flex-col gap-1.5">
          <Label>Unidad del peso añadido</Label>
          <div className="flex gap-1.5">
            {(["KG", "LB"] as const).map((u) => (
              <Button
                key={u}
                variant={addedUnit === u ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAddedUnit(u)}
              >
                {u.toLowerCase()}
              </Button>
            ))}
          </div>
        </div>
      )}

      {usaStackLabel(unitType) && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nuevo-stack">Etiqueta del stack</Label>
          <Input
            id="nuevo-stack"
            value={stackLabel}
            onChange={(e) => setStackLabel(e.target.value)}
            placeholder="disc"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Lateralidad</Label>
        <div className="flex gap-1.5">
          <Button
            variant={lateralidad === "BILATERAL" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setLateralidad("BILATERAL")}
          >
            Bilateral
          </Button>
          <Button
            variant={lateralidad === "UNILATERAL" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setLateralidad("UNILATERAL")}
          >
            Unilateral
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        La unidad queda fija en cuanto registres la primera serie: se snapshotea en cada SetLog y
        cambiarla después partiría el histórico.
      </p>

      <Button onClick={() => void crear()} disabled={nombre.trim() === ""}>
        Crear
      </Button>
    </div>
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
