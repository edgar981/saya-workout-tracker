"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  CuentaSheet,
  DeudaSheet,
  ExtractoSheet,
  SaldoSheet,
  type DuenoSaldo,
} from "@/components/dinero-sheets";
import { DeudasSkeleton, DineroSkeleton } from "@/components/skeletons";
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
import type {
  CuentaDto,
  DeudaDto,
  ExtractoAnotadoDto,
  SaldoAnotadoDto,
} from "@/lib/dinero/servidor";

/** Cuánto dura el aviso. */
const AVISO_MS = 3200;

/**
 * `deudas` es `null` cuando sólo ellas fallaron (`deudas-error`): las cuentas siguen.
 * Si fallan las cuentas es `error`, de las dos lecturas.
 */
type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "datos"; cuentas: CuentaDto[]; deudas: DeudaDto[] | null };

type HojaAbierta =
  | { tipo: "saldo"; inicial: DuenoSaldo | null }
  | { tipo: "cuenta" }
  | { tipo: "deuda" }
  | { tipo: "extracto" }
  | null;

/** Las tarjetas y los créditos que se muestran, por `creada_en`: las deudas con extracto. */
function conExtracto(visibles: readonly DeudaDto[]): DeudaDto[] {
  return visibles
    .filter((d) => d.tipo !== "personal")
    .sort((a, b) => (a.creada_en < b.creada_en ? -1 : a.creada_en > b.creada_en ? 1 : 0));
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function DineroScreen() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  // «Reintentar» vuelve a leer: cambia la dependencia del efecto.
  const [intento, setIntento] = useState(0);
  const [hoy] = useState(() => todayISO());
  const [hoja, setHoja] = useState<HojaAbierta>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // «Reintentar» de «No se pudieron leer tus deudas.»: mientras lee se ve un esqueleto.
  const [leyendoDeudas, setLeyendoDeudas] = useState(false);
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
    setLeyendoDeudas(true);
    void leerDeudas().then((d) => {
      if (!montado.current) return;
      setLeyendoDeudas(false);
      if (!d.ok) return;
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

  /** El extracto que devolvió el servidor, en su deuda: en `extractos` (reemplaza el del mismo
   *  cierre) y como `extracto` si su cierre es el más reciente. */
  const guardarExtracto = (e: ExtractoAnotadoDto, deuda: DeudaDto) => {
    const { deuda_id, ...extracto } = e;
    setEstado((previo) => {
      if (previo.tipo !== "datos" || previo.deudas === null) return previo;
      return {
        ...previo,
        deudas: previo.deudas.map((d) => {
          if (d.id !== deuda_id) return d;
          const extractos = [extracto, ...d.extractos.filter((x) => x.cierre !== extracto.cierre)].sort(
            (a, b) =>
              a.cierre < b.cierre ? 1 : a.cierre > b.cierre ? -1 : a.anotado_en < b.anotado_en ? 1 : -1,
          );
          const ultimo = d.extracto === null || extracto.cierre >= d.extracto.cierre ? extracto : d.extracto;
          return { ...d, extracto: ultimo, extractos };
        }),
      };
    });
    setAviso(`${deuda.nombre}: extracto anotado.`);
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
              leyendoDeudas={leyendoDeudas}
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
      <ExtractoSheet
        abierto={hoja?.tipo === "extracto"}
        alCerrar={() => setHoja(null)}
        deudas={conExtracto(visibles)}
        alGuardar={guardarExtracto}
      />
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
  leyendoDeudas,
}: {
  cuentas: CuentaDto[];
  deudas: DeudaDto[] | null;
  hoy: string;
  abrir: (h: HojaAbierta) => void;
  reintentarDeudas: () => void;
  leyendoDeudas: boolean;
}) {
  const hayCuentas = cuentas.length > 0;
  const visibles = deudas === null ? [] : deudasVisibles(deudas);
  const pagos = pagosDelMes(visibles, hoy);
  // Los intereses cuentan los extractos de TODAS las deudas, también una que ya está en 0.
  const intereses = interesesDelMes(deudas ?? [], hoy);
  const hayExtracto = visibles.some((d) => d.tipo !== "personal");

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
        leyendoDeudas ? (
          <DeudasSkeleton />
        ) : (
          <Seccion titulo="Lo que debes">
            <BloqueError titulo="No se pudieron leer tus deudas." alReintentar={reintentarDeudas} />
          </Seccion>
        )
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
          {/* Sin cuentas, «Anotar saldo» va ancho completo encima del par (tres en una fila no caben a 375). */}
          {!hayCuentas && (
            <Button className="mt-3 w-full" variant="secondary" onClick={() => anotarEnDeuda(visibles[0].id)}>
              Anotar saldo
            </Button>
          )}
          {hayExtracto ? (
            <div className="acts2">
              <Button
                variant="secondary"
                className="flex-1 px-3"
                onClick={() => abrir({ tipo: "extracto" })}
              >
                Anotar extracto
              </Button>
              <Button
                variant="secondary"
                className="flex-1 px-3"
                onClick={() => abrir({ tipo: "deuda" })}
              >
                Agregar deuda
              </Button>
            </div>
          ) : (
            <Button className="mt-3 w-full" variant="secondary" onClick={() => abrir({ tipo: "deuda" })}>
              Agregar deuda
            </Button>
          )}
        </Seccion>
      )}

      {intereses.filas.length > 0 && (
        <Seccion titulo={`Intereses de ${mesAnterior(hoy)}`} derecha={formatoCOP(intereses.total)}>
          <div>
            {intereses.filas.map((f) => (
              <Fila key={f.extracto.id} titulo={nombreLargo(f.deuda)} valor={formatoCOP(f.valor)} />
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
