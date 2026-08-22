"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

import { ExerciseCard } from "@/components/session/exercise-card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getActiveSession, loadSessionView, type SessionView } from "@/lib/db/queries";
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

  // key por sesión: así el índice del ejercicio se inicializa de forma perezosa
  // desde localStorage en el primer render y no hace falta sincronizarlo con un
  // efecto.
  return <ActiveSession key={view.session.id} view={view} />;
}

function ActiveSession({ view }: { view: SessionView }) {
  const sessionId = view.session.id;
  const [index, setIndex] = useState(() => readIndex(sessionId));

  // El ejercicio en el que ibas también sobrevive a que iOS mate el proceso.
  // No va en Dexie porque no es un dato del entrenamiento, es estado de UI.
  useEffect(() => {
    window.localStorage.setItem(INDEX_KEY(sessionId), String(index));
  }, [sessionId, index]);

  const { items } = view;

  if (items.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
        <p className="text-muted-foreground text-sm">Esta sesión no tiene ejercicios.</p>
        <Button asChild variant="outline">
          <Link href="/sesion/cerrar">Ir al cierre</Link>
        </Button>
      </main>
    );
  }

  const safeIndex = Math.min(index, items.length - 1);
  const item = items[safeIndex];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col p-4">
      <header className="flex items-baseline gap-2 pt-2 pb-3">
        <h1 className="text-sm font-semibold">{view.routineDay?.nombre ?? "Sesión libre"}</h1>
        <span className="text-muted-foreground text-xs">{view.session.fecha}</span>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {safeIndex + 1} / {items.length}
        </span>
      </header>

      {/* Salto directo. En el gym no siempre haces los ejercicios en orden
          porque la máquina está ocupada. */}
      <nav className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {items.map((other, i) => (
          <button
            key={other.sessionExercise.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={other.exercise.nombre}
            aria-current={i === safeIndex}
            className={cn(
              "size-8 shrink-0 rounded-md border text-xs font-medium tabular-nums",
              i === safeIndex
                ? "bg-primary text-primary-foreground border-transparent"
                : other.sets.length > 0
                  ? "bg-secondary text-secondary-foreground border-transparent"
                  : "text-muted-foreground",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <Separator className="mb-4" />

      <ExerciseCard key={item.sessionExercise.id} item={item} sessionId={sessionId} />

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
