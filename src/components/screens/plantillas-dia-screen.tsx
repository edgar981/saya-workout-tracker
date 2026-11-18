"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronUp } from "lucide-react";

import { ExercisePicker, unitTag } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { Vacio } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { contar } from "@/lib/ajustes-resumen";
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
import { PlantillaDiaSkeleton } from "@/components/skeletons";

const ARMED_MS = 5000;

function Seccion({
  titulo,
  derecha,
  children,
}: {
  titulo: string;
  derecha?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="sec">
      <div className="sec-cab">
        <h2 className="kicker">{titulo}</h2>
        {derecha != null && <span className="kicker kicker-d">{derecha}</span>}
      </div>
      {children}
    </section>
  );
}

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
    return <PlantillaDiaSkeleton />;
  }

  return (
    <>
      <div className="px-4">
        <Cabeza
          titulo={day?.nombre ?? "Día"}
          subtitulo={contar(slots.length, "ejercicio", "ejercicios")}
          empujada
        />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          {slots.length === 0 ? (
            <Vacio
              titulo="Este día no tiene ejercicios."
              texto="Agrega del catálogo los que haces este día, en el orden en que los haces."
              salida={<Button onClick={() => setShowPicker(true)}>Agregar ejercicio</Button>}
            />
          ) : (
            <>
              <Seccion titulo="Ejercicios" derecha="en orden">
                {slots.map((view, i) => (
                  <SlotFila
                    key={view.slot.id}
                    view={view}
                    dayId={dayId}
                    posicion={i}
                    esPrimero={i === 0}
                    esUltimo={i === slots.length - 1}
                  />
                ))}
              </Seccion>

              <Button variant="secondary" className="mt-3 w-full" onClick={() => setShowPicker(true)}>
                Agregar ejercicio
              </Button>
            </>
          )}

          <p className="mt-3 text-[13px] leading-[18px] text-ink3">
            Los cambios valen para las próximas sesiones de {day?.nombre}. Las que ya cerraste no
            cambian.
          </p>
        </main>
      </Hoja>

      <Panel
        abierto={showPicker}
        alCerrar={() => setShowPicker(false)}
        titulo="Agregar ejercicio del catálogo"
      >
        <ExercisePicker
          inputId="filtro-nuevo-slot"
          onPick={async (exercise) => {
            await addSlot(dayId, exercise.id);
            setShowPicker(false);
          }}
        />
      </Panel>
    </>
  );
}

function SlotFila({
  view,
  dayId,
  posicion,
  esPrimero,
  esUltimo,
}: {
  view: SlotView;
  dayId: string;
  posicion: number;
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
    <div>
      <Fila
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        chevron={false}
        indice={String(posicion + 1).padStart(2, "0")}
        titulo={exercise?.nombre ?? "— ejercicio no encontrado —"}
        subtitulo={
          <>
            {exercise ? unitTag(exercise) : ""}
            {slot.target_sets !== null && slot.target_reps !== null
              ? ` · objetivo ${slot.target_sets} × ${slot.target_reps}`
              : " · sin objetivo"}
            {alternatives.length > 0
              ? ` · ${contar(alternatives.length, "alternativa", "alternativas")}`
              : ""}
          </>
        }
        valor={abierto ? <ChevronUp className="size-[18px]" /> : <ChevronDown className="size-[18px]" />}
      />

      {abierto && (
        <div className="mt-2 mb-3 rounded-[20px] bg-white/[.035] px-4 py-0.5 pb-4 shadow-[inset_0_0_0_1px_var(--color-hair)]">
          <div className="mt-5 flex w-full gap-2.5">
            <div className="flex-1">
              <Label htmlFor={`sets-${slot.id}`} className="kicker mb-[9px]">
                Series objetivo
              </Label>
              <Input
                id={`sets-${slot.id}`}
                value={sets}
                onChange={(e) => onSets(e.target.value)}
                onBlur={flush}
                inputMode="numeric"
                placeholder="—"
                className="text-center"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`reps-${slot.id}`} className="kicker mb-[9px]">
                Reps objetivo
              </Label>
              <Input
                id={`reps-${slot.id}`}
                value={reps}
                onChange={(e) => onReps(e.target.value)}
                onBlur={flush}
                inputMode="numeric"
                placeholder="—"
                className="text-center"
              />
            </div>
          </div>
          <p className="mt-2 text-[13px] leading-[18px] text-ink2">
            Opcional. Se muestra en la sesión como «objetivo 3 × 8».
          </p>

          <div className="mt-5">
            <Label className="kicker mb-[9px]">Alternativas</Label>
            {alternatives.length === 0 && (
              <p className="mt-1.5 text-[15px] leading-[22px] text-ink2">Sin alternativas.</p>
            )}
            {alternatives.map((alt) => (
              <div key={alt.id} className="flex min-h-11 items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] leading-[22px]">{alt.nombre}</span>
                <Button
                  variant="link"
                  onClick={() => void removeSlotAlternative(slot.id, alt.id)}
                  aria-label={`Quitar ${alt.nombre}`}
                >
                  Quitar
                </Button>
              </div>
            ))}
            <Button variant="link" className="mt-1" onClick={() => setShowAlt(true)}>
              Agregar alternativa
            </Button>
          </div>

          <div className="mt-5 flex w-full gap-2.5">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={esPrimero}
              onClick={() => void moveSlot(dayId, slot.id, -1)}
            >
              Subir
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={esUltimo}
              onClick={() => void moveSlot(dayId, slot.id, 1)}
            >
              Bajar
            </Button>
          </div>

          {/* Borrado SUAVE. Duro dejaría colgando SessionExercise.routine_slot_id
              y las sesiones viejas perderían el badge de sustitución. */}
          <div className="mt-3">
            <Button
              variant="link"
              className={armed ? "danger" : undefined}
              onClick={() => (armed ? void softDeleteSlot(slot.id) : setArmed(true))}
            >
              {armed ? "Tocar de nuevo: quitar del día" : "Quitar del día"}
            </Button>
          </div>
          <p className="mt-3 text-[13px] leading-[18px] text-ink3">
            Se da de baja, no se borra: el histórico sigue apuntando a este slot para explicar las
            sustituciones que registraste.
          </p>
        </div>
      )}

      <Panel abierto={showAlt} alCerrar={() => setShowAlt(false)} titulo="Agregar alternativa">
        <ExercisePicker
          inputId={`alt-${slot.id}`}
          excludeIds={[slot.exercise_id, ...alternatives.map((a) => a.id)]}
          onPick={async (exercise) => {
            await addSlotAlternative(slot.id, exercise.id);
            setShowAlt(false);
          }}
        />
      </Panel>
    </div>
  );
}
