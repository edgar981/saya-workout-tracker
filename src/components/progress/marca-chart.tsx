"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

import { fechaCorta } from "@/components/progress/estado";
import { groupSetLines } from "@/lib/history-format";
import { puntosLinea, type DescargaEnLinea } from "@/lib/leer";
import type { PuntoMarca } from "@/lib/progress";
import type { SetLog } from "@/lib/db/types";

/**
 * Línea de marcas de un ejercicio (§11.7). Una serie, así que sin leyenda. Sin
 * ningún número en el eje ni en los puntos — la marca no se muestra (§11.1); lo
 * que se lee al tocar un punto son las SERIES de esa sesión, que son datos
 * observados, no una fórmula.
 *
 * Colores de §10: la línea y los puntos en tinta; las descargas, en contorno
 * discontinuo, fuera de la línea. Nada de acento, rojo ni verde. Un `viewBox`
 * fijo (350 × 158): escala solo, sin `ResizeObserver`. Las coordenadas salen de
 * `puntosLinea` (lib/leer.ts), que tiene sus pruebas.
 */

/** "8, 6 × 170 lb" si todas las series comparten peso; si no, una por una. */
export function resumenSeries(sets: SetLog[], stackLabel: string | null): string {
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
  descargas = [],
}: {
  puntos: PuntoMarca[];
  mejor: PuntoMarca;
  stackLabel: string | null;
  descargas?: DescargaEnLinea[];
}) {
  // Por defecto, la sesión más reciente. Se guarda la fecha y no el índice: si
  // llega una sesión nueva por la live query, la selección no salta a otra.
  const [selFecha, setSelFecha] = useState<string | null>(null);

  const linea = puntosLinea(puntos, descargas);
  const selIdx = Math.max(
    0,
    selFecha === null ? puntos.length - 1 : puntos.findIndex((p) => p.fecha === selFecha),
  );
  const sel = puntos[selIdx] ?? puntos[puntos.length - 1];
  const xDe = (fecha: string) =>
    linea.elementos.find((e) => e.tipo === "punto" && e.fecha === fecha)?.x ?? 0;
  const yDe = (fecha: string) =>
    linea.elementos.find((e) => e.tipo === "punto" && e.fecha === fecha)?.y ?? 0;

  // El punto más cercano en X (en coordenadas del viewBox): se apunta a una
  // fecha, no a un punto de 6px.
  const elegir = (ev: PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    if (r.width === 0) return;
    const x = ((ev.clientX - r.left) / r.width) * 350;
    let mejorIdx = 0;
    puntos.forEach((p, i) => {
      if (Math.abs(xDe(p.fecha) - x) < Math.abs(xDe(puntos[mejorIdx].fecha) - x)) mejorIdx = i;
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
    <div>
      {/* Lectura del punto elegido. Es la "tooltip" fija: en el teléfono no hay
          hover, y así el dato nunca depende de atinarle a un punto. */}
      <p className="l-s mt-3 flex items-baseline gap-2" aria-live="polite">
        <span className="shrink-0 tabular-nums">{fechaCorta(sel.fecha)}</span>
        <span className="l-tinta min-w-0 truncate tabular-nums">
          {resumenSeries(sel.sets, stackLabel)}
        </span>
        {sel.fecha === mejor.fecha && <span className="ml-auto shrink-0">tu mejor sesión</span>}
      </p>

      <svg
        className="l-linea touch-pan-y outline-none"
        viewBox="0 0 350 158"
        role="group"
        aria-label={`Marcas de ${puntos.length} sesiones. Flechas izquierda y derecha para recorrerlas.`}
        tabIndex={0}
        onPointerDown={elegir}
        onPointerMove={(ev) => ev.buttons > 0 && elegir(ev)}
        onKeyDown={teclas}
      >
        {[14, 70, 126].map((y) => (
          <line key={y} x1={14} x2={336} y1={y} y2={y} stroke="rgba(255,255,255,.08)" strokeWidth={1} />
        ))}
        <polyline
          points={linea.polilinea}
          fill="none"
          stroke="rgba(244,245,248,.9)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {linea.elementos
          .filter((e) => e.tipo === "punto")
          .map((e) => (
            <circle
              key={`p-${e.fecha}`}
              cx={e.x}
              cy={e.y}
              r={e.fecha === sel.fecha ? 4.5 : 3}
              fill="#F4F5F8"
            />
          ))}
        {/* La mejor sesión: un aro alrededor de su punto. */}
        <circle
          cx={xDe(mejor.fecha)}
          cy={yDe(mejor.fecha)}
          r={7.5}
          fill="none"
          stroke="#F4F5F8"
          strokeWidth={1.5}
        />
        {linea.elementos
          .filter((e) => e.tipo === "descarga")
          .map((e) => (
            <g key={`d-${e.fecha}`}>
              <circle
                cx={e.x}
                cy={e.y}
                r={4}
                fill="none"
                stroke="rgba(238,240,246,.66)"
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
              <text x={e.x} y={e.yTexto ?? e.y + 18} textAnchor="middle">
                descarga
              </text>
            </g>
          ))}
        {linea.primera && (
          <text x={14} y={154}>
            {fechaCorta(linea.primera)}
          </text>
        )}
        {linea.ultima && (
          <text x={336} y={154} textAnchor="end">
            {fechaCorta(linea.ultima)}
          </text>
        )}
      </svg>
    </div>
  );
}
