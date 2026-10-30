"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { escalas, trazo } from "@/components/progress/escala";
import { fechaCorta } from "@/components/progress/estado";
import { groupSetLines } from "@/lib/history-format";
import type { PuntoMarca } from "@/lib/progress";
import type { SetLog } from "@/lib/db/types";

/**
 * Línea de marcas de un ejercicio (§11.7). Una serie, así que sin leyenda: el
 * título de la tarjeta dice qué es. Sin números en el eje — la marca no se
 * muestra (§11.1); lo que se lee al tocar un punto son las SERIES de esa sesión,
 * que son datos observados, no una fórmula.
 *
 * Colores de §10: la línea y los puntos en tinta, la referencia de la mejor marca
 * en un trazo fino de borde. Nada de acento ni rojo.
 */
const ALTO = 104;
const EJE = 18;
const PAD_X = 10;
const PAD_Y = 12;

/** "8, 6 × 170 lb" si todas las series comparten peso; si no, una por una. */
function resumenSeries(sets: SetLog[], stackLabel: string | null): string {
  const lines = groupSetLines(sets, stackLabel);
  if (lines.length === 0) return "";
  if (lines[0].isBodyweight) return `${lines.map((l) => l.repsText).join(", ")} reps`;
  const peso = lines[0].weightText;
  if (lines.every((l) => l.weightText === peso)) {
    return `${lines.map((l) => l.repsText).join(", ")} × ${peso}`;
  }
  return lines.map((l) => `${l.repsText} × ${l.weightText}`).join(" · ");
}

export function MarcaChart({
  puntos,
  mejor,
  stackLabel,
}: {
  puntos: PuntoMarca[];
  mejor: PuntoMarca;
  stackLabel: string | null;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(320);
  // Por defecto, la sesión más reciente. Se guarda la fecha y no el índice: si
  // llega una sesión nueva por la live query, la selección no salta a otra.
  const [selFecha, setSelFecha] = useState<string | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAncho(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const e = escalas(puntos, mejor.marca, { ancho, alto: ALTO, padX: PAD_X, padY: PAD_Y });
  const selIdx = Math.max(
    0,
    selFecha === null ? puntos.length - 1 : puntos.findIndex((p) => p.fecha === selFecha),
  );
  const sel = puntos[selIdx] ?? puntos[puntos.length - 1];

  // El punto más cercano en X: se apunta a una fecha, no a un punto de 8px.
  const elegir = (ev: PointerEvent<SVGSVGElement>) => {
    const x = ev.clientX - ev.currentTarget.getBoundingClientRect().left;
    let mejorIdx = 0;
    puntos.forEach((p, i) => {
      if (Math.abs(e.x(p.fecha) - x) < Math.abs(e.x(puntos[mejorIdx].fecha) - x)) mejorIdx = i;
    });
    setSelFecha(puntos[mejorIdx].fecha);
  };

  const teclas = (ev: KeyboardEvent<SVGSVGElement>) => {
    const paso = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
    if (!paso) return;
    ev.preventDefault();
    const i = Math.min(puntos.length - 1, Math.max(0, selIdx + paso));
    setSelFecha(puntos[i].fecha);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Lectura del punto elegido. Es la "tooltip" fija: en el teléfono no hay
          hover, y así el dato nunca depende de atinarle a un punto. */}
      <p className="flex items-baseline gap-2 text-sm" aria-live="polite">
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {fechaCorta(sel.fecha)}
        </span>
        <span className="min-w-0 truncate tabular-nums">{resumenSeries(sel.sets, stackLabel)}</span>
        {sel.fecha === mejor.fecha && (
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">tu mejor sesión</span>
        )}
      </p>

      <div ref={caja} className="w-full">
        <svg
          width={ancho}
          height={ALTO + EJE}
          className="block touch-pan-y outline-none"
          role="group"
          aria-label={`Marcas de ${puntos.length} sesiones. Flechas izquierda y derecha para recorrerlas.`}
          tabIndex={0}
          onPointerDown={elegir}
          onPointerMove={(ev) => ev.buttons > 0 && elegir(ev)}
          onKeyDown={teclas}
        >
          {/* Referencia: el nivel de la mejor marca. Trazo fino y sólido. */}
          <line
            x1={0}
            x2={ancho}
            y1={e.y(mejor.marca)}
            y2={e.y(mejor.marca)}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
          {/* Cruz de la selección. */}
          <line
            x1={e.x(sel.fecha)}
            x2={e.x(sel.fecha)}
            y1={0}
            y2={ALTO}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />
          <path
            d={trazo(puntos, e)}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {puntos.map((p) => (
            <circle
              key={p.fecha}
              cx={e.x(p.fecha)}
              cy={e.y(p.marca)}
              r={p.fecha === sel.fecha ? 5 : 4}
              fill="var(--ink)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
          {/* La mejor marca: un anillo alrededor de su punto. */}
          <circle
            cx={e.x(mejor.fecha)}
            cy={e.y(mejor.marca)}
            r={8}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={1.5}
          />
          <text x={PAD_X} y={ALTO + EJE - 4} fill="var(--muted)" fontSize={10} className="font-mono">
            {fechaCorta(puntos[0].fecha)}
          </text>
          <text
            x={ancho - PAD_X}
            y={ALTO + EJE - 4}
            fill="var(--muted)"
            fontSize={10}
            textAnchor="end"
            className="font-mono"
          >
            {fechaCorta(puntos[puntos.length - 1].fecha)}
          </text>
        </svg>
      </div>
    </div>
  );
}
