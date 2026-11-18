"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { unitTag } from "@/components/exercise-picker";
import { GruposPicker } from "@/components/grupos-picker";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea, Vacio } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pildora } from "@/components/ui/pildora";
import { contar, filtrarPorNombre } from "@/lib/ajustes-resumen";
import {
  countSetLogsForExercise,
  listActiveExercises,
  renameExercise,
  softDeleteExercise,
  updateExerciseGrupos,
  updateExerciseUnits,
} from "@/lib/db/queries";
import type { Exercise, UnitType } from "@/lib/db/types";
import { UNIDADES, usaAddedUnit, usaBasis, usaStackLabel } from "@/lib/catalogo-units";
import { nombresDirectos } from "@/lib/musculos";
import { useAutosave } from "@/lib/use-autosave";
import { CatalogoSkeleton } from "@/components/skeletons";

const ARMED_MS = 5000;

export default function CatalogoScreen() {
  const exercises = useLiveQuery(() => listActiveExercises(), []);
  const [q, setQ] = useState("");

  if (exercises === undefined) {
    return <CatalogoSkeleton />;
  }

  const visibles = filtrarPorNombre(exercises, q);

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Catálogo" subtitulo={contar(exercises.length, "ejercicio", "ejercicios")} empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          {exercises.length === 0 ? (
            <Vacio
              titulo="El catálogo está vacío."
              texto="Crea tu primer ejercicio: nombre, unidad y grupos."
              salida={
                <Button asChild>
                  <Link href="/catalogo/nuevo">Nuevo ejercicio</Link>
                </Button>
              }
            />
          ) : (
            <>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar ejercicio"
                aria-label="Buscar ejercicio"
              />

              {/* Crear ejercicio reemplaza la pantalla con un formulario completo, así que
                  es ruta propia (/catalogo/nuevo): el gesto atrás vuelve aquí en vez de
                  colapsar un panel. Expandir una fila, en cambio, se queda en estado. */}
              <Button asChild className="mt-3 w-full">
                <Link href="/catalogo/nuevo">Nuevo ejercicio</Link>
              </Button>

              <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
                {visibles.map((exercise) => (
                  <FilaEjercicio key={exercise.id} exercise={exercise} />
                ))}
                {visibles.length === 0 && (
                  <p className="my-3 mt-1.5 text-[15px] leading-[22px] text-ink2">Nada coincide.</p>
                )}
              </div>
            </>
          )}
        </main>
      </Hoja>
    </>
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
    <div>
      <Fila
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        titulo={exercise.nombre}
        subtitulo={
          <>
            {unitTag(exercise)}
            {exercise.laterality_default === "UNILATERAL" ? " · unilateral" : ""}
            {` · ${nombresDirectos(exercise.grupos ?? {}) || "sin grupo"}`}
          </>
        }
        valor={
          series !== undefined ? (
            <span className="text-ink3">{contar(series, "serie", "series")}</span>
          ) : undefined
        }
      />

      {abierto && (
        <div className="mt-2 mb-3 rounded-[20px] bg-white/[.035] px-4 py-0.5 pb-4 shadow-[inset_0_0_0_1px_var(--color-hair)]">
          <div className="mt-5">
            <Label htmlFor={`nombre-${exercise.id}`} className="kicker mb-[9px]">
              Nombre
            </Label>
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
            <p className="mt-2 text-[13px] leading-[18px] text-ink2">
              Renombrar siempre se puede: el nombre no se snapshotea.
            </p>
          </div>

          <div className="mt-5">
            <Label className="kicker mb-[9px]">Unidad</Label>
            <div className="flex flex-wrap gap-1.5">
              {UNIDADES.map((u) => (
                <Pildora
                  key={u.valor}
                  presionada={exercise.unit_type === u.valor}
                  disabled={bloqueado}
                  onClick={() => void cambiarUnidad(u.valor)}
                >
                  {u.etiqueta}
                </Pildora>
              ))}
            </div>
            <p className="mt-2 text-[13px] leading-[18px] text-ink2">
              {bloqueado
                ? `Fija: ya tiene ${contar(series ?? 0, "serie", "series")}.`
                : "Sin series: todavía se puede cambiar."}
            </p>
            {error && <ErrorEnLinea className="mt-2">{error}</ErrorEnLinea>}
          </div>

          <div className="mt-5">
            <Label className="kicker mb-[9px]">Grupos musculares</Label>
            {/* Sin candado, a diferencia de la unidad: no se snapshotea (§12.2). */}
            <GruposPicker
              value={exercise.grupos ?? {}}
              onChange={(grupos) => void updateExerciseGrupos(exercise.id, grupos)}
            />
          </div>

          <div className="mt-5">
            <Button
              variant="link"
              className="danger"
              onClick={() => (armed ? void softDeleteExercise(exercise.id) : setArmed(true))}
            >
              {armed ? "Tocar de nuevo" : "Archivar"}
            </Button>
          </div>
          <p className="mt-3 text-[13px] leading-[18px] text-ink3">
            Archivar lo saca del buscador de la sesión. Sus series se quedan.
          </p>
        </div>
      )}
    </div>
  );
}
