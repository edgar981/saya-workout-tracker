"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { fechaCorta } from "@/components/progress/estado";
import { sumarDias } from "@/lib/progress";
import { redondearMedia, type Volumen, type VolumenGrupo } from "@/lib/volumen";
import { cn } from "@/lib/utils";

/**
 * Volumen por grupo muscular (DECISIONES.md §12.4). Barras horizontales
 * ordenadas: la pregunta es "¿cuál recibe poco?", y lo poco queda al fondo. Sin
 * rango de referencia — solo tus números.
 *
 * Dos tramos por barra, con leyenda: directo en tinta, indirecto (ya ponderado a
 * ½) atenuado. Mismo par de §10 que el balance; nada de acento ni rojo. 2px de
 * superficie entre tramos y el extremo de dato redondeado.
 */

/** "11.5" · "4" — medias series, que es la resolución del conteo. */
function series(x: number): string {
  return String(redondearMedia(x));
}

/** "4 semanas (5 oct – 1 nov)": del primer lunes al último domingo. Con huecos
 *  o descargas en medio, el rango abarca más semanas de las que promedia. */
function ventana(tipicas: string[]): string {
  const n = tipicas.length;
  const rango = `${fechaCorta(tipicas[0])} – ${fechaCorta(sumarDias(tipicas[n - 1], 6))}`;
  return `${n} ${n === 1 ? "semana" : "semanas"} (${rango})`;
}

export function VolumenCard({ volumen }: { volumen: Volumen }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const max = Math.max(1, ...volumen.grupos.map((g) => g.tipica));
  const sinVentana = volumen.tipicas.length === 0;

  return (
    <section className="bg-surface flex flex-col gap-3 rounded-xl border p-3.5">
      <div>
        <h2 className="text-sm font-medium">Volumen por grupo muscular</h2>
        <p className="text-muted-foreground text-xs">
          {sinVentana
            ? "Todavía no hay una semana completa sin descarga para promediar."
            : `Series por semana · promedio de ${ventana(volumen.tipicas)}, sin descargas`}
        </p>
      </div>

      {!sinVentana && (
        <>
          <div className="text-muted-foreground flex items-center gap-3 text-xs" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="bg-foreground h-2 w-3 rounded-[2px]" /> directo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-muted-foreground h-2 w-3 rounded-[2px]" /> indirecto, cuenta ½
            </span>
          </div>

          <ul className="-mx-1.5 flex flex-col">
            {volumen.grupos.map((g) => (
              <FilaGrupo
                key={g.grupo}
                grupo={g}
                max={max}
                volumen={volumen}
                abierto={abierto === g.grupo}
                onToggle={() => setAbierto((a) => (a === g.grupo ? null : g.grupo))}
              />
            ))}
          </ul>
        </>
      )}

      {volumen.sinGrupo.length > 0 && (
        <Link
          href="/catalogo"
          className="hover:bg-accent -mx-1.5 flex items-start gap-2 rounded-md px-1.5 py-1.5 text-xs"
        >
          <span className="text-muted-foreground min-w-0 flex-1">
            <span className="text-foreground font-medium">Sin grupo, no cuentan: </span>
            {volumen.sinGrupo
              .map((e) => `${e.nombre} (${e.series} ${e.series === 1 ? "serie" : "series"})`)
              .join(" · ")}
            {` en ${volumen.semanas.length} semanas. Asignar en el catálogo.`}
          </span>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </Link>
      )}
    </section>
  );
}

function FilaGrupo({
  grupo: g,
  max,
  volumen,
  abierto,
  onToggle,
}: {
  grupo: VolumenGrupo;
  max: number;
  volumen: Volumen;
  abierto: boolean;
  onToggle: () => void;
}) {
  const directo = (g.directas / max) * 100;
  const indirecto = ((g.indirectas * 0.5) / max) * 100;
  const panel = `volumen-${g.grupo}`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={panel}
        className="hover:bg-accent flex min-h-10 w-full items-center gap-3 rounded-md px-1.5 text-left"
      >
        <span className="w-[6.5rem] shrink-0 truncate text-sm">{g.nombre}</span>
        <span className="flex h-2 min-w-0 flex-1 gap-[2px]" aria-hidden>
          {g.directas > 0 && (
            <span
              className={cn("bg-foreground h-full", g.indirectas === 0 && "rounded-r-[4px]")}
              style={{ width: `${directo}%` }}
            />
          )}
          {g.indirectas > 0 && (
            <span
              className="bg-muted-foreground h-full rounded-r-[4px]"
              style={{ width: `${indirecto}%` }}
            />
          )}
        </span>
        <span
          className={cn(
            "w-9 shrink-0 text-right font-mono text-sm tabular-nums",
            g.tipica === 0 && "text-faint",
          )}
        >
          {series(g.tipica)}
        </span>
        <span className="sr-only">
          series por semana: {series(g.directas)} directas, {series(g.indirectas)} indirectas
        </span>
        <ChevronDown
          className={cn("text-muted-foreground size-4 shrink-0", abierto && "rotate-180")}
        />
      </button>

      {abierto && (
        <div id={panel} className="flex flex-col gap-3 px-1.5 pt-1 pb-3">
          <TiraSemanas grupo={g} volumen={volumen} />
          {g.aportes.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Ningún ejercicio lo trabajó en esas semanas.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {g.aportes.map((a) => (
                <li key={a.exerciseId} className="flex items-baseline gap-2 text-xs">
                  <Link
                    href={`/ejercicio/${a.exerciseId}`}
                    className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                  >
                    {a.nombre}
                  </Link>
                  {a.rol === "indirecto" && <span className="text-muted-foreground">indirecto</span>}
                  <span className="w-14 shrink-0 text-right font-mono tabular-nums">
                    {series(a.series)}/sem
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Las últimas 8 semanas del grupo, con el criterio del balance (§11.6): hueco (·)
 * si no hubo sesiones, "desc." si hubo descarga. Una sola serie, en tinta; cada
 * columna lleva su número, que con 8 es la tabla misma. La descarga la marca el
 * rótulo, no el color: el atenuado ya significa "indirecto" en la barra de arriba.
 */
const ALTO_TIRA = 28;

function TiraSemanas({ grupo, volumen }: { grupo: VolumenGrupo; volumen: Volumen }) {
  const maxTira = Math.max(1, ...grupo.porSemana.map((x) => x ?? 0));

  return (
    <div className="flex flex-col gap-1" aria-label={`${grupo.nombre}, series por semana`}>
      <div className="flex items-end gap-[2px]" style={{ height: ALTO_TIRA }}>
        {volumen.semanas.map((w, i) => {
          const v = grupo.porSemana[i];
          return (
            <div key={w.lunes} className="flex h-full flex-1 items-end justify-center">
              {v !== null && v > 0 && (
                <div
                  className="bg-foreground w-full max-w-6 rounded-t-[4px]"
                  style={{ height: Math.max(2, (v / maxTira) * ALTO_TIRA) }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="bg-border-strong h-px" />
      <div className="flex gap-[2px]">
        {volumen.semanas.map((w, i) => {
          const v = grupo.porSemana[i];
          return (
            <div key={w.lunes} className="flex flex-1 flex-col items-center">
              <span
                className={cn(
                  "font-mono text-[10px] tabular-nums",
                  v === null ? "text-faint" : "text-muted-foreground",
                )}
              >
                {v === null ? "·" : series(v)}
              </span>
              {w.deload && (
                <span className="text-muted-foreground text-[9px] leading-none">desc.</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-muted-foreground flex justify-between font-mono text-[10px]">
        <span>{fechaCorta(volumen.semanas[0].lunes)}</span>
        <span>esta semana</span>
      </div>
    </div>
  );
}
