"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { BalanceChart } from "@/components/progress/balance-chart";
import { detalleEstado, ESTADO_LABEL, fechaCorta } from "@/components/progress/estado";
import { ProgresoCargando } from "@/components/progress/progreso-cargando";
import { celdasDeSemana, signo, subtituloProgreso, textoSemana } from "@/components/progress/semanas";
import { loadSemanasDias, type SemanasDias } from "@/components/progress/semanas-dias";
import { VolumenCard } from "@/components/progress/volumen-card";
import { BloqueError } from "@/components/ui/estados";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { Panel } from "@/components/ui/panel";
import { contarEstados, teselasDeEstados } from "@/lib/cuerpo";
import { loadProgreso, type ProgresoView } from "@/lib/db/progress";
import { cuentaEstados } from "@/lib/leer";
import type { EstadoProgreso } from "@/lib/progress";

/**
 * Capa 2 (DECISIONES.md §11.7): ¿estoy progresando, en qué, y desde cuándo no?
 * Hechos, no consejos — la app no sugiere descargar (§11.5), igual que no sugiere
 * qué día toca (§7.5). Ronda 2 «Semanas» (SAYA-R2-5): el balance se recorre y
 * elige una semana; sus celdas, los estados y el volumen abren su hoja.
 */

type Lectura = { ok: true; vista: ProgresoView; extra: SemanasDias } | { ok: false };

export default function ProgresoScreen() {
  // «Reintentar» vuelve a correr la lectura: cambia la dependencia de la query.
  const [intento, setIntento] = useState(0);
  const lectura = useLiveQuery<Lectura>(async () => {
    try {
      const [vista, extra] = await Promise.all([loadProgreso(), loadSemanasDias()]);
      return { ok: true, vista, extra };
    } catch {
      return { ok: false };
    }
  }, [intento]);

  if (lectura === undefined) return <ProgresoCargando />;

  const vacio = lectura.ok && lectura.vista.semanas.length === 0;
  const sub = !lectura.ok
    ? undefined
    : vacio
      ? "Sin sesiones cerradas"
      : subtituloProgreso(lectura.extra.cerradas, lectura.extra.primera, fechaCorta);

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Progreso" subtitulo={sub} />
      </div>
      <Hoja>
        <main className="pro mx-auto w-full max-w-md px-4 pb-4">
          {!lectura.ok ? (
            <Seccion primera indice={1}>
              <BloqueError
                titulo="No se pudo calcular tu progreso."
                alReintentar={() => setIntento((n) => n + 1)}
              />
            </Seccion>
          ) : (
            <Contenido vista={lectura.vista} extra={lectura.extra} vacio={vacio} />
          )}
        </main>
      </Hoja>
    </>
  );
}

function Seccion({
  titulo,
  derecha,
  primera,
  indice,
  children,
}: {
  titulo?: string;
  derecha?: ReactNode;
  primera?: boolean;
  indice: number;
  children: ReactNode;
}) {
  return (
    <section
      className={primera ? "sec first rise" : "sec rise"}
      style={{ "--i": indice } as CSSProperties}
    >
      {titulo !== undefined && (
        <h2 className="kick">
          {titulo}
          {derecha != null && <span className="r">{derecha}</span>}
        </h2>
      )}
      {children}
    </section>
  );
}

function Contenido({
  vista,
  extra,
  vacio,
}: {
  vista: ProgresoView;
  extra: SemanasDias;
  vacio: boolean;
}) {
  // La semana elegida se recuerda por su lunes; si ya no está, vuelve a la última.
  const [lunes, setLunes] = useState<string | null>(null);
  // Una sola hoja de estado abierta a la vez.
  const [abierto, setAbierto] = useState<EstadoProgreso | null>(null);

  const { semanas } = vista;
  const hallada = lunes === null ? -1 : semanas.findIndex((s) => s.lunes === lunes);
  const sel = hallada >= 0 ? hallada : semanas.length - 1;
  const semana = semanas[sel];

  const estados = vista.filas.map((f) => f.progreso.estado);
  const cuenta = cuentaEstados(vista.filas.map((f) => ({ estado: f.progreso.estado })));
  const teselas = teselasDeEstados(contarEstados(estados));
  const filasAbiertas = abierto ? vista.filas.filter((f) => f.progreso.estado === abierto) : [];

  const celdas = celdasDeSemana(
    extra.dias,
    semana ? (extra.porSemana[semana.lunes] ?? []) : [],
    fechaCorta,
  );
  const hueco = semana !== undefined && semana.sesiones === 0;

  return (
    <>
      <Seccion titulo="Balance por semana" primera indice={1}>
        <div className="readout">
          {semana === undefined || hueco ? (
            <span className="fig mut">—</span>
          ) : (
            <span className={semana.net <= 0 ? "fig mut" : "fig"}>{signo(semana.net)}</span>
          )}
          {semana !== undefined && <span className="s">{textoSemana(semana, fechaCorta)}</span>}
        </div>
        {vacio ? (
          <div className="efr">—</div>
        ) : (
          <BalanceChart semanas={semanas} sel={sel} alElegir={(i) => setLunes(semanas[i].lunes)} />
        )}
        {extra.dias.length > 0 && (
          <div className="wsl" style={{ "--r25-dias": extra.dias.length } as CSSProperties}>
            {celdas.map((c) =>
              c.vacia || vacio ? (
                <span key={c.dia.id} className="wc no">
                  <b>—</b>
                  <span>{c.dia.nombre}</span>
                  <span>&nbsp;</span>
                </span>
              ) : (
                <Link
                  key={c.dia.id}
                  href={`/historial/${c.sessionId}`}
                  className="wc"
                  aria-label={c.aria}
                >
                  <b className={c.mut ? "mut" : undefined}>{c.texto}</b>
                  <span>{c.dia.nombre}</span>
                  <span>{c.corta}</span>
                </Link>
              ),
            )}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Estados" derecha={vacio ? undefined : cuenta.texto} indice={2}>
        <div className="est" style={{ "--r25-teselas": teselas.length } as CSSProperties}>
          {teselas.map((t) => (
            <button
              key={t.estado}
              type="button"
              disabled={vacio || t.cuenta === 0}
              onClick={() => setAbierto(t.estado)}
            >
              <b className={vacio ? "mut" : undefined}>{vacio ? "—" : t.cuenta}</b>
              <span>{ESTADO_LABEL[t.estado]}</span>
            </button>
          ))}
        </div>
        <Panel
          abierto={abierto !== null}
          alCerrar={() => setAbierto(null)}
          titulo={abierto ? ESTADO_LABEL[abierto] : ""}
          className="pro-hoja"
        >
          <p className="s r25-sub">
            {filasAbiertas.length} {filasAbiertas.length === 1 ? "ejercicio" : "ejercicios"}
          </p>
          <div className="rows">
            {filasAbiertas.map((f) => (
              <Link key={f.exercise.id} href={`/ejercicio/${f.exercise.id}`} className="row">
                <span className="m">
                  <span className="t">{f.exercise.nombre}</span>
                  <span className="s">{detalleEstado(f.progreso)}</span>
                </span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </Seccion>

      <Seccion titulo="Volumen por grupo" derecha="series / semana" indice={3}>
        <VolumenCard volumen={vista.volumen} filas={vista.filas} vacio={vacio} />
      </Seccion>
    </>
  );
}
