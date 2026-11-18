"use client";

import { useState } from "react";
import Link from "next/link";

import { fechaCorta } from "@/components/progress/estado";
import { decimalComa, textoAporte } from "@/lib/leer";
import { sumarDias } from "@/lib/progress";
import { redondearMedia, type Volumen, type VolumenGrupo } from "@/lib/volumen";

/**
 * Volumen por grupo muscular (DECISIONES.md §12.4), dentro de su sección en
 * Progreso. Una fila por grupo (`.l-vfila`), ordenadas: la pregunta es «¿cuál
 * recibe poco?», y lo poco queda al fondo. Sin rango de referencia — solo tus
 * números. Dos tramos por barra: directas en tinta clara, indirectas (ya
 * ponderadas a ½) en tinta tenue. Mismo par de §10 que el balance; nada de
 * acento, rojo ni verde. Una sola fila abierta a la vez.
 */

/** «4 semanas (5 oct – 1 nov)»: del primer lunes al último domingo. Con huecos
 *  o descargas en medio, el rango abarca más semanas de las que promedia. */
function ventana(tipicas: string[]): string {
  const n = tipicas.length;
  const rango = `${fechaCorta(tipicas[0])} – ${fechaCorta(sumarDias(tipicas[n - 1], 6))}`;
  return `${n} ${n === 1 ? "semana" : "semanas"} (${rango})`;
}

const media = (x: number) => decimalComa(redondearMedia(x));

export function VolumenCard({ volumen }: { volumen: Volumen }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const max = Math.max(1, ...volumen.grupos.map((g) => g.tipica));
  const sinVentana = volumen.tipicas.length === 0;

  return (
    <>
      <p className="l-s" style={{ marginBottom: 6 }}>
        {sinVentana
          ? "Todavía no hay una semana completa sin descarga para promediar."
          : `Promedio de ${ventana(volumen.tipicas)}, sin descargas. Claro: directas · tenue: indirectas, cuentan ½.`}
      </p>

      {!sinVentana &&
        volumen.grupos.map((g) => (
          <FilaGrupo
            key={g.grupo}
            grupo={g}
            max={max}
            volumen={volumen}
            abierto={abierto === g.grupo}
            alAlternar={() => setAbierto((a) => (a === g.grupo ? null : g.grupo))}
          />
        ))}

      {volumen.sinGrupo.length > 0 && (
        <>
          <p className="l-s3">
            Sin grupo, no cuentan: {volumen.sinGrupo.map((e) => e.nombre).join(", ")}.
          </p>
          <Link href="/catalogo" className="tl mt-1">
            Asignar en el catálogo.
          </Link>
        </>
      )}
    </>
  );
}

function FilaGrupo({
  grupo: g,
  max,
  volumen,
  abierto,
  alAlternar,
}: {
  grupo: VolumenGrupo;
  max: number;
  volumen: Volumen;
  abierto: boolean;
  alAlternar: () => void;
}) {
  const directo = (g.directas / max) * 100;
  const indirecto = ((g.indirectas * 0.5) / max) * 100;

  return (
    <button type="button" className="l-vfila" aria-expanded={abierto} onClick={alAlternar}>
      <span className="l-vfila-rl">
        <span className="l-vfila-t fila-t">{g.nombre}</span>
        <span className="fila-t tabular-nums">{media(g.tipica)}</span>
      </span>
      <span className="l-vbarra" aria-hidden="true">
        <i style={{ width: `${directo}%` }} />
        <u style={{ left: `${directo}%`, width: `${indirecto}%` }} />
      </span>
      {abierto && (
        <span className="l-sub block">
          {g.aportes.length === 0 ? (
            <span className="l-s">Ningún ejercicio lo trabajó en esas semanas.</span>
          ) : (
            g.aportes.map((a) => (
              <span key={a.exerciseId} className="l-s">
                {textoAporte(a)}
              </span>
            ))
          )}
          <TiraSemanas grupo={g} volumen={volumen} />
        </span>
      )}
    </button>
  );
}

/**
 * Las últimas 8 semanas del grupo (A5: se queda dentro del grupo abierto), con el
 * criterio del balance (§11.6): hueco (·) si no hubo sesiones, «desc.» si hubo
 * descarga. Una sola serie, en tinta; cada columna lleva su número, que con 8 es la
 * tabla misma. Todo con `span`: vive dentro de un botón.
 */
const ALTO_TIRA = 28;

function TiraSemanas({ grupo, volumen }: { grupo: VolumenGrupo; volumen: Volumen }) {
  const maxTira = Math.max(1, ...grupo.porSemana.map((x) => x ?? 0));

  return (
    <span className="mt-2 flex flex-col gap-1" aria-label={`${grupo.nombre}, series por semana`}>
      <span className="flex items-end gap-[2px]" style={{ height: ALTO_TIRA }}>
        {volumen.semanas.map((w, i) => {
          const v = grupo.porSemana[i];
          return (
            <span key={w.lunes} className="flex h-full flex-1 items-end justify-center">
              {v !== null && v > 0 && (
                <span
                  className="block w-full max-w-6 rounded-t-[4px]"
                  style={{
                    height: Math.max(2, (v / maxTira) * ALTO_TIRA),
                    background: "rgba(244,245,248,.75)",
                  }}
                />
              )}
            </span>
          );
        })}
      </span>
      <span className="block h-px" style={{ background: "var(--hair)" }} />
      <span className="flex gap-[2px]">
        {volumen.semanas.map((w, i) => {
          const v = grupo.porSemana[i];
          return (
            <span key={w.lunes} className="flex flex-1 flex-col items-center">
              <span
                className="text-[10px] tabular-nums"
                style={{ color: v === null ? "var(--ink3)" : "var(--ink2)" }}
              >
                {v === null ? "·" : media(v)}
              </span>
              {w.deload && (
                <span className="text-[9px] leading-none" style={{ color: "var(--ink2)" }}>
                  desc.
                </span>
              )}
            </span>
          );
        })}
      </span>
      <span className="l-eje">
        <span>{fechaCorta(volumen.semanas[0].lunes)}</span>
        <span>esta semana</span>
      </span>
    </span>
  );
}
