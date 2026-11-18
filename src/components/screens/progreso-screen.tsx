"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { BalanceChart } from "@/components/progress/balance-chart";
import { detalleEstado, ESTADO_LABEL, fechaCorta } from "@/components/progress/estado";
import { VolumenCard } from "@/components/progress/volumen-card";
import { ProgresoSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { BloqueError, Vacio } from "@/components/ui/estados";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { contarEstados, teselasDeEstados } from "@/lib/cuerpo";
import { loadProgreso, type ProgresoView } from "@/lib/db/progress";
import { cuentaEstados } from "@/lib/leer";
import type { EstadoProgreso } from "@/lib/progress";

/**
 * Capa 2 (DECISIONES.md §11.7): ¿estoy progresando, en qué, y desde cuándo no?
 * Hechos, no consejos — la app no sugiere descargar (§11.5), igual que no sugiere
 * qué día toca (§7.5).
 */

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

type Lectura = { ok: true; vista: ProgresoView } | { ok: false };

export default function ProgresoScreen() {
  // «Reintentar» vuelve a correr la lectura: cambia la dependencia de la query.
  const [intento, setIntento] = useState(0);
  const lectura = useLiveQuery<Lectura>(async () => {
    try {
      return { ok: true, vista: await loadProgreso() };
    } catch {
      return { ok: false };
    }
  }, [intento]);

  if (lectura === undefined) return <ProgresoSkeleton />;

  const vacio = lectura.ok && lectura.vista.semanas.length === 0;
  const sub = !lectura.ok
    ? undefined
    : vacio
      ? "Sin sesiones cerradas"
      : (subtitulo(lectura.vista) ?? undefined);

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Progreso" subtitulo={sub} empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          {!lectura.ok ? (
            <BloqueError
              titulo="No se pudo calcular tu progreso."
              alReintentar={() => setIntento((n) => n + 1)}
            />
          ) : vacio ? (
            <Vacio
              titulo="Todavía no hay sesiones cerradas."
              texto="El balance, los estados y el volumen salen de las sesiones que cierres."
              salida={
                <Button asChild variant="secondary">
                  <Link href="/">Ir a Hoy</Link>
                </Button>
              }
            />
          ) : (
            <Contenido vista={lectura.vista} />
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

function Contenido({ vista }: { vista: ProgresoView }) {
  // Una sola tesela abierta a la vez; tocar la abierta la cierra.
  const [abierto, setAbierto] = useState<EstadoProgreso | null>(null);

  const estados = vista.filas.map((f) => f.progreso.estado);
  const cuenta = cuentaEstados(vista.filas.map((f) => ({ estado: f.progreso.estado })));
  const teselas = teselasDeEstados(contarEstados(estados));
  const filasAbiertas = abierto ? vista.filas.filter((f) => f.progreso.estado === abierto) : [];

  return (
    <>
      <Seccion titulo="Balance por semana" derecha="mejor − peor">
        <BalanceChart semanas={vista.semanas} />
      </Seccion>

      <Seccion titulo="Estados" derecha={cuenta.texto}>
        <div className="teselas">
          {teselas.map((t) => (
            <button
              key={t.estado}
              type="button"
              className="tesela"
              aria-expanded={abierto === t.estado}
              disabled={t.cuenta === 0}
              onClick={() => setAbierto((a) => (a === t.estado ? null : t.estado))}
            >
              <span className="tesela-n">{t.cuenta}</span>
              <span className="tesela-l">{ESTADO_LABEL[t.estado]}</span>
            </button>
          ))}
        </div>
        {abierto === null ? (
          <p className="l-s3">Toca un estado para ver qué ejercicios están en él.</p>
        ) : (
          <div className="l-sub" style={{ marginTop: 14 }}>
            {filasAbiertas.map((f) => (
              <Link key={f.exercise.id} href={`/ejercicio/${f.exercise.id}`} className="l-s">
                <span className="l-tinta">{f.exercise.nombre}</span> · {detalleEstado(f.progreso)}
              </Link>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Volumen por grupo" derecha="series / semana">
        <VolumenCard volumen={vista.volumen} />
      </Seccion>
    </>
  );
}
