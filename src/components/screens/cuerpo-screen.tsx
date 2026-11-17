"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { CuerpoSkeleton } from "@/components/skeletons";
import { ESTADO_LABEL, fechaCorta } from "@/components/progress/estado";
import { PesoSheet } from "@/components/peso-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BloqueError, Vacio } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import {
  balanceDeSemana,
  contarEstados,
  dekPeso,
  etiquetaGrafica,
  formatoNeto,
  formatoPeso,
  netoDeFila,
  polilinea,
  puntosGrafica,
  resumirPeso,
  sesionesDeSemana,
  subtituloSesiones,
  teselasDeEstados,
  textoSeries,
  type PesoResumen,
} from "@/lib/cuerpo";
import { loadCuerpo, ULTIMAS_SESIONES, type CuerpoView } from "@/lib/db/cuerpo";
import { todayISO } from "@/lib/db/queries";
import { lunesDe } from "@/lib/progress";
import { cn } from "@/lib/utils";

type Lectura = { ok: true; vista: CuerpoView } | { ok: false };

export default function CuerpoScreen() {
  // «Reintentar» vuelve a correr la lectura: cambia la dependencia de la query.
  const [intento, setIntento] = useState(0);
  const lectura = useLiveQuery<Lectura>(async () => {
    try {
      return { ok: true, vista: await loadCuerpo() };
    } catch {
      return { ok: false };
    }
  }, [intento]);

  if (lectura === undefined) return <CuerpoSkeleton />;

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Cuerpo" subtitulo="Peso, sesiones y progreso" ajustes />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          {lectura.ok ? (
            <Contenido vista={lectura.vista} />
          ) : (
            <BloqueError
              titulo="No se pudieron leer tus datos de cuerpo."
              alReintentar={() => setIntento((n) => n + 1)}
            />
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

function Contenido({ vista }: { vista: CuerpoView }) {
  const { pesos, sesiones, progreso, nets } = vista;
  const [hojaPeso, setHojaPeso] = useState(false);
  const hoy = todayISO();
  const peso = resumirPeso(pesos);
  const lunes = lunesDe(hoy);

  const resumenes = sesiones.map((s) => ({
    fecha: s.session.fecha,
    nombre: s.routineDay?.nombre ?? "Sesión libre",
    abierta: s.session.activa === 1,
  }));
  const deSemana = sesionesDeSemana(resumenes, hoy);
  const balance = balanceDeSemana(progreso.semanas, hoy);
  const conteo = contarEstados(progreso.filas.map((f) => f.progreso.estado));

  const sinNada = peso === null && sesiones.length === 0;

  return (
    <>
      <Seccion titulo="Peso corporal" derecha={peso ? fechaCorta(peso.ultimaFecha) : undefined}>
        {peso ? (
          <PesoCorporal peso={peso} />
        ) : (
          <Vacio titulo="Todavía no anotaste tu peso." />
        )}
        <Button className="mt-3" onClick={() => setHojaPeso(true)}>
          Anotar peso
        </Button>
        <PesoSheet abierto={hojaPeso} alCerrar={() => setHojaPeso(false)} peso={peso} />
      </Seccion>

      {sinNada ? (
        <Seccion titulo="Sesiones">
          <Vacio titulo="Todavía no hay sesiones." />
          <div className="mt-2 flex flex-col items-start">
            <Link href="/historial" className="tl">
              Ver historial ›
            </Link>
            <Link href="/progreso" className="tl">
              Ver progreso ›
            </Link>
          </div>
        </Seccion>
      ) : (
        <>
          <Seccion titulo="Esta semana" derecha={`desde el lun ${fechaCorta(lunes)}`}>
            <Fila
              titulo="Sesiones"
              subtitulo={deSemana.length > 0 ? subtituloSesiones(deSemana) : undefined}
              valor={deSemana.length}
            />
            <Fila
              href="/progreso"
              titulo="Balance"
              subtitulo="mejor − peor, sesiones cerradas"
              valor={
                balance === null ? undefined : (
                  <span className={balance > 0 ? "text-ink" : "text-ink2"}>
                    {formatoNeto(balance)}
                  </span>
                )
              }
            />
          </Seccion>

          <Seccion titulo="Últimas sesiones">
            {sesiones.length === 0 ? (
              <Vacio titulo="Todavía no hay sesiones." />
            ) : (
              <div>
                {sesiones.slice(0, ULTIMAS_SESIONES).map((s) => {
                  const abierta = s.session.activa === 1;
                  const neto = netoDeFila(abierta, nets[s.session.id]);
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
                      subtitulo={`${fechaCorta(s.session.fecha)} · ${textoSeries(s.totalSeries)}`}
                      valor={
                        neto ? (
                          <span
                            className={cn(neto.positivo ? "text-ink" : "text-ink2")}
                            title={
                              neto.sinComparacion > 0
                                ? `${neto.sinComparacion} sin comparación`
                                : undefined
                            }
                          >
                            {neto.texto}
                            {neto.sinComparacion > 0 && (
                              <span
                                className="align-super text-[9px]"
                                style={{ color: "var(--ink3)" }}
                              >
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
              </div>
            )}
            <Link href="/historial" className="tl mt-1">
              Ver historial ›
            </Link>
          </Seccion>

          <Seccion
            titulo="Estados"
            derecha={`${conteo.conSeries} ${conteo.conSeries === 1 ? "ejercicio" : "ejercicios"} con series`}
          >
            <div className="teselas">
              {teselasDeEstados(conteo).map((t) => (
                <Tesela key={t.estado} cuenta={t.cuenta} etiqueta={ESTADO_LABEL[t.estado]} />
              ))}
            </div>
            <Link href="/progreso" className="tl mt-1">
              Ver progreso ›
            </Link>
          </Seccion>
        </>
      )}
    </>
  );
}

function Tesela({ cuenta, etiqueta }: { cuenta: number; etiqueta: string }) {
  return (
    <div className="tesela">
      <span className="tesela-n">{cuenta}</span>
      <span className="tesela-l">{etiqueta}</span>
    </div>
  );
}

function PesoCorporal({ peso }: { peso: PesoResumen }) {
  const puntos = puntosGrafica(peso.serie.map((p) => p.valor));
  const ultimoPunto = puntos?.[puntos.length - 1];
  const primera = peso.serie[0];
  const ultima = peso.serie[peso.serie.length - 1];
  return (
    <>
      <p className="cifra">
        {formatoPeso(peso.ultimo)} <span className="cifra-u">{peso.unidad}</span>
      </p>
      <p className="dek">{dekPeso(peso, fechaCorta)}</p>
      {puntos && ultimoPunto && (
        <svg
          viewBox="0 0 350 74"
          width="100%"
          role="img"
          aria-label={etiquetaGrafica(peso, fechaCorta)}
          style={{ display: "block", marginTop: 12 }}
        >
          <polyline
            points={polilinea(puntos)}
            fill="none"
            stroke="rgba(244,245,248,.85)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={ultimoPunto.x} cy={ultimoPunto.y} r={3.5} fill="#F4F5F8" />
          <text x={4} y={72} fontSize={11} fontWeight={400} style={{ fill: "var(--ink3)" }}>
            {fechaCorta(primera.fecha)}
          </text>
          <text
            x={346}
            y={72}
            textAnchor="end"
            fontSize={11}
            fontWeight={400}
            style={{ fill: "var(--ink3)" }}
          >
            {fechaCorta(ultima.fecha)}
          </text>
        </svg>
      )}
    </>
  );
}
