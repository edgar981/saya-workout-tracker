"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Flag, Plus, X } from "lucide-react";

import { ExercisePicker } from "@/components/exercise-picker";
import { ExerciseCard } from "@/components/session/exercise-card";
import { RestCounter } from "@/components/session/rest-counter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
    return <p className="text-muted-foreground p-6 text-sm">Abriendo la sesión…</p>;
  }
  if (view === null) {
    return <p className="text-muted-foreground p-6 text-sm">Sin sesión activa.</p>;
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-4">
      {/* Cabecera compacta (v2): la barra que convive con el scroll. Salida que
          deja la sesión abierta, nombre del día, y el contador desde la última
          serie con su punto de acento. */}
      <header className="flex items-center gap-2.5 pt-2 pb-3">
        {/* Salir al home SIN cerrar: la sesión sigue activa (§1). No toca Dexie;
            el home no rebota porque ya no autorredirecciona a /sesion. Volver a
            entrar reanuda en el mismo ejercicio (saya:ejercicio:<id>). */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="-ml-1 shrink-0 gap-1.5 rounded-full px-3"
        >
          <Link href="/" aria-label="Salir al home sin cerrar la sesión">
            <ChevronLeft /> Salir
          </Link>
        </Button>
        <div className="flex-1" />
        <span className="text-muted-foreground font-mono text-xs">
          {view.routineDay?.nombre ?? "Sesión libre"}
        </span>
        {ultimoCreadoEn && <span className="bg-border-strong h-3.5 w-px shrink-0" />}
        <RestCounter lastCreadoEn={ultimoCreadoEn} />
      </header>

      {/* Salto directo, en orden_visual. Número + nombre corto (v2). Este orden NO
          cambia según lo que vayas ejecutando: una lista que se reacomoda sola
          entre series desorienta. */}
      <nav className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {items.map((other, i) => (
          <button
            key={other.sessionExercise.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={other.exercise.nombre}
            aria-current={i === safeIndex}
            className={cn(
              "flex shrink-0 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-left",
              i === safeIndex
                ? "bg-primary text-primary-foreground border-transparent"
                : other.sets.length > 0
                  ? "bg-secondary text-secondary-foreground border-transparent"
                  : "text-muted-foreground",
              other.isAdHoc && i !== safeIndex && "border-dashed",
            )}
          >
            <span className="font-mono text-[10px] font-semibold tabular-nums opacity-70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="max-w-[7rem] truncate text-xs font-medium">
              {other.exercise.nombre}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          aria-label="Agregar ejercicio a la sesión"
          className="text-muted-foreground flex shrink-0 items-center justify-center rounded-md border border-dashed px-3 text-lg"
        >
          +
        </button>
      </nav>

      {showPicker && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="filtro-adhoc">Agregar ejercicio del catálogo</Label>
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
            inputId="filtro-adhoc"
            onPick={(exercise) => void agregar(exercise.id)}
          />
          <p className="text-muted-foreground text-xs">
            Solo del catálogo. Crear un ejercicio obliga a fijar su unidad, y eso se snapshotea en
            cada serie — se decide en frío, en Catálogo.
          </p>
        </div>
      )}

      <Separator className="mb-4" />

      {items.length === 0 || !item ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">Esta sesión no tiene ejercicios.</p>
          <Button variant="outline" onClick={() => setShowPicker(true)}>
            <Plus /> Ejercicio
          </Button>
        </div>
      ) : (
        <ExerciseCard key={item.sessionExercise.id} item={item} sessionId={sessionId} />
      )}

      <div className="mt-6 flex items-center gap-2 pb-2">
        <Button
          variant="outline"
          size="icon"
          disabled={safeIndex === 0}
          onClick={() => setIndex(safeIndex - 1)}
          aria-label="Ejercicio anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={safeIndex >= items.length - 1}
          onClick={() => setIndex(safeIndex + 1)}
          aria-label="Ejercicio siguiente"
        >
          <ChevronRight />
        </Button>
        <Button asChild variant="secondary" className="ml-auto">
          <Link href="/sesion/cerrar">
            <Flag /> Cerrar sesión
          </Link>
        </Button>
      </div>
    </main>
  );
}
