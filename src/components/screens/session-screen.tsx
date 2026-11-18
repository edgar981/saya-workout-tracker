"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { ExercisePicker } from "@/components/exercise-picker";
import { ExerciseCard } from "@/components/session/exercise-card";
import { RestCounter } from "@/components/session/rest-counter";
import { SessionSkeleton } from "@/components/skeletons";
import { Anillo } from "@/components/ui/anillo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Vacio } from "@/components/ui/estados";
import { Panel } from "@/components/ui/panel";
import {
  addAdHocExercise,
  getActiveSession,
  loadSessionView,
  type SessionView,
} from "@/lib/db/queries";
import { cn } from "@/lib/utils";

const INDEX_KEY = (sessionId: string) => `saya:ejercicio:${sessionId}`;

function readIndex(sessionId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(INDEX_KEY(sessionId));
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function SessionScreen() {
  const router = useRouter();

  const view = useLiveQuery(async () => {
    const session = await getActiveSession();
    if (!session) return null;
    return loadSessionView(session.id);
  }, []);

  useEffect(() => {
    if (view === null) router.replace("/");
  }, [view, router]);

  if (view === undefined) {
    return <SessionSkeleton />;
  }
  if (view === null) {
    return <p className="text-ink2 p-6 text-sm">Sin sesión activa.</p>;
  }

  return <ActiveSession key={view.session.id} view={view} />;
}

function ActiveSession({ view }: { view: SessionView }) {
  const sessionId = view.session.id;
  const [index, setIndex] = useState(() => readIndex(sessionId));
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(INDEX_KEY(sessionId), String(index));
  }, [sessionId, index]);

  const { items } = view;
  // El `creado_en` más reciente de TODA la sesión (cualquier ejercicio): el
  // contador cuenta contra la última serie de la sesión, no del ejercicio, así
  // que cambiar de ejercicio no lo reinicia (§3 / criterio 8).
  const ultimoCreadoEn = useMemo(() => {
    const times = items
      .flatMap((i) => i.sets)
      .map((s) => s.creado_en)
      .filter((t): t is string => !!t);
    return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
  }, [items]);
  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);
  const item = items[safeIndex];

  const agregar = async (exerciseId: string) => {
    await addAdHocExercise(sessionId, exerciseId);
    setShowPicker(false);
    // Saltar al recién agregado: queda al final de la lista visual.
    setIndex(items.length);
  };

  return (
    <>
      {/* La barra: salida que deja la sesión abierta, el día y el contador desde la
          última serie. La pantalla pinta su propia barra y su propia hoja (la regla
          U de globals.css desenvuelve la del shell). */}
      <header className="stop">
        {/* Volver a Hoy SIN cerrar: la sesión sigue activa (§1). No toca Dexie; Hoy
            no rebota porque no autorredirecciona a /sesion. Volver a entrar reanuda
            en el mismo ejercicio (saya:ejercicio:<id>). */}
        <Link href="/" aria-label="Volver al home sin cerrar la sesión" className="stop-back">
          <b aria-hidden="true">‹</b> Volver
        </Link>
        <span className="stop-dia">{view.routineDay?.nombre ?? "Sesión libre"}</span>
        <RestCounter lastCreadoEn={ultimoCreadoEn} />
      </header>

      <div
        className="hoja"
        data-propia=""
        style={{ "--ventana": "70px", "--hoja-pb": "0px", marginTop: 12 } as CSSProperties}
      >
        <main className="mx-auto flex w-full max-w-md flex-col px-4 pt-4">
          <div className="flex-1 pb-4">
            {/* Salto directo, en orden_visual. Este orden NO cambia según lo que
                vayas ejecutando: una lista que se reacomoda sola entre series
                desorienta. */}
            <nav aria-label="Ejercicios" className="chips">
              {items.map((other, i) => (
                <button
                  key={other.sessionExercise.id}
                  type="button"
                  className="chip"
                  onClick={() => setIndex(i)}
                  aria-label={`Ejercicio ${i + 1}: ${other.exercise.nombre}`}
                  aria-current={i === safeIndex ? "step" : undefined}
                  data-hecho={other.sets.some((s) => s.reps > 0) ? "" : undefined}
                >
                  {i === safeIndex && <Anillo redondo />}
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                className="chip chip-mas"
                onClick={() => setShowPicker(true)}
                aria-label="Agregar ejercicio"
              >
                +
              </button>
            </nav>

            {items.length === 0 || !item ? (
              <Vacio
                className="mt-6"
                titulo="Esta sesión no tiene ejercicios."
                texto="Agrega uno del catálogo para registrar series."
                salida={<Button onClick={() => setShowPicker(true)}>+ Ejercicio</Button>}
              />
            ) : (
              <ExerciseCard
                key={item.sessionExercise.id}
                item={item}
                sessionId={sessionId}
                posicion={safeIndex + 1}
                total={items.length}
              />
            )}
          </div>

          <nav className="sbot">
            <button
              type="button"
              className="arw"
              disabled={safeIndex === 0}
              onClick={() => setIndex(safeIndex - 1)}
              aria-label="Ejercicio anterior"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              className="arw"
              disabled={safeIndex >= items.length - 1}
              onClick={() => setIndex(safeIndex + 1)}
              aria-label="Ejercicio siguiente"
            >
              <span aria-hidden="true">›</span>
            </button>
            <Link
              href="/sesion/cerrar"
              className={cn(buttonVariants({ variant: "secondary" }), "ml-auto")}
            >
              Cerrar sesión
            </Link>
          </nav>
        </main>
      </div>

      <Panel
        abierto={showPicker}
        alCerrar={() => setShowPicker(false)}
        titulo="Agregar ejercicio del catálogo"
      >
        <label htmlFor="filtro-adhoc" className="sr-only">
          Agregar ejercicio del catálogo
        </label>
        <ExercisePicker
          inputId="filtro-adhoc"
          className="mt-3.5"
          onPick={(exercise) => void agregar(exercise.id)}
        />
        <p className="text-ink2 mt-3 text-[13px] leading-[19px] font-normal">
          Solo del catálogo. Crear un ejercicio obliga a fijar su unidad, y eso se snapshotea en
          cada serie — se decide en frío, en Catálogo.
        </p>
      </Panel>
    </>
  );
}
