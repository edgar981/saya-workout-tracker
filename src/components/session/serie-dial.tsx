"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import {
  ajustar,
  lanzamiento,
  MAX_PESO,
  MAX_REPS,
  numeroEs,
  PX_POR_PASO,
  pasoDial,
  pasosDeArrastre,
  sufijoPeso,
  type CampoDial,
} from "@/components/session/dial";
import { resorte } from "@/components/session/resorte";
import type { Exercise } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const UMBRAL_ARRASTRE = 6;

function sinMovimiento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Muestra {
  y: number;
  t: number;
}

/** Un dial de cifras: «+» arriba, el número que se arrastra o se teclea, «−» abajo. */
function DialCampo({
  campo,
  valor,
  paso,
  max,
  sufijo,
  onChange,
}: {
  campo: CampoDial;
  valor: number;
  paso: number;
  max: number;
  sufijo: string;
  onChange: (n: number) => void;
}) {
  const esReps = campo === "reps";
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  // Mientras se arrastra: el valor de vista previa y cuánto se desplaza el número.
  const [previo, setPrevio] = useState<number | null>(null);
  const [desplazo, setDesplazo] = useState(0);
  const arrastre = useRef<{
    id: number;
    y0: number;
    base: number;
    activo: boolean;
    muestras: Muestra[];
  } | null>(null);
  const hubo = useRef(false);
  const raf = useRef(0);
  const cancelado = useRef(false);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const mostrado = previo ?? valor;
  const cadena = esReps ? String(mostrado) : numeroEs(mostrado);
  const etiquetaCampo = esReps ? "Repeticiones" : `Peso en ${sufijo}`;

  const sumar = (pasos: number) => onChange(ajustar(valor, pasos * paso, max));

  const volverACero = (desde: number, vy: number) => {
    cancelAnimationFrame(raf.current);
    if (sinMovimiento()) {
      setDesplazo(0);
      return;
    }
    let x = desde;
    let v = vy * 0.2;
    let antes = performance.now();
    const paso1 = (ahora: number) => {
      const dt = (ahora - antes) / 1000;
      antes = ahora;
      const p = resorte(x, v, 0, dt, { response: 0.3, damping: Math.abs(vy) > 300 ? 0.8 : 1, eps: 0.2 });
      x = p.x;
      v = p.v;
      setDesplazo(x);
      if (!p.quieto) raf.current = requestAnimationFrame(paso1);
    };
    raf.current = requestAnimationFrame(paso1);
  };

  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    if (editando) return;
    cancelAnimationFrame(raf.current);
    setDesplazo(0);
    arrastre.current = {
      id: e.pointerId,
      y0: e.clientY,
      base: valor,
      activo: false,
      muestras: [{ y: e.clientY, t: e.timeStamp }],
    };
    hubo.current = false;
  };

  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    const dy = e.clientY - a.y0;
    if (!a.activo) {
      if (Math.abs(dy) < UMBRAL_ARRASTRE) return;
      a.activo = true;
      hubo.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    a.muestras.push({ y: e.clientY, t: e.timeStamp });
    if (a.muestras.length > 6) a.muestras.shift();
    const s = pasosDeArrastre(dy);
    setPrevio(ajustar(a.base, s * paso, max));
    setDesplazo(sinMovimiento() ? 0 : (dy + s * PX_POR_PASO) * 0.5);
  };

  const alSoltar = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    arrastre.current = null;
    if (!a.activo) return;
    const dy = e.clientY - a.y0;
    const m = a.muestras;
    let vy = 0;
    if (m.length > 1 && e.timeStamp - m[m.length - 1].t < 80) {
      const dt = (m[m.length - 1].t - m[0].t) / 1000;
      if (dt > 0) vy = (m[m.length - 1].y - m[0].y) / dt;
    }
    const s = pasosDeArrastre(dy) + lanzamiento(vy);
    onChange(ajustar(a.base, s * paso, max));
    setPrevio(null);
    volverACero(desplazo, vy);
  };

  const abrirEdicion = () => {
    cancelado.current = false;
    setTexto(esReps ? String(valor) : String(valor).replace(".", ","));
    setEditando(true);
  };

  const confirmar = () => {
    if (cancelado.current) return;
    setEditando(false);
    const n = Number.parseFloat(texto.replace(",", "."));
    if (!Number.isFinite(n)) return;
    onChange(ajustar(esReps ? Math.round(n) : n, 0, max));
  };

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editando) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      sumar(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      sumar(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      abrirEdicion();
    }
  };

  return (
    <div className="dc">
      <span className="lbl">{esReps ? "Reps" : "Peso"}</span>
      <button
        type="button"
        className="dpm"
        aria-label={esReps ? "Más repeticiones" : "Más peso"}
        onClick={() => sumar(1)}
      >
        <span aria-hidden="true">+</span>
      </button>
      <div
        className="dv"
        data-nodrag=""
        tabIndex={0}
        role="spinbutton"
        aria-label={etiquetaCampo}
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={max}
        onKeyDown={alTeclear}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClick={() => {
          if (hubo.current) {
            hubo.current = false;
            return;
          }
          if (!editando) abrirEdicion();
        }}
      >
        {editando ? (
          <input
            autoFocus
            value={texto}
            inputMode={esReps ? "numeric" : "decimal"}
            aria-label={esReps ? "Repeticiones" : "Peso"}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelado.current = true;
                setEditando(false);
              }
              e.stopPropagation();
            }}
          />
        ) : (
          <span
            className={cn("dnum", cadena.length > 3 && "l4")}
            style={desplazo !== 0 ? { transform: `translate3d(0,${desplazo}px,0)` } : undefined}
          >
            {cadena}
          </span>
        )}
      </div>
      <button
        type="button"
        className="dpm"
        aria-label={esReps ? "Menos repeticiones" : "Menos peso"}
        onClick={() => sumar(-1)}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className="dunit">{esReps ? "reps" : sufijo}</span>
    </div>
  );
}

/** Los dos diales de una serie: Reps y Peso. */
export function SerieDial({
  exercise,
  reps,
  peso,
  onReps,
  onPeso,
}: {
  exercise: Exercise;
  reps: number;
  /** `null` en peso corporal. */
  peso: number | null;
  onReps: (n: number) => void;
  onPeso: (n: number) => void;
}) {
  const pasoPeso = pasoDial(exercise, "peso");
  return (
    <div className="dial">
      <DialCampo
        campo="reps"
        valor={reps}
        paso={pasoDial(exercise, "reps") ?? 1}
        max={MAX_REPS}
        sufijo="reps"
        onChange={onReps}
      />
      {pasoPeso === null || peso === null ? (
        <div className="dc">
          <span className="lbl">Peso</span>
          <span className="dpm" style={{ visibility: "hidden" }} aria-hidden="true" />
          <div className="dv" data-nodrag="">
            <span className="dnum bw">peso corporal</span>
          </div>
          <span className="dpm" style={{ visibility: "hidden" }} aria-hidden="true" />
          <span className="dunit" />
        </div>
      ) : (
        <DialCampo
          campo="peso"
          valor={peso}
          paso={pasoPeso}
          max={MAX_PESO}
          sufijo={sufijoPeso(exercise)}
          onChange={onPeso}
        />
      )}
    </div>
  );
}
