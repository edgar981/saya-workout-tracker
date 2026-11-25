"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  CuentaSheet,
  DeudaSheet,
  SaldoSheet,
  type DuenoSaldo,
} from "@/components/dinero-sheets";
import { DineroSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { BloqueError, Vacio } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { Aviso } from "@/components/ui/panel";
import { todayISO } from "@/lib/db/queries";
import { leerCuentas, leerDeudas } from "@/lib/dinero/cliente";
import {
  deudasVisibles,
  disponible,
  fechaDePago,
  formatoCOP,
  interesesDelMes,
  lineaCuenta,
  lineaDeuda,
  loQueDebes,
  mesAnterior,
  mesNombre,
  nombreLargo,
  pagosDelMes,
  plural,
  progresoDeuda,
  quedanDespuesDePagar,
} from "@/lib/dinero/resumen";
import type { CuentaDto, DeudaDto, SaldoAnotadoDto } from "@/lib/dinero/servidor";

/** Cuánto dura el aviso. */
const AVISO_MS = 3500;

/**
 * `deudas` es `null` cuando sólo ellas fallaron (`deudas-error`): las cuentas siguen.
 * Si fallan las cuentas es `error`, de las dos lecturas.
 */
type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "datos"; cuentas: CuentaDto[]; deudas: DeudaDto[] | null };

type HojaAbierta = { tipo: "saldo"; inicial: DuenoSaldo | null } | { tipo: "cuenta" } | { tipo: "deuda" } | null;

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function DineroScreen() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  // «Reintentar» vuelve a leer: cambia la dependencia del efecto.
  const [intento, setIntento] = useState(0);
  const [hoy] = useState(() => todayISO());
  const [hoja, setHoja] = useState<HojaAbierta>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    const control = new AbortController();
    // Las dos lecturas, por separado: si fallan sólo las deudas, las cuentas siguen.
    void Promise.all([
      leerCuentas({ signal: control.signal }),
      leerDeudas({ signal: control.signal }),
    ]).then(([c, d]) => {
      if (control.signal.aborted) return;
      setEstado(
        c.ok
          ? { tipo: "datos", cuentas: c.datos.cuentas, deudas: d.ok ? d.datos.deudas : null }
          : { tipo: "error" },
      );
    });
    return () => control.abort();
  }, [intento]);

  useEffect(() => {
    if (aviso === null) return;
    const t = window.setTimeout(() => setAviso(null), AVISO_MS);
    return () => window.clearTimeout(t);
  }, [aviso]);

  /** Vuelve a leer sólo las deudas (`deudas-error`). */
  const reintentarDeudas = useCallback(() => {
    void leerDeudas().then((d) => {
      if (!montado.current || !d.ok) return;
      setEstado((previo) =>
        previo.tipo === "datos" ? { ...previo, deudas: d.datos.deudas } : previo,
      );
    });
  }, []);

  if (estado.tipo === "cargando") return <DineroSkeleton />;

  const guardarCuenta = (cuenta: CuentaDto) => {
    setEstado((previo) =>
      previo.tipo !== "datos" || previo.cuentas.some((c) => c.id === cuenta.id)
        ? previo
        : { ...previo, cuentas: [...previo.cuentas, cuenta] },
    );
    setAviso(`Cuenta de ${cuenta.banco} agregada.`);
  };

  const guardarDeuda = (deuda: DeudaDto) => {
    setEstado((previo) =>
      previo.tipo !== "datos" || previo.deudas === null || previo.deudas.some((d) => d.id === deuda.id)
        ? previo
        : { ...previo, deudas: [...previo.deudas, deuda] },
    );
    setAviso(`${deuda.nombre}: deuda agregada.`);
  };

  const guardarSaldo = (s: SaldoAnotadoDto) => {
    const saldo = { id: s.id, valor: s.valor, anotado_en: s.anotado_en };
    setEstado((previo) => {
      if (previo.tipo !== "datos") return previo;
      return {
        tipo: "datos",
        cuentas:
          s.cuenta_id === undefined
            ? previo.cuentas
            : previo.cuentas.map((c) => (c.id === s.cuenta_id ? { ...c, saldo } : c)),
        deudas:
          s.deuda_id === undefined || previo.deudas === null
            ? previo.deudas
            : previo.deudas.map((d) => (d.id === s.deuda_id ? { ...d, saldo } : d)),
      };
    });
    setAviso(`Saldo anotado: ${formatoCOP(s.valor)}.`);
  };

  const cuentas = estado.tipo === "datos" ? estado.cuentas : [];
  const deudas = estado.tipo === "datos" ? estado.deudas : null;
  const visibles = deudas === null ? [] : deudasVisibles(deudas);
  const sinNada = estado.tipo === "datos" && cuentas.length === 0 && deudas !== null && visibles.length === 0;
  const subtitulo = sinNada ? "Sin cuentas ni deudas" : mayuscula(mesNombre(hoy));

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Dinero" subtitulo={subtitulo} ajustes />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          {estado.tipo === "error" ? (
            <BloqueError
              titulo="No se pudieron leer tus cuentas ni tus deudas."
              alReintentar={() => {
                setEstado({ tipo: "cargando" });
                setIntento((n) => n + 1);
              }}
            />
          ) : (
            <Contenido
              cuentas={cuentas}
              deudas={deudas}
              hoy={hoy}
              abrir={setHoja}
              reintentarDeudas={reintentarDeudas}
            />
          )}
        </main>
      </Hoja>

      <SaldoSheet
        abierto={hoja?.tipo === "saldo"}
        alCerrar={() => setHoja(null)}
        cuentas={cuentas}
        deudas={deudas === null ? null : visibles}
        inicial={hoja?.tipo === "saldo" ? hoja.inicial : null}
        alGuardar={guardarSaldo}
      />
      <CuentaSheet abierto={hoja?.tipo === "cuenta"} alCerrar={() => setHoja(null)} alGuardar={guardarCuenta} />
      <DeudaSheet abierto={hoja?.tipo === "deuda"} alCerrar={() => setHoja(null)} alGuardar={guardarDeuda} />
      {aviso !== null && <Aviso>{aviso}</Aviso>}
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
  cuentas,
  deudas,
  hoy,
  abrir,
  reintentarDeudas,
}: {
  cuentas: CuentaDto[];
  deudas: DeudaDto[] | null;
  hoy: string;
  abrir: (h: HojaAbierta) => void;
  reintentarDeudas: () => void;
}) {
  const hayCuentas = cuentas.length > 0;
  const visibles = deudas === null ? [] : deudasVisibles(deudas);
  const pagos = pagosDelMes(visibles, hoy);
  const intereses = interesesDelMes(visibles, hoy);

  const anotarEnCuenta = () =>
    abrir({ tipo: "saldo", inicial: { clase: "cuenta", id: cuentas[0].id } });
  const anotarEnDeuda = (id: string) => abrir({ tipo: "saldo", inicial: { clase: "deuda", id } });

  return (
    <>
      {/* Un solo botón cromo por pantalla: «Anotar saldo» si hay cuentas; si no, «Agregar cuenta». */}
      <Seccion titulo="Disponible" derecha={hayCuentas ? plural(cuentas.length, "cuenta", "cuentas") : undefined}>
        {hayCuentas ? (
          <>
            <p className="cifra">{formatoCOP(disponible(cuentas))}</p>
            <div className="mt-2">
              {cuentas.map((c) => (
                <Fila
                  key={c.id}
                  titulo={c.banco}
                  subtitulo={lineaCuenta(c)}
                  valor={formatoCOP(c.saldo?.valor ?? 0)}
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2.5">
              <Button className="flex-1" onClick={anotarEnCuenta}>
                Anotar saldo
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => abrir({ tipo: "cuenta" })}>
                Agregar cuenta
              </Button>
            </div>
          </>
        ) : (
          <Button className="mt-3 w-full" onClick={() => abrir({ tipo: "cuenta" })}>
            Agregar cuenta
          </Button>
        )}
      </Seccion>

      {pagos.length > 0 && (
        <Seccion titulo={`Sale en ${mesNombre(hoy)}`} derecha={plural(pagos.length, "pago", "pagos")}>
          <div>
            {pagos.map((p) => (
              <Fila
                key={p.deuda.id}
                titulo={nombreLargo(p.deuda)}
                subtitulo={`${p.etiqueta} · ${fechaDePago(p.fecha, hoy)}`}
                valor={formatoCOP(p.valor)}
              />
            ))}
            {hayCuentas && (
              <Fila
                titulo="Quedan después de pagar"
                valor={formatoCOP(quedanDespuesDePagar(cuentas, pagos))}
              />
            )}
          </div>
        </Seccion>
      )}

      {deudas === null ? (
        <Seccion titulo="Lo que debes">
          <BloqueError titulo="No se pudieron leer tus deudas." alReintentar={reintentarDeudas} />
        </Seccion>
      ) : visibles.length === 0 ? (
        <Seccion titulo="Lo que debes">
          <Vacio
            titulo="Sin deudas anotadas."
            salida={
              <Button variant="secondary" onClick={() => abrir({ tipo: "deuda" })}>
                Agregar deuda
              </Button>
            }
          />
        </Seccion>
      ) : (
        <Seccion titulo="Lo que debes" derecha={plural(visibles.length, "deuda", "deudas")}>
          <p className="cifra cifra-menor">{formatoCOP(loQueDebes(visibles))}</p>
          <div className="mt-2">
            {visibles.map((d) => (
              <FilaDeuda key={d.id} deuda={d} hoy={hoy} alTocar={() => anotarEnDeuda(d.id)} />
            ))}
          </div>
          {hayCuentas ? (
            <Button className="mt-3 w-full" variant="secondary" onClick={() => abrir({ tipo: "deuda" })}>
              Agregar deuda
            </Button>
          ) : (
            <div className="mt-3 flex gap-2.5">
              <Button className="flex-1" variant="secondary" onClick={() => anotarEnDeuda(visibles[0].id)}>
                Anotar saldo
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => abrir({ tipo: "deuda" })}>
                Agregar deuda
              </Button>
            </div>
          )}
        </Seccion>
      )}

      {intereses.filas.length > 0 && (
        <Seccion titulo={`Intereses de ${mesAnterior(hoy)}`} derecha={formatoCOP(intereses.total)}>
          <div>
            {intereses.filas.map((f) => (
              <Fila key={f.deuda.id} titulo={nombreLargo(f.deuda)} valor={formatoCOP(f.valor)} />
            ))}
          </div>
        </Seccion>
      )}
    </>
  );
}

/** Una fila de «Lo que debes»: nombre, línea, el medidor si hay, y el saldo; abre la hoja de saldo. */
function FilaDeuda({ deuda, hoy, alTocar }: { deuda: DeudaDto; hoy: string; alTocar: () => void }) {
  const progreso = progresoDeuda(deuda, hoy);
  return (
    <Fila
      titulo={deuda.nombre}
      valor={formatoCOP(deuda.saldo?.valor ?? 0)}
      onClick={alTocar}
      subtitulo={
        <>
          {lineaDeuda(deuda)}
          {progreso && (
            <>
              <span className="med" aria-hidden="true">
                <span className="med-r" style={{ width: `${Math.round(progreso.fraccion * 100)}%` }} />
              </span>
              <span className="mt-1.5 block">{progreso.etiqueta}</span>
            </>
          )}
        </>
      }
    />
  );
}
