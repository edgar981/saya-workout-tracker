"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { unitTag } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { Fila } from "@/components/ui/fila";
import { formatoNeto } from "@/lib/cuerpo";
import { loadDayPreview } from "@/lib/db/day-preview";
import type { SessionVerdictNet } from "@/lib/db/verdicts";
import { lineaCompacta, subtituloHoy } from "@/lib/hoy";
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
  return (
    <span className={cn("tabular-nums", n > 0 ? "text-ink" : "text-ink2")}>
      {formatoNeto(n)}
      {sinComparacion > 0 && (
        <span className="align-super text-[9px]" style={{ color: "var(--ink3)" }}>
          {" "}
          •
        </span>
      )}
    </span>
  );
}

export function DayPreviewSheet({
  dayId,
  sesionAbiertaNombre,
  sesionAbiertaDiaId = null,
  onEmpezar,
  onClose,
}: {
  dayId: string;
  /** Nombre del día de la sesión abierta, o null si no hay ninguna. */
  sesionAbiertaNombre: string | null;
  /** Día (`routine_day_id`) de la sesión abierta; null si es libre o no hay. */
  sesionAbiertaDiaId?: string | null;
  onEmpezar: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const preview = useLiveQuery(() => loadDayPreview(dayId), [dayId]);

  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);

  // La vista previa es del día de la sesión abierta: no hay aviso y el botón
  // continúa esa sesión (sin escribir nada).
  const mismoDia = sesionAbiertaNombre !== null && sesionAbiertaDiaId === dayId;
  const aviso = sesionAbiertaNombre !== null && !mismoDia;

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

  // Bloquea el scroll de Hoy detrás de la hoja.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Arrastre para cerrar, en listeners NATIVOS sobre la zona de agarre. El
  // `touchmove` debe ser NON-PASSIVE para poder `preventDefault()` y consumir el
  // gesto — si no, iOS lo interpreta también como overscroll del viewport y el
  // fondo rebota. React registra sus `onTouchMove` como passive, así que su
  // `preventDefault` no serviría; de ahí el listener a mano. La otra mitad es
  // `touch-action: none` (clase `touch-none`) en el elemento: le dice al
  // navegador que no haga scroll/zoom por su cuenta al tocar aquí.
  useEffect(() => {
    const el = grabRef.current;
    if (!el) return;
    let startY = 0;
    let activo = false;
    let dy = 0;
    const onStart = (e: TouchEvent) => {
      activo = true;
      startY = e.touches[0].clientY;
      dy = 0;
      setDragging(true);
    };
    const onMove = (e: TouchEvent) => {
      if (!activo) return;
      e.preventDefault(); // consume el gesto: nada de scroll/rebote del fondo
      dy = Math.max(0, e.touches[0].clientY - startY);
      setDragY(dy);
    };
    const onEnd = () => {
      if (!activo) return;
      activo = false;
      setDragging(false);
      if (dy > DISMISS_PX) cerrar();
      else setDragY(0);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [cerrar]);

  const nombreDia = preview?.day?.nombre ?? "";
  const nEjercicios = preview?.slots.length ?? 0;
  const cuenta = `${nEjercicios} ${nEjercicios === 1 ? "ejercicio" : "ejercicios"}`;
  const subCabecera = preview
    ? preview.mesocicloNombre
      ? `${subtituloHoy(preview.mesocicloNombre, null)} · ${cuenta}`
      : cuenta
    : "";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Vista previa del día">
      {/* Tocar fuera cierra. */}
      <div
        onClick={() => cerrar()}
        className="absolute inset-0 bg-black/60 transition-opacity"
        style={{ opacity: shown ? 1 : 0, transitionDuration: `${SLIDE_MS}ms` }}
      />

      {/* Hoja desde ABAJO. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-panel-solido absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[30px] px-5 pt-[18px] pb-[calc(22px+env(safe-area-inset-bottom))] outline-none [box-shadow:inset_0_1px_0_rgba(255,255,255,.2)]"
        style={{
          transform: shown ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.32,0.72,0,1)`,
        }}
      >
        {/* Zona de agarre: la cabecera arrastra (listeners nativos, ver arriba); el
            contenido de abajo hace scroll normal. `touch-none` para que el arrastre
            no lo tome el navegador como scroll del fondo. */}
        <div ref={grabRef} className="flex shrink-0 touch-none items-start justify-between gap-3">
          <div className="min-w-0">
            {preview === undefined || !preview.day ? (
              <div className="sk h-6 w-32" />
            ) : (
              <>
                <h2 className="tit-3">{nombreDia}</h2>
                <p className="text-ink2 text-[13px] leading-[19px] font-normal tabular-nums">
                  {subCabecera}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => cerrar()}
            className="text-ink2 -mt-2 -mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none outline-none focus-visible:[box-shadow:var(--fsh-f)]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {aviso && (
          <p className="wnote shrink-0">
            Tienes una sesión de <span className="font-semibold">{sesionAbiertaNombre}</span>{" "}
            abierta. Empezar este día la cierra (o la descarta si no registraste nada).
          </p>
        )}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {preview === undefined ? (
            <SheetSkeleton />
          ) : (
            <>
              {preview.ultima ? (
                <div className="sec-cab">
                  <h3 className="kicker">Última vez</h3>
                  <span className="kicker kicker-d capitalize">
                    {fechaCorta(preview.ultima.fecha)}
                    {preview.ultima.net.comparados > 0 && (
                      <>
                        {" "}
                        <VeredictoNeto net={preview.ultima.net} />
                      </>
                    )}
                  </span>
                </div>
              ) : (
                <p className="dek">Nunca has hecho este día.</p>
              )}

              {/* Ejercicios en orden (solo slots activos), con objetivo cuando exista. */}
              <div>
                {preview.slots.map(({ slot, exercise }, i) => {
                  const objetivo =
                    slot.target_sets !== null && slot.target_reps !== null
                      ? `objetivo ${slot.target_sets} × ${slot.target_reps}`
                      : null;
                  // La línea de la última vez sólo si fue el ejercicio de hoy del
                  // slot: una sustitución no se compara con el ejercicio planeado.
                  const previo = preview.ultima?.porSlot[slot.id];
                  const linea =
                    previo && previo.exerciseId === exercise?.id && previo.lineas.length > 0
                      ? lineaCompacta(previo.lineas)
                      : null;
                  const partes = preview.ultima
                    ? [linea, objetivo]
                    : [exercise ? unitTag(exercise) : null, objetivo];
                  const subtitulo =
                    partes.filter((p): p is string => !!p).join(" · ") ||
                    (exercise ? unitTag(exercise) : undefined);
                  return (
                    <Fila
                      key={slot.id}
                      indice={String(i + 1).padStart(2, "0")}
                      titulo={exercise?.nombre ?? "—"}
                      subtitulo={subtitulo}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Acción: fuera del scroll, en la zona del pulgar. */}
        {mismoDia ? (
          <Button
            size="lg"
            className="mt-4 w-full shrink-0"
            disabled={!preview?.day}
            onClick={() => router.push("/sesion")}
          >
            Continuar la sesión
          </Button>
        ) : (
          <Button
            size="lg"
            className="mt-4 w-full shrink-0"
            disabled={!preview?.day}
            onClick={onEmpezar}
          >
            Empezar {nombreDia}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Esqueleto con la forma final (§1): última-vez, filas de ejercicio. Sin texto suelto. */
function SheetSkeleton() {
  return (
    <>
      <div className="sk mb-3 h-4 w-40" />
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="fila">
            <div className="sk h-3 w-4" />
            <div className="sk h-4 flex-1" />
          </div>
        ))}
      </div>
    </>
  );
}
