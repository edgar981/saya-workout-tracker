"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listSessionSummaries } from "@/lib/db/queries";
import { loadSessionVerdictNets, type SessionVerdictNet } from "@/lib/db/verdicts";
import { HistorialSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

/** Día y mes para la columna izquierda (DM Mono). Partido a mano: `new Date('…')`
 *  se parsea como UTC y muestra el día anterior en América. */
function diaMes(iso: string): { dia: string; mes: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return { dia: String(d), mes: dt.toLocaleDateString("es", { month: "short" }).replace(".", "") };
}

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

/** Cuántas sesiones entran en la gráfica de constancia. */
const CHART_N = 14;

export default function HistorialScreen() {
  // Una sola query: los resúmenes y, para esos ids, el veredicto neto por sesión.
  // useLiveQuery rastrea todas las lecturas Dexie de dentro, así que reacciona a
  // cualquier cambio sin encadenar dos suscripciones.
  const data = useLiveQuery(async () => {
    const summaries = await listSessionSummaries();
    const nets = await loadSessionVerdictNets(summaries.map((s) => s.session.id));
    return { summaries, nets };
  }, []);

  if (data === undefined) {
    return <HistorialSkeleton />;
  }

  const { summaries, nets } = data;
  // summaries viene descendente por fecha: la primera sesión es la última del array.
  const primera = summaries[summaries.length - 1]?.session.fecha ?? null;
  // Gráfica: las últimas CHART_N, en orden cronológico (izq → der).
  const chart = summaries.slice(0, CHART_N).reverse();
  const maxSeries = Math.max(1, ...chart.map((s) => s.totalSeries));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Historial</h1>
          {primera && (
            <p className="text-muted-foreground text-xs tabular-nums">
              {summaries.length} {summaries.length === 1 ? "sesión" : "sesiones"} · desde el{" "}
              {fechaLarga(primera)}
            </p>
          )}
        </div>
      </header>

      {summaries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Todavía no hay sesiones registradas.</p>
      ) : (
        <>
          {/* Gráfica de constancia: cuenta SERIES por sesión, no rendimiento. Sin
              ejes, sin números, sin interacción — solo el pulso de asistencia. */}
          <section className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Series por sesión · últimas {CHART_N}</span>
            <div className="flex h-12 items-end gap-1">
              {chart.map(({ session, totalSeries }) => (
                <div key={session.id} className="flex flex-1 items-end justify-center self-stretch">
                  <div
                    className={cn(
                      "w-full rounded-sm",
                      // La sesión activa en acento (su único significado permitido);
                      // el resto en un neutro que no insinúa rendimiento.
                      session.activa === 1 ? "bg-primary" : "bg-faint",
                    )}
                    style={{ height: `${Math.max(6, (totalSeries / maxSeries) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-2">
            {summaries.map(({ session, routineDay, ejerciciosConSeries, totalSeries, tieneNota }) => {
              const { dia, mes } = diaMes(session.fecha);
              const net = nets[session.id];
              return (
                <Link
                  key={session.id}
                  href={`/historial/${session.id}`}
                  className="hover:bg-accent flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex w-9 shrink-0 flex-col items-center">
                    <span className="font-mono text-lg leading-none tabular-nums">{dia}</span>
                    <span className="text-faint mt-0.5 font-mono text-[10px] uppercase leading-none">
                      {mes}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {routineDay?.nombre ?? "Sesión libre"}
                      </span>
                      {session.activa === 1 && (
                        <Badge variant="default" className="text-[10px]">
                          abierta
                        </Badge>
                      )}
                      {tieneNota && (
                        <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                      {ejerciciosConSeries} ejercicios · {totalSeries} series
                    </div>
                  </div>

                  {net && net.comparados > 0 && <VeredictoNeto net={net} />}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

/**
 * Veredicto compacto de la fila: `mejor − peor`. Tinta plena si es positivo;
 * atenuado en cero y negativo. Nunca acento ni rojo (DECISIONES.md §10). El
 * punto tras el número avisa que hubo ejercicios sin comparación, para que el
 * neto no se lea como cobertura completa.
 */
function VeredictoNeto({ net }: { net: SessionVerdictNet }) {
  const { net: n, sinComparacion } = net;
  const texto = n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
  return (
    <span
      className={cn(
        "shrink-0 self-center font-mono text-sm tabular-nums",
        n > 0 ? "text-foreground" : "text-muted-foreground",
      )}
      title={sinComparacion > 0 ? `${sinComparacion} sin comparación` : undefined}
    >
      {texto}
      {sinComparacion > 0 && <span className="text-faint align-super text-[9px]"> •</span>}
    </span>
  );
}
