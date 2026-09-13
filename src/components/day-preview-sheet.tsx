"use client";

import {
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Flag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadDayPreview } from "@/lib/db/day-preview";
import type { SessionVerdictNet } from "@/lib/db/verdicts";
import { cn } from "@/lib/utils";

/** ms de la animación de entrada/salida. Solo la hoja se desliza; no es una
 *  transición de ruta (esas siguen fuera, sin disparador). */
const SLIDE_MS = 240;
/** Umbral de arrastre para descartar al soltar. */
const DISMISS_PX = 100;

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Veredicto compacto de la última sesión, con las mismas reglas de color que la
 * fila de `/historial` (DECISIONES.md §10): tinta plena si es positivo, atenuado
 * en cero y negativo; nunca acento ni rojo. El punto avisa de ejercicios sin
 * comparación. Presentación pura sobre el `net` que ya calcula `loadSessionVerdicts`.
 */
function VeredictoNeto({ net }: { net: SessionVerdictNet }) {
  const { net: n, sinComparacion } = net;
  const texto = n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums",
        n > 0 ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {texto}
      {sinComparacion > 0 && <span className="text-faint align-super text-[9px]"> •</span>}
    </span>
  );
}

export function DayPreviewSheet({
  dayId,
  sesionAbiertaNombre,
  onEmpezar,
  onClose,
}: {
  dayId: string;
  /** Nombre del día de la sesión abierta, o null si no hay ninguna. */
  sesionAbiertaNombre: string | null;
  onEmpezar: () => void;
  onClose: () => void;
}) {
  const preview = useLiveQuery(() => loadDayPreview(dayId), [dayId]);

  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Entrada: desliza hacia arriba en el primer frame.
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // `cerrar` estable (useCallback []) que siempre llama al `onClose` más reciente
  // vía un ref actualizado en un efecto — el patrón "latest ref", para no
  // re-suscribir los listeners en cada render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const cerrar = useCallback(() => {
    setShown(false);
    window.setTimeout(() => onCloseRef.current(), SLIDE_MS);
  }, []);

  // Escape cierra (paridad con tocar fuera y deslizar).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cerrar]);

  // Bloquea el scroll del home detrás de la hoja.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onTouchStart = (e: ReactTouchEvent) => {
    setDragging(true);
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    if (!dragging) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragY > DISMISS_PX) cerrar();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Vista previa del día">
      {/* Tocar fuera cierra. */}
      <div
        onClick={() => cerrar()}
        className="bg-bg/80 absolute inset-0 transition-opacity"
        style={{ opacity: shown ? 1 : 0, transitionDuration: `${SLIDE_MS}ms` }}
      />

      {/* Hoja desde ABAJO. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-surface border-border absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] outline-none"
        style={{
          transform: shown ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.32,0.72,0,1)`,
        }}
      >
        {/* Zona de agarre: el asa y la cabecera arrastran; el contenido de abajo
            hace scroll normal. */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="shrink-0 px-4 pt-2.5"
        >
          <div className="bg-border mx-auto mb-3 h-1 w-9 rounded-full" />
          {preview === undefined || !preview.day ? (
            <div className="bg-surface-2 h-6 w-32 rounded-md" />
          ) : (
            <>
              <h2 className="text-xl font-semibold">{preview.day.nombre}</h2>
              <p className="text-muted-foreground text-xs tabular-nums">
                {preview.slots.length} {preview.slots.length === 1 ? "ejercicio" : "ejercicios"}
              </p>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
          {preview === undefined ? (
            <SheetSkeleton />
          ) : (
            <>
              {/* Última vez que se hizo este día y cómo fue. */}
              <div className="border-border bg-surface-2 mb-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5">
                {preview.ultima ? (
                  <>
                    <span className="text-muted-foreground text-xs">Última vez</span>
                    <span className="text-foreground text-sm capitalize">
                      {fechaCorta(preview.ultima.fecha)}
                    </span>
                    {preview.ultima.net.comparados > 0 && (
                      <span className="ml-auto">
                        <VeredictoNeto net={preview.ultima.net} />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">Nunca has hecho este día.</span>
                )}
              </div>

              {/* Ejercicios en orden (solo slots activos), con objetivo cuando exista. */}
              <div className="flex flex-col">
                {preview.slots.map(({ slot, exercise }, i) => (
                  <div
                    key={slot.id}
                    className={cn(
                      "flex items-center gap-3 py-2.5",
                      i > 0 && "border-border border-t",
                    )}
                  >
                    <span className="text-faint w-5 shrink-0 text-center font-mono text-xs tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {exercise?.nombre ?? "—"}
                    </span>
                    {slot.target_sets !== null && slot.target_reps !== null && (
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {slot.target_sets} × {slot.target_reps}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Acción: fuera del scroll, en la zona del pulgar. */}
        <div className="border-border shrink-0 border-t px-4 pt-3 pb-4">
          {/* Advertencia: con una sesión abierta, empezar la cierra (o descarta si
              está vacía) — la regla de startSession no cambia, pero se avisa antes. */}
          {sesionAbiertaNombre && (
            <div className="text-muted-foreground mb-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                Tienes una sesión de <span className="text-foreground">{sesionAbiertaNombre}</span>{" "}
                abierta. Empezar este día la cierra (o la descarta si no registraste nada).
              </span>
            </div>
          )}
          <Button size="lg" className="w-full" disabled={!preview?.day} onClick={onEmpezar}>
            <Flag /> Empezar {preview?.day?.nombre ?? ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Esqueleto con la forma final (§1): última-vez, filas de ejercicio. Sin texto suelto. */
function SheetSkeleton() {
  return (
    <>
      <div className="bg-surface-2 mb-3 h-11 rounded-xl" />
      <div className="flex flex-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn("flex items-center gap-3 py-2.5", i > 0 && "border-border border-t")}
          >
            <div className="bg-surface-2 h-3 w-4 rounded" />
            <div className="bg-surface-2 h-4 flex-1 rounded" />
          </div>
        ))}
      </div>
    </>
  );
}
