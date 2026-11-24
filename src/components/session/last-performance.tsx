"use client";

import Link from "next/link";

import { fechaCorta } from "@/components/progress/estado";
import type { LastPerformance as LastPerformanceData } from "@/lib/db/queries";
import type { SetLog } from "@/lib/db/types";
import { formatSetWeight } from "@/lib/units";

function formatFecha(iso: string): string {
  return fechaCorta(iso);
}

function summarize(sets: SetLog[], stackLabel: string | null): string[] {
  const groups = new Map<number, SetLog[]>();
  for (const set of sets) {
    const list = groups.get(set.set_index) ?? [];
    list.push(set);
    groups.set(set.set_index, list);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, rows]) => {
      const reps = rows
        .map((r) => (r.side ? `${r.reps}${r.side}` : String(r.reps)))
        .join(rows.some((r) => r.segment_index > 0) ? "+" : "/");
      // §4: el peso se toma del primer lado CON valor, no de rows[0] (que tras
      // compareSets es siempre L). Si L está en null y R tiene valor, mostrar el
      // valor real, no "—". Si ninguno tiene, entonces sí "—".
      const conPeso = rows.find((r) => r.weight_value !== null) ?? rows[0];
      return `${reps} × ${formatSetWeight(conPeso, stackLabel)}`;
    });
}

/**
 * Los valores de la última vez que se hizo ESTE ejercicio (DECISIONES.md §5).
 * No es un adorno: es la pantalla donde eliges el peso de la siguiente serie.
 *
 * Ya no consulta: recibe `last` de la tarjeta padre, que lo carga una sola vez
 * con `getLastPerformance` y lo reusa para el placeholder de reps (§2 / criterio
 * 11: una sola travesía). `undefined` = cargando; `null` = sin registro previo.
 */
export function LastPerformance({
  exerciseId,
  stackLabel,
  last,
}: {
  exerciseId: string;
  stackLabel: string | null;
  last: LastPerformanceData | null | undefined;
}) {
  // Cargando: esqueleto con la MISMA estructura y clases de texto que la tarjeta
  // real, así que reserva su altura EXACTA (§3). Antes devolvía `null` (cero
  // altura) y "Otra serie" —en acento— ocupaba este hueco hasta que llegaba el
  // dato: eso era el destello verde. Con el hueco reservado no hay destello ni el
  // desplazamiento de la nota "La unidad cambió…" que venía debajo. Las barras
  // van dentro de spans con las clases de texto reales para que la altura de
  // línea coincida al pixel.
  if (last === undefined) {
    return (
      <div className="pas" aria-hidden="true">
        <div className="phd">
          <span className="kick">
            <span className="sk inline-block h-[11px] w-28 align-middle" />
          </span>
          <span className="sk inline-block h-[18px] w-16" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="prow">
            <span className="ix">
              <span className="sk inline-block h-3 w-5 align-middle" />
            </span>
            <span className="fila-v">
              <span className="sk inline-block h-4 w-28 align-middle" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Si el ejercicio nunca se hizo no se pinta nada (SAYA-R2-4): «La pasada» sólo
  // aparece cuando hay algo que mostrar.
  if (last === null) return null;

  // Las series de la vez pasada por posición (1 · 2 · 3). El enlace al historial
  // completo del ejercicio se conserva — es el punto donde vas a querer más
  // contexto que la última sesión.
  return (
    <div className="pas">
      <div className="phd">
        <span className="kick">La pasada · {formatFecha(last.session.fecha)}</span>
        <Link href={`/ejercicio/${exerciseId}`} className="tl">
          Historial ›
        </Link>
      </div>
      {summarize(last.sets, stackLabel).map((valor, i) => (
        <div key={i} className="prow">
          <span className="ix">{i + 1}</span>
          <span className="fila-v">{valor}</span>
        </div>
      ))}
    </div>
  );
}
