"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { HistorialSkeleton } from "@/components/skeletons";
import { fechaCorta } from "@/components/progress/estado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BloqueError, Vacio } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { formatoNeto } from "@/lib/cuerpo";
import { listSessionSummaries, type SessionSummary } from "@/lib/db/queries";
import { loadSessionVerdictNets, type SessionVerdictNet } from "@/lib/db/verdicts";
import {
  barrasHistorial,
  cabezaHistorial,
  semanasHistorial,
  subtituloFila,
} from "@/lib/leer";
import { TAG_DELOAD } from "@/lib/progress";
import { cn } from "@/lib/utils";

type Lectura =
  | { ok: true; summaries: SessionSummary[]; nets: Record<string, SessionVerdictNet> }
  | { ok: false };

export default function HistorialScreen() {
  // «Reintentar» vuelve a correr la lectura: cambia la dependencia de la query.
  const [intento, setIntento] = useState(0);
  // Una sola query: los resúmenes y, para esos ids, el veredicto neto por sesión.
  // useLiveQuery rastrea todas las lecturas Dexie de dentro, así que reacciona a
  // cualquier cambio sin encadenar dos suscripciones.
  const lectura = useLiveQuery<Lectura>(async () => {
    try {
      const summaries = await listSessionSummaries();
      const nets = await loadSessionVerdictNets(summaries.map((s) => s.session.id));
      return { ok: true, summaries, nets };
    } catch {
      return { ok: false };
    }
  }, [intento]);

  if (lectura === undefined) return <HistorialSkeleton />;

  const sinSesiones = lectura.ok && lectura.summaries.length === 0;
  const subtitulo = !lectura.ok
    ? undefined
    : sinSesiones
      ? "Sin sesiones"
      : (cabezaHistorial(
          lectura.summaries.map((s) => ({ fecha: s.session.fecha, abierta: s.session.activa === 1 })),
          fechaCorta,
        ) ?? undefined);

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Historial" subtitulo={subtitulo} empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          {!lectura.ok ? (
            <BloqueError
              titulo="No se pudo leer el historial."
              alReintentar={() => setIntento((n) => n + 1)}
            />
          ) : sinSesiones ? (
            <Vacio
              titulo="Todavía no hay sesiones."
              texto="Cuando cierres tu primera sesión aparece aquí, con sus series."
              salida={
                <Button asChild variant="secondary">
                  <Link href="/">Ir a Hoy</Link>
                </Button>
              }
            />
          ) : (
            <Contenido summaries={lectura.summaries} nets={lectura.nets} />
          )}
        </main>
      </Hoja>
    </>
  );
}

function Seccion({
  titulo,
  derecha,
  children,
}: {
  titulo: string;
  derecha?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="sec">
      <div className="sec-cab">
        <h2 className="kicker">{titulo}</h2>
        {derecha != null && <span className="kicker kicker-d">{derecha}</span>}
      </div>
      {children}
    </section>
  );
}

function Contenido({
  summaries,
  nets,
}: {
  summaries: SessionSummary[];
  nets: Record<string, SessionVerdictNet>;
}) {
  const filas = summaries.map((s) => ({
    resumen: s,
    fecha: s.session.fecha,
    abierta: s.session.activa === 1,
    deload: s.session.tag_ids.includes(TAG_DELOAD),
    totalSeries: s.totalSeries,
  }));
  const barras = barrasHistorial(filas);
  const semanas = semanasHistorial(filas);

  return (
    <>
      <Seccion titulo="Series por sesión" derecha={`últimas ${barras.n}`}>
        <div className="l-barras" role="img" aria-label={barras.etiqueta}>
          {barras.barras.map((b, i) => (
            <i key={i} className={b.clase || undefined} style={{ height: `${b.alto}%` }} />
          ))}
        </div>
        {barras.primera && barras.ultima && (
          <div className="l-eje">
            <span>{fechaCorta(barras.primera)}</span>
            <span>{fechaCorta(barras.ultima)}</span>
          </div>
        )}
        <p className="dek mt-3">
          El número de cada sesión es mejor − peor: ejercicios que subieron menos los que bajaron,
          contra su sesión comparable anterior.
        </p>
      </Seccion>

      {semanas.map((semana) => (
        <Seccion
          key={semana.lunes}
          titulo={`Semana del ${fechaCorta(semana.lunes)}${semana.deload ? " · descarga" : ""}`}
        >
          {semana.items.map(({ resumen: s, abierta }) => {
            const net = nets[s.session.id];
            const mostrarNeto = !abierta && net !== undefined && net.comparados > 0;
            return (
              <Fila
                key={s.session.id}
                href={`/historial/${s.session.id}`}
                titulo={
                  <>
                    {s.routineDay?.nombre ?? "Sesión libre"}
                    {abierta && (
                      <Badge className="text-ink ml-2 align-middle">
                        <span className="vivo" aria-hidden="true" />
                        abierta
                      </Badge>
                    )}
                  </>
                }
                subtitulo={subtituloFila(
                  {
                    fecha: s.session.fecha,
                    abierta,
                    ejerciciosConSeries: s.ejerciciosConSeries,
                    totalSeries: s.totalSeries,
                    tags: s.tags.map((t) => t.nombre),
                    tieneNota: s.tieneNota,
                  },
                  fechaCorta,
                )}
                valor={
                  mostrarNeto ? (
                    <span
                      className={cn(net.net > 0 ? "l-up" : "l-dn")}
                      title={net.sinComparacion > 0 ? `${net.sinComparacion} sin comparación` : undefined}
                    >
                      {formatoNeto(net.net)}
                      {net.sinComparacion > 0 && (
                        <span className="align-super text-[9px]" style={{ color: "var(--ink3)" }}>
                          {" "}
                          •
                        </span>
                      )}
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </Seccion>
      ))}
    </>
  );
}
