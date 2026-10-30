"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";

import { BalanceChart } from "@/components/progress/balance-chart";
import {
  detalleEstado,
  ESTADO_ICON,
  ESTADO_LABEL,
  estadoClass,
  fechaCorta,
} from "@/components/progress/estado";
import { Sparkline } from "@/components/progress/sparkline";
import { Button } from "@/components/ui/button";
import { loadProgreso, type ProgresoFila, type ProgresoView } from "@/lib/db/progress";
import { SEMANAS_BALANCE, type EstadoProgreso } from "@/lib/progress";
import { ProgresoSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

/**
 * Capa 2 (DECISIONES.md §11.7): ¿estoy progresando, en qué, y desde cuándo no?
 * Hechos, no consejos — la app no sugiere descargar (§11.5), igual que no sugiere
 * qué día toca (§7.5).
 */

/** Grupos en pantalla. "Sin datos suficientes" junta los dos estados sin lectura. */
const GRUPOS: { titulo: string; estados: EstadoProgreso[] }[] = [
  { titulo: ESTADO_LABEL.subiendo, estados: ["subiendo"] },
  { titulo: ESTADO_LABEL.estancado, estados: ["estancado"] },
  { titulo: ESTADO_LABEL.por_debajo, estados: ["por_debajo"] },
  { titulo: ESTADO_LABEL.sin_registrar, estados: ["sin_registrar"] },
  { titulo: "Sin datos suficientes", estados: ["pocos_datos", "sin_registros"] },
];

function subtitulo({ mesociclo, bloque }: ProgresoView): string | null {
  const partes: string[] = [];
  if (mesociclo) partes.push(mesociclo.nombre);
  if (bloque) {
    partes.push(
      bloque.enDescarga
        ? `en descarga desde el ${fechaCorta(bloque.inicio)}`
        : `semana ${bloque.semana} desde la última pausa`,
    );
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

export default function ProgresoScreen() {
  const data = useLiveQuery(() => loadProgreso(), []);

  if (data === undefined) {
    return <ProgresoSkeleton />;
  }

  const sub = subtitulo(data);
  const sinDatos = data.semanas.length === 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Progreso</h1>
          {sub && <p className="text-muted-foreground text-xs tabular-nums">{sub}</p>}
        </div>
      </header>

      {sinDatos ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay sesiones cerradas para leer progreso.
        </p>
      ) : (
        <>
          <section className="bg-surface flex flex-col gap-3 rounded-xl border p-3.5">
            <div>
              <h2 className="text-sm font-medium">Balance semanal</h2>
              <p className="text-muted-foreground text-xs">
                Mejor − peor de cada sesión, sumado por semana · últimas {SEMANAS_BALANCE}
              </p>
            </div>
            <BalanceChart semanas={data.semanas} />
          </section>

          {GRUPOS.map(({ titulo, estados }) => {
            const filas = data.filas.filter((f) => estados.includes(f.progreso.estado));
            if (filas.length === 0) return null;
            const Icon = ESTADO_ICON[estados[0]];
            return (
              <section key={titulo} className="flex flex-col gap-2">
                <h2
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    estadoClass(estados[0]),
                  )}
                >
                  {Icon && <Icon className="size-3.5" />}
                  {titulo}
                  <span className="text-muted-foreground font-normal tabular-nums">
                    · {filas.length}
                  </span>
                </h2>
                <div className="flex flex-col gap-2">
                  {filas.map((fila) => (
                    <Fila key={fila.exercise.id} fila={fila} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}

function Fila({ fila }: { fila: ProgresoFila }) {
  const { exercise, progreso } = fila;
  return (
    <Link
      href={`/ejercicio/${exercise.id}`}
      className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{exercise.nombre}</div>
        <div className="text-muted-foreground mt-0.5 text-xs tabular-nums">
          {detalleEstado(progreso)}
        </div>
      </div>
      {progreso.mejor && <Sparkline puntos={progreso.puntos} mejor={progreso.mejor.marca} />}
    </Link>
  );
}
