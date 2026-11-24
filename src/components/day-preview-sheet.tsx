"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { movimientoReducido } from "@/components/barra-estado";
import { unitTag } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { Fila } from "@/components/ui/fila";
import { agregarMuestra, clamp, crearResorte, ejeDe, velocidad, type Muestra } from "@/lib/barra";
import { formatoNeto } from "@/lib/cuerpo";
import { loadDayPreview } from "@/lib/db/day-preview";
import type { SessionVerdictNet } from "@/lib/db/verdicts";
import {
  ALTO_DIA_POR_OMISION,
  AMORTIGUACION_VUELTA,
  cierraDia,
  FUNDIDO_CIERRE_MS,
  MARGEN_CIERRE_PX,
  RESPUESTA_DIA,
  seguirDia,
  UMBRAL_DIA_PX,
} from "@/lib/hoja-hoy";
import { fechaUltimaVez, lineaCompacta, subtituloHoy, textoBotonDia } from "@/lib/hoy";
import { cn } from "@/lib/utils";

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

  const raizRef = useRef<HTMLDivElement>(null);
  const veloRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef<((v: number) => void) | null>(null);

  // La vista previa es del día de la sesión abierta: el botón continúa esa sesión
  // (sin escribir nada).
  const mismoDia = sesionAbiertaNombre !== null && sesionAbiertaDiaId === dayId;

  // `onClose` más reciente sin re-suscribir nada (patrón «latest ref»).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // La hoja entra y sale con un resorte cerrado en el tiempo (el dedo puede
  // agarrarlo a medio camino). Entra en un efecto de layout: antes de pintar.
  useLayoutEffect(() => {
    const raiz = raizRef.current;
    const velo = veloRef.current;
    const panel = panelRef.current;
    if (!raiz || !velo || !panel) return;

    const volver = document.activeElement as HTMLElement | null;
    const H = () => panel.offsetHeight || ALTO_DIA_POR_OMISION;
    const pintar = (y: number) => {
      panel.style.transform = "translate3d(0," + y + "px,0)";
      velo.style.opacity = String(clamp(1 - y / H(), 0, 1));
    };
    const resorte = crearResorte(pintar, {
      respuesta: RESPUESTA_DIA,
      reducido: movimientoReducido,
    });

    let abierta = true;
    let temporizador: number | null = null;

    const cerrar = (v: number) => {
      abierta = false;
      if (movimientoReducido()) {
        raiz.setAttribute("data-sale", "");
        temporizador = window.setTimeout(() => onCloseRef.current(), FUNDIDO_CIERRE_MS);
        return;
      }
      resorte.ir(panel.offsetHeight + MARGEN_CIERRE_PX, {
        v: Math.max(v, 0),
        listo: () => {
          if (!abierta) onCloseRef.current();
        },
      });
    };
    cerrarRef.current = cerrar;

    if (movimientoReducido()) {
      resorte.poner(0);
      raiz.setAttribute("data-fundido", "");
    } else {
      resorte.poner(H());
      resorte.ir(0);
    }
    panel.focus({ preventScroll: true });

    /* el arrastre: el asa y la cabecera con el dedo; con el ratón, el panel entero en el tope */
    let g: {
      id: number;
      x0: number;
      y0: number;
      estado: "espera" | "mio";
      muestras: Muestra[];
      base: number;
    } | null = null;

    const alBajar = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const raton = e.pointerType === "mouse";
      if (raton && e.button !== 0) return;
      const enAsa = t.closest(".grab,.ph") !== null && t.closest(".xbtn") === null;
      const enRaton = raton && panel.scrollTop <= 0 && t.closest("input,textarea") === null;
      if (!enAsa && !enRaton) return;
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, estado: "espera", muestras: [], base: 0 };
    };
    const alMover = (e: PointerEvent) => {
      const p = g;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x0;
      const dy = e.clientY - p.y0;
      if (p.estado === "espera") {
        const eje = ejeDe(dx, dy, UMBRAL_DIA_PX);
        if (eje === null) return;
        if (eje === "x") {
          g = null;
          return;
        }
        abierta = true;
        raiz.removeAttribute("data-sale");
        if (temporizador !== null) {
          window.clearTimeout(temporizador);
          temporizador = null;
        }
        resorte.parar();
        p.base = resorte.x;
        p.estado = "mio";
        try {
          panel.setPointerCapture(e.pointerId);
        } catch {
          /* sin captura: el gesto sigue mientras el puntero esté encima */
        }
      }
      p.muestras = agregarMuestra(p.muestras, { x: e.clientX, y: e.clientY, t: e.timeStamp });
      resorte.poner(seguirDia(p.base + dy, H()));
    };
    const alSoltar = (e: PointerEvent) => {
      const p = g;
      if (!p || p.id !== e.pointerId) return;
      g = null;
      if (p.estado !== "mio") return;
      const vy = velocidad(p.muestras, e.timeStamp).vy;
      if (cierraDia(resorte.x, vy, H())) cerrar(vy);
      else resorte.ir(0, { v: vy, amortiguacion: AMORTIGUACION_VUELTA });
    };
    const alCancelar = (e: PointerEvent) => {
      const p = g;
      if (!p || p.id !== e.pointerId) return;
      g = null;
      if (p.estado === "mio") resorte.ir(0);
    };

    // Escape cierra (paridad con tocar fuera y deslizar).
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(0);
    };

    panel.addEventListener("pointerdown", alBajar);
    panel.addEventListener("pointermove", alMover);
    panel.addEventListener("pointerup", alSoltar);
    panel.addEventListener("pointercancel", alCancelar);
    window.addEventListener("keydown", alTeclear);

    return () => {
      cerrarRef.current = null;
      panel.removeEventListener("pointerdown", alBajar);
      panel.removeEventListener("pointermove", alMover);
      panel.removeEventListener("pointerup", alSoltar);
      panel.removeEventListener("pointercancel", alCancelar);
      window.removeEventListener("keydown", alTeclear);
      if (temporizador !== null) window.clearTimeout(temporizador);
      resorte.parar();
      if (volver && volver.isConnected) volver.focus({ preventScroll: true });
    };
  }, []);

  // Bloquea el scroll de Hoy detrás de la hoja.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const cerrar = (v: number) => cerrarRef.current?.(v);

  const nombreDia = preview?.day?.nombre ?? "";
  const nEjercicios = preview?.slots.length ?? 0;
  const cuenta = `${nEjercicios} ${nEjercicios === 1 ? "ejercicio" : "ejercicios"}`;
  const subCabecera = preview
    ? preview.mesocicloNombre
      ? `${subtituloHoy(preview.mesocicloNombre, null)} · ${cuenta}`
      : cuenta
    : "";

  return (
    <div
      className="dia-hoja fixed inset-0 z-50"
      ref={raizRef}
      role="dialog"
      aria-modal="true"
      aria-label={nombreDia || "Vista previa del día"}
    >
      {/* Tocar fuera cierra. */}
      <div ref={veloRef} onClick={() => cerrar(0)} className="absolute inset-0 bg-black/60" />

      {/* Hoja desde ABAJO. El panel entero hace scroll. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-panel-solido absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[30px] px-5 pt-[18px] pb-[calc(22px+env(safe-area-inset-bottom))] outline-none will-change-transform [scrollbar-width:none] [box-shadow:0_-10px_40px_rgba(0,0,0,.4)]"
      >
        <div className="grab" aria-hidden="true" />
        <div className="ph">
          <div className="min-w-0">
            {preview === undefined || !preview.day ? (
              <div className="sk h-6 w-32" />
            ) : (
              <>
                <h2 className="tit-3">{nombreDia}</h2>
                <p className="text-ink2 mt-1 text-[13px] leading-[18px] tabular-nums">
                  {subCabecera}
                </p>
              </>
            )}
          </div>
          <button type="button" className="xbtn" aria-label="Cerrar" onClick={() => cerrar(0)}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
            </svg>
          </button>
        </div>

        <div className="sec">
          {preview === undefined ? (
            <SheetSkeleton />
          ) : (
            <>
              <div className="sec-cab">
                {preview.ultima ? (
                  <>
                    <h3 className="kicker">Última vez</h3>
                    <span className="kicker kicker-d">
                      {fechaUltimaVez(preview.ultima.fecha)}
                      {preview.ultima.net.comparados > 0 && (
                        <>
                          {" "}
                          <VeredictoNeto net={preview.ultima.net} />
                        </>
                      )}
                    </span>
                  </>
                ) : (
                  <h3 className="kicker">Ejercicios</h3>
                )}
              </div>

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

        <div className="acts">
          <Button
            className="min-h-[60px] w-full rounded-[30px] text-[17px]"
            disabled={!preview?.day}
            onClick={mismoDia ? () => router.push("/sesion") : onEmpezar}
          >
            {textoBotonDia({ mismoDia, abierta: sesionAbiertaNombre, nombreDia })}
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
