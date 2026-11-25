"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { fechaCorta } from "@/components/progress/estado";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Pildora } from "@/components/ui/pildora";
import { anotarExtracto, anotarSaldo, crearCuenta, crearDeuda } from "@/lib/dinero/cliente";
import {
  cierreValido,
  cuotasTotalValidas,
  diaPagoValido,
  fechaCampo,
  fechaLimiteValida,
  formatearPesos,
  formatearTasa,
  interesesValidos,
  pesosPositivosValidos,
  pesosValidos,
  soloDigitos,
  tasaValida,
  ultimos4Validos,
} from "@/lib/dinero/campos";
import {
  fechaHoraLocal,
  fechaLocalCorta,
  formatoCOP,
  parseCOP,
  parseTasa,
} from "@/lib/dinero/resumen";
import type {
  CuentaDto,
  DeudaDto,
  ExtractoAnotadoDto,
  SaldoAnotadoDto,
} from "@/lib/dinero/servidor";
import { todayISO } from "@/lib/db/queries";

/*
 * Las hojas de Dinero (DECISIONES.md §15). Dinero vive en el servidor: guardar
 * espera la red. Con éxito la hoja se cierra y la pantalla suma lo que devolvió el
 * servidor, sin otra lectura. Al fallar queda abierta, con lo tecleado, el error en
 * línea y «Reintentar» en lugar del botón. Los `id` se crean una vez por montaje (el
 * formulario se monta en cada apertura): «Reintentar» no duplica nada; si lo que se
 * manda cambia tras un fallo, el `id` es otro.
 */

const BANCOS = ["Bancolombia", "Davivienda", "Nu", "Nequi", "BBVA", "Banco de Bogotá"] as const;
const OTRO = "__otro";
const TIPOS_CUENTA = ["Ahorros", "Corriente", "Depósito", "Cuenta"] as const;
const TIPOS_DEUDA = [
  { valor: "tarjeta", etiqueta: "Tarjeta de crédito" },
  { valor: "credito", etiqueta: "Crédito" },
  { valor: "personal", etiqueta: "Personal" },
] as const;

/** Un `id` por contenido: el mismo mientras lo que se manda no cambie. */
function useIdPorIntento() {
  const ref = useRef<{ clave: string; id: string; idSaldo: string } | null>(null);
  return (clave: string): { id: string; idSaldo: string } => {
    if (ref.current === null || ref.current.clave !== clave) {
      ref.current = { clave, id: crypto.randomUUID(), idSaldo: crypto.randomUUID() };
    }
    return ref.current;
  };
}

function Error_({ texto }: { texto: string }) {
  return (
    <ErrorEnLinea>
      <p>{texto}</p>
      <p className="err-s">Tus datos no se tocaron.</p>
    </ErrorEnLinea>
  );
}

function Grupo({ titulo, hint, children }: { titulo: string; hint?: string; children: ReactNode }) {
  return (
    <section className="fg !mt-0">
      <h3 className="kicker">
        {titulo}
        {hint && <span className="fg-hint"> · {hint}</span>}
      </h3>
      {children}
    </section>
  );
}

// ── Anotar saldo ────────────────────────────────────────────────────────────

export interface DuenoSaldo {
  clase: "cuenta" | "deuda";
  id: string;
}

export function SaldoSheet({
  abierto,
  alCerrar,
  cuentas,
  deudas,
  inicial,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  cuentas: readonly CuentaDto[];
  /** Las deudas que se muestran; `null` si no cargaron. */
  deudas: readonly DeudaDto[] | null;
  inicial: DuenoSaldo | null;
  alGuardar: (saldo: SaldoAnotadoDto) => void;
}) {
  return (
    <Panel abierto={abierto} alCerrar={alCerrar} titulo="Anotar saldo">
      <FormularioSaldo
        alCerrar={alCerrar}
        cuentas={cuentas}
        deudas={deudas ?? []}
        inicial={inicial}
        alGuardar={alGuardar}
      />
    </Panel>
  );
}

function FormularioSaldo({
  alCerrar,
  cuentas,
  deudas,
  inicial,
  alGuardar,
}: {
  alCerrar: () => void;
  cuentas: readonly CuentaDto[];
  deudas: readonly DeudaDto[];
  inicial: DuenoSaldo | null;
  alGuardar: (saldo: SaldoAnotadoDto) => void;
}) {
  const [dueno, setDueno] = useState<DuenoSaldo | null>(
    inicial ??
      (cuentas[0]
        ? { clase: "cuenta", id: cuentas[0].id }
        : deudas[0]
          ? { clase: "deuda", id: deudas[0].id }
          : null),
  );
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);
  const idPara = useIdPorIntento();

  const cuenta = dueno?.clase === "cuenta" ? cuentas.find((c) => c.id === dueno.id) : undefined;
  const deuda = dueno?.clase === "deuda" ? deudas.find((d) => d.id === dueno.id) : undefined;
  const actual = (cuenta ?? deuda)?.saldo ?? null;
  const valor = parseCOP(texto);
  const valido = dueno !== null && (cuenta !== undefined || deuda !== undefined) && valor !== null;

  const guardar = async () => {
    if (!valido || valor === null || dueno === null || guardando) return;
    setGuardando(true);
    setError(false);
    const { id } = idPara(`${dueno.clase}:${dueno.id}:${valor}`);
    const r = await anotarSaldo(
      dueno.clase === "cuenta"
        ? { id, cuenta_id: dueno.id, valor }
        : { id, deuda_id: dueno.id, valor },
    );
    if (!r.ok) {
      setError(true);
      setGuardando(false);
      return;
    }
    alGuardar(r.datos);
    alCerrar();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <p className="dek">Hoy, {fechaCorta(todayISO())}</p>

      {cuentas.length > 0 && (
        <Grupo titulo="Cuenta">
          <div className="pills mt-2.5">
            {cuentas.map((c) => (
              <Pildora
                key={c.id}
                presionada={dueno?.clase === "cuenta" && dueno.id === c.id}
                onClick={() => setDueno({ clase: "cuenta", id: c.id })}
              >
                {c.banco}
              </Pildora>
            ))}
          </div>
        </Grupo>
      )}

      {deudas.length > 0 && (
        <Grupo titulo="Deuda">
          <div className="pills mt-2.5">
            {deudas.map((d) => (
              <Pildora
                key={d.id}
                presionada={dueno?.clase === "deuda" && dueno.id === d.id}
                onClick={() => setDueno({ clase: "deuda", id: d.id })}
              >
                {d.nombre}
              </Pildora>
            ))}
          </div>
        </Grupo>
      )}

      <section className="fg !mt-0">
        <Input
          variante="cifra"
          prefijo="$"
          inputMode="numeric"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={actual ? formatoCOP(actual.valor).slice(1) : "0"}
          aria-label={dueno?.clase === "deuda" ? "Saldo que debes" : "Saldo"}
          autoComplete="off"
        />
        {actual && (
          <p className="dek mt-2">
            Último: {formatoCOP(actual.valor)} ·{" "}
            {dueno?.clase === "deuda"
              ? fechaLocalCorta(actual.anotado_en)
              : fechaHoraLocal(actual.anotado_en)}
          </p>
        )}
      </section>

      {error && <Error_ texto="No se pudo guardar el saldo." />}
      <Button type="submit" size="lg" disabled={!valido || guardando}>
        {error ? "Reintentar" : "Guardar"}
      </Button>
    </form>
  );
}

// ── Agregar cuenta ──────────────────────────────────────────────────────────

export function CuentaSheet({
  abierto,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: (cuenta: CuentaDto) => void;
}) {
  return (
    <Panel abierto={abierto} alCerrar={alCerrar} titulo="Agregar cuenta">
      <FormularioCuenta alCerrar={alCerrar} alGuardar={alGuardar} />
    </Panel>
  );
}

function FormularioCuenta({
  alCerrar,
  alGuardar,
}: {
  alCerrar: () => void;
  alGuardar: (cuenta: CuentaDto) => void;
}) {
  const [banco, setBanco] = useState<string | null>(null);
  const [otro, setOtro] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [ultimos4, setUltimos4] = useState("");
  const [saldoTexto, setSaldoTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);
  const idPara = useIdPorIntento();

  const nombreBanco = banco === OTRO ? otro.trim() : (banco ?? "");
  const ultimosValidos = ultimos4 === "" || /^\d{4}$/.test(ultimos4);
  const saldo = saldoTexto.trim() === "" ? 0 : parseCOP(saldoTexto);
  const valido =
    nombreBanco.length >= 1 &&
    nombreBanco.length <= 40 &&
    tipo !== null &&
    ultimosValidos &&
    saldo !== null;

  const guardar = async () => {
    if (!valido || tipo === null || saldo === null || guardando) return;
    setGuardando(true);
    setError(false);
    const clave = JSON.stringify([nombreBanco, tipo, ultimos4, saldo]);
    const { id, idSaldo } = idPara(clave);
    const r = await crearCuenta({
      id,
      banco: nombreBanco,
      tipo,
      ultimos4: ultimos4 === "" ? null : ultimos4,
      saldo: { id: idSaldo, valor: saldo },
    });
    if (!r.ok) {
      setError(true);
      setGuardando(false);
      return;
    }
    alGuardar(r.datos);
    alCerrar();
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <p className="dek">Hoy, {fechaCorta(todayISO())}</p>

      <Grupo titulo="Banco">
        <div className="pills mt-2.5">
          {[...BANCOS, "Otro"].map((b) => {
            const valor = b === "Otro" ? OTRO : b;
            return (
              <Pildora key={b} presionada={banco === valor} onClick={() => setBanco(valor)}>
                {b}
              </Pildora>
            );
          })}
        </div>
        {banco === OTRO && (
          <Input
            className="mt-2.5"
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            placeholder="Nombre del banco"
            aria-label="Nombre del banco"
            maxLength={40}
            autoComplete="off"
          />
        )}
      </Grupo>

      <Grupo titulo="Tipo">
        <div className="pills mt-2.5">
          {TIPOS_CUENTA.map((t) => (
            <Pildora key={t} presionada={tipo === t} onClick={() => setTipo(t)}>
              {t}
            </Pildora>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Últimos 4" hint="Opcional">
        <Input
          className="mt-2.5"
          value={ultimos4}
          onChange={(e) => setUltimos4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="4821"
          aria-label="Últimos 4"
          maxLength={4}
          autoComplete="off"
        />
      </Grupo>

      <Grupo titulo="Saldo inicial">
        <Input
          className="mt-2.5"
          variante="cifra"
          prefijo="$"
          inputMode="numeric"
          value={saldoTexto}
          onChange={(e) => setSaldoTexto(e.target.value)}
          placeholder="0"
          aria-label="Saldo inicial"
          autoComplete="off"
        />
      </Grupo>

      {error && <Error_ texto="No se pudo guardar la cuenta." />}
      <Button type="submit" size="lg" disabled={!valido || guardando}>
        {error ? "Reintentar" : "Agregar cuenta"}
      </Button>
    </form>
  );
}

// ── Las piezas de las dos hojas de formulario (Agregar deuda, Anotar extracto) ──

type Formato = "pesos" | "digitos" | "tasa";

/** La etiqueta de grupo `.fl`: un `<label for>` cuando nombra un campo. */
function Etiqueta({ para, children }: { para: string; children: ReactNode }) {
  return (
    <label htmlFor={para} className="fl">
      {children}
    </label>
  );
}

/**
 * Un campo numérico con el formato al teclear de `campos.ts`: pesos con puntos de miles
 * (sin perder el cursor), la tasa con coma, o enteros de sólo dígitos con tope.
 */
function CampoNumero({
  id,
  valor,
  alCambiar,
  alSalir,
  etiqueta,
  marcador,
  formato,
  max = 4,
  prefijo,
  sufijo,
  grande = false,
  invalido = false,
}: {
  id: string;
  valor: string;
  alCambiar: (texto: string) => void;
  alSalir: () => void;
  etiqueta: string;
  marcador: string;
  formato: Formato;
  max?: number;
  prefijo?: string;
  sufijo?: string;
  grande?: boolean;
  invalido?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  // Tras el render, el cursor vuelve a donde estaba el mismo dígito.
  useLayoutEffect(() => {
    if (cursor.current !== null && ref.current) {
      ref.current.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });

  const cambiar = (e: ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value;
    if (formato === "pesos") {
      const r = formatearPesos(t, e.target.selectionStart ?? t.length);
      cursor.current = r.cursor;
      alCambiar(r.texto);
    } else if (formato === "tasa") {
      alCambiar(formatearTasa(t));
    } else {
      alCambiar(soloDigitos(t, max));
    }
  };

  const conAfijo = prefijo !== undefined || sufijo !== undefined;
  return (
    <div
      className={`fh-campo${grande ? " fh-grande" : conAfijo ? " fh-afijo" : ""}`}
      data-invalido={invalido ? "" : undefined}
    >
      {prefijo !== undefined && (
        <span className="fh-af" aria-hidden="true">
          {prefijo}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        value={valor}
        onChange={cambiar}
        onBlur={alSalir}
        inputMode={formato === "tasa" ? "decimal" : "numeric"}
        placeholder={marcador}
        aria-label={etiqueta}
        aria-invalid={invalido ? "true" : undefined}
        maxLength={formato === "pesos" ? 17 : formato === "tasa" ? 6 : max}
        autoComplete="off"
      />
      {sufijo !== undefined && (
        <span className="fh-af" aria-hidden="true">
          {sufijo}
        </span>
      )}
    </div>
  );
}

function CampoTexto({
  id,
  valor,
  alCambiar,
  etiqueta,
  marcador,
}: {
  id: string;
  valor: string;
  alCambiar: (texto: string) => void;
  etiqueta: string;
  marcador: string;
}) {
  return (
    <div className="fh-campo">
      <input
        id={id}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={marcador}
        aria-label={etiqueta}
        maxLength={60}
        autoComplete="off"
      />
    </div>
  );
}

/** El campo de fecha: el aspecto `.tin` y, encima, el `<input type="date">` nativo, transparente. */
function CampoFecha({
  id,
  valor,
  alCambiar,
  alSalir,
  etiqueta,
  min,
  max,
  invalido = false,
}: {
  id: string;
  valor: string;
  alCambiar: (iso: string) => void;
  alSalir: () => void;
  etiqueta: string;
  min?: string;
  max?: string;
  invalido?: boolean;
}) {
  return (
    <div
      className="fh-campo fh-fecha"
      data-vacio={valor === "" ? "" : undefined}
      data-invalido={invalido ? "" : undefined}
    >
      <span className="fh-fv" aria-hidden="true">
        {valor === "" ? "Elegir fecha" : fechaCampo(valor)}
      </span>
      <svg className="fh-ic" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="2.25" y="3.5" width="13.5" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 7.5h13M6 2v3M12 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="date"
        value={valor}
        min={min}
        max={max}
        aria-label={etiqueta}
        aria-invalid={invalido ? "true" : undefined}
        onChange={(e) => {
          alCambiar(e.target.value);
          // Elegir una fecha cuenta como haber salido del campo.
          alSalir();
        }}
        onBlur={alSalir}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            /* sin showPicker, o sin gesto: el toque nativo lo abre */
          }
        }}
      />
    </div>
  );
}

/** El botón del pie: «Guardando…» con `aria-disabled` (no `disabled`, para no perder el foco). */
function BotonPie({
  formulario,
  texto,
  inhabilitado,
  guardando,
}: {
  formulario: string;
  texto: string;
  inhabilitado: boolean;
  guardando: boolean;
}) {
  return (
    <Button
      type="submit"
      form={formulario}
      className="w-full"
      disabled={inhabilitado && !guardando}
      aria-disabled={guardando ? "true" : undefined}
    >
      {guardando ? "Guardando…" : texto}
    </Button>
  );
}

function PiePie({ error, children }: { error: string | null; children: ReactNode }) {
  return (
    <>
      {error !== null && (
        <div className="mb-3">
          <Error_ texto={error} />
        </div>
      )}
      {children}
    </>
  );
}

// ── Agregar deuda ───────────────────────────────────────────────────────────

type TipoDeuda = (typeof TIPOS_DEUDA)[number];

const MARCADORES: Record<string, { nombre: string; conQuien: string }> = {
  ninguno: { nombre: "Libre inversión", conQuien: "Davivienda" },
  tarjeta: { nombre: "Tarjeta Mastercard", conQuien: "Bancolombia" },
  credito: { nombre: "Libre inversión", conQuien: "Davivienda" },
  personal: { nombre: "Préstamo de Andrés", conQuien: "Andrés" },
};

export function DeudaSheet({
  abierto,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: (deuda: DeudaDto) => void;
}) {
  // El formulario (y su `Panel`) se monta en cada apertura: el estado nace vacío.
  if (!abierto) return null;
  return <FormularioDeuda alCerrar={alCerrar} alGuardar={alGuardar} />;
}

function FormularioDeuda({
  alCerrar,
  alGuardar,
}: {
  alCerrar: () => void;
  alGuardar: (deuda: DeudaDto) => void;
}) {
  const [tipo, setTipo] = useState<TipoDeuda | null>(null);
  const [nombre, setNombre] = useState("");
  const [conQuien, setConQuien] = useState("");
  const [saldoTexto, setSaldoTexto] = useState("");
  const [tasaTexto, setTasaTexto] = useState("");
  const [cuotaTexto, setCuotaTexto] = useState("");
  const [cupoTexto, setCupoTexto] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [montoTexto, setMontoTexto] = useState("");
  const [cuotasTexto, setCuotasTexto] = useState("");
  const [primera, setPrimera] = useState("");
  // El día que él tecleó; `null` mientras no (el día de la primera cuota lo llena solo).
  const [diaTecleado, setDiaTecleado] = useState<string | null>(null);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);
  const idPara = useIdPorIntento();
  const idForm = useId();
  const campo = (n: string) => `${idForm}-${n}`;
  const tocar = (n: string) => setTocados((t) => (t[n] ? t : { ...t, [n]: true }));

  const diaAuto = primera !== "" ? String(Number(primera.slice(8, 10))) : "";
  const diaTexto = diaTecleado ?? diaAuto;

  // Los campos opcionales del tipo, en el orden de la rejilla.
  const campos: readonly string[] =
    tipo === null || tipo.valor === "personal"
      ? ["tasa", "cuota"]
      : tipo.valor === "tarjeta"
        ? ["tasa", "cupo", "ultimos4"]
        : ["tasa", "cuota", "monto", "cuotas", "primera", "dia"];
  const visible = (n: string) => campos.includes(n);

  const validos: Record<string, boolean> = {
    tasa: tasaValida(tasaTexto),
    cuota: pesosPositivosValidos(cuotaTexto),
    cupo: pesosPositivosValidos(cupoTexto),
    ultimos4: ultimos4Validos(ultimos4),
    monto: pesosPositivosValidos(montoTexto),
    cuotas: cuotasTotalValidas(cuotasTexto),
    primera: true,
    dia: diaPagoValido(diaTexto),
  };
  const invalido = (n: string) => visible(n) && !validos[n];
  const mostrarInvalido = (n: string) => invalido(n) && tocados[n] === true;

  const saldo = parseCOP(saldoTexto);
  const saldoMalo = saldoTexto !== "" && (saldo === null || saldo <= 0);
  const valido =
    tipo !== null && saldo !== null && saldo > 0 && !campos.some((n) => invalido(n));

  const numero = (t: string): number | null => (t.trim() === "" ? null : parseCOP(t));
  const cuerpo = () => {
    if (tipo === null || saldo === null) return null;
    const es = (n: string) => visible(n);
    return {
      tipo: tipo.valor,
      nombre: nombre.trim() === "" ? tipo.etiqueta : nombre.trim(),
      con_quien: conQuien.trim(),
      tasa_ea: es("tasa") && tasaTexto.trim() !== "" ? parseTasa(tasaTexto) : null,
      cuota: es("cuota") ? numero(cuotaTexto) : null,
      cupo: es("cupo") ? numero(cupoTexto) : null,
      monto_inicial: es("monto") ? numero(montoTexto) : null,
      ultimos4: es("ultimos4") && ultimos4 !== "" ? ultimos4 : null,
      cuotas_total: es("cuotas") && cuotasTexto !== "" ? Number(cuotasTexto) : null,
      dia_pago: es("dia") && diaTexto !== "" ? Number(diaTexto) : null,
      primera_cuota: es("primera") && primera !== "" ? primera : null,
      saldo,
    };
  };

  const guardar = async () => {
    const c = cuerpo();
    if (!valido || c === null || guardando) return;
    setGuardando(true);
    setError(false);
    const { saldo: valorSaldo, ...resto } = c;
    const { id, idSaldo } = idPara(JSON.stringify(c));
    const r = await crearDeuda({ id, ...resto, saldo: { id: idSaldo, valor: valorSaldo } });
    if (!r.ok) {
      setError(true);
      setGuardando(false);
      return;
    }
    alGuardar(r.datos);
    alCerrar();
  };

  const marcador = MARCADORES[tipo?.valor ?? "ninguno"];

  const celda = (n: string, etiqueta: string, hijo: ReactNode) => (
    <div key={n}>
      <label htmlFor={campo(n)} className="lbl">
        {etiqueta}
      </label>
      {hijo}
    </div>
  );

  const rejilla = campos.map((n) => {
    switch (n) {
      case "tasa":
        return celda(
          n,
          "Tasa E.A.",
          <CampoNumero
            id={campo(n)}
            valor={tasaTexto}
            alCambiar={setTasaTexto}
            alSalir={() => tocar(n)}
            etiqueta="Tasa efectiva anual"
            marcador="0,0"
            formato="tasa"
            sufijo="% E.A."
            invalido={mostrarInvalido(n)}
          />,
        );
      case "cuota":
        return celda(
          n,
          "Cuota",
          <CampoNumero
            id={campo(n)}
            valor={cuotaTexto}
            alCambiar={setCuotaTexto}
            alSalir={() => tocar(n)}
            etiqueta="Cuota, en pesos"
            marcador="0"
            formato="pesos"
            prefijo="$"
            invalido={mostrarInvalido(n)}
          />,
        );
      case "cupo":
        return celda(
          n,
          "Cupo",
          <CampoNumero
            id={campo(n)}
            valor={cupoTexto}
            alCambiar={setCupoTexto}
            alSalir={() => tocar(n)}
            etiqueta="Cupo, en pesos"
            marcador="0"
            formato="pesos"
            prefijo="$"
            invalido={mostrarInvalido(n)}
          />,
        );
      case "ultimos4":
        return celda(
          n,
          "Últimos 4",
          <CampoNumero
            id={campo(n)}
            valor={ultimos4}
            alCambiar={setUltimos4}
            alSalir={() => tocar(n)}
            etiqueta="Últimos 4 dígitos"
            marcador="0000"
            formato="digitos"
            max={4}
            invalido={mostrarInvalido(n)}
          />,
        );
      case "monto":
        return celda(
          n,
          "Monto inicial",
          <CampoNumero
            id={campo(n)}
            valor={montoTexto}
            alCambiar={setMontoTexto}
            alSalir={() => tocar(n)}
            etiqueta="Monto inicial, en pesos"
            marcador="0"
            formato="pesos"
            prefijo="$"
            invalido={mostrarInvalido(n)}
          />,
        );
      case "cuotas":
        return celda(
          n,
          "Número de cuotas",
          <CampoNumero
            id={campo(n)}
            valor={cuotasTexto}
            alCambiar={setCuotasTexto}
            alSalir={() => tocar(n)}
            etiqueta="Número de cuotas"
            marcador="0"
            formato="digitos"
            max={3}
            invalido={mostrarInvalido(n)}
          />,
        );
      case "primera":
        return celda(
          n,
          "Primera cuota",
          <CampoFecha
            id={campo(n)}
            valor={primera}
            alCambiar={setPrimera}
            alSalir={() => tocar(n)}
            etiqueta="Fecha de la primera cuota"
          />,
        );
      default:
        return celda(
          n,
          "Día de pago",
          <CampoNumero
            id={campo(n)}
            valor={diaTexto}
            alCambiar={(t) => setDiaTecleado(t === "" ? null : t)}
            alSalir={() => tocar(n)}
            etiqueta="Día de pago"
            marcador="1–31"
            formato="digitos"
            max={2}
            invalido={mostrarInvalido(n)}
          />,
        );
    }
  });

  return (
    <Panel
      abierto
      alCerrar={alCerrar}
      titulo="Agregar deuda"
      alto="pantalla"
      bloqueado={guardando}
      pie={
        <PiePie error={error ? "No se pudo guardar la deuda." : null}>
          <BotonPie
            formulario={idForm}
            texto={error ? "Reintentar" : "Agregar deuda"}
            inhabilitado={!valido}
            guardando={guardando}
          />
        </PiePie>
      }
    >
      <form
        id={idForm}
        className="fh-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="fh-campos" data-guardando={guardando ? "" : undefined} inert={guardando}>
          <div className="fh-g">
            <p id={campo("tipo")} className="fl">
              Tipo
            </p>
            <div className="pills" role="group" aria-labelledby={campo("tipo")}>
              {TIPOS_DEUDA.map((t) => (
                <Pildora key={t.valor} presionada={tipo?.valor === t.valor} onClick={() => setTipo(t)}>
                  {t.etiqueta}
                </Pildora>
              ))}
            </div>
          </div>

          <div className="fh-g">
            <Etiqueta para={campo("nombre")}>Nombre</Etiqueta>
            <CampoTexto
              id={campo("nombre")}
              valor={nombre}
              alCambiar={setNombre}
              etiqueta="Nombre"
              marcador={marcador.nombre}
            />
          </div>

          <div className="fh-g">
            <Etiqueta para={campo("conquien")}>Con quién</Etiqueta>
            <CampoTexto
              id={campo("conquien")}
              valor={conQuien}
              alCambiar={setConQuien}
              etiqueta="Con quién"
              marcador={marcador.conQuien}
            />
          </div>

          <div className="fh-g">
            <Etiqueta para={campo("saldo")}>Saldo</Etiqueta>
            <CampoNumero
              id={campo("saldo")}
              valor={saldoTexto}
              alCambiar={setSaldoTexto}
              alSalir={() => tocar("saldo")}
              etiqueta="Saldo, en pesos"
              marcador="0"
              formato="pesos"
              prefijo="$"
              grande
              invalido={saldoMalo && tocados.saldo === true}
            />
          </div>

          <div className="fh-g fh-op">
            <p className="fl fl-op">Opcional</p>
            <div className="fh-rej">{rejilla}</div>
          </div>
        </div>
      </form>
    </Panel>
  );
}

// ── Anotar extracto ─────────────────────────────────────────────────────────

export function ExtractoSheet({
  abierto,
  alCerrar,
  deudas,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  /** Las tarjetas y los créditos que se muestran, por `creada_en`. */
  deudas: readonly DeudaDto[];
  alGuardar: (extracto: ExtractoAnotadoDto, deuda: DeudaDto) => void;
}) {
  if (!abierto || deudas.length === 0) return null;
  return <FormularioExtracto alCerrar={alCerrar} deudas={deudas} alGuardar={alGuardar} />;
}

function FormularioExtracto({
  alCerrar,
  deudas,
  alGuardar,
}: {
  alCerrar: () => void;
  deudas: readonly DeudaDto[];
  alGuardar: (extracto: ExtractoAnotadoDto, deuda: DeudaDto) => void;
}) {
  const [deudaId, setDeudaId] = useState(deudas[0].id);
  const [cierre, setCierre] = useState("");
  const [interesesTexto, setInteresesTexto] = useState("");
  const [minimoTexto, setMinimoTexto] = useState("");
  const [limite, setLimite] = useState("");
  const [tocados, setTocados] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);
  const idPara = useIdPorIntento();
  const idForm = useId();
  const campo = (n: string) => `${idForm}-${n}`;
  const tocar = (n: string) => setTocados((t) => (t[n] ? t : { ...t, [n]: true }));
  const [hoy] = useState(() => todayISO());

  const deuda = deudas.find((d) => d.id === deudaId) ?? deudas[0];
  const esTarjeta = deuda.tipo === "tarjeta";

  const validos = {
    cierre: cierreValido(cierre, hoy),
    intereses: interesesTexto === "" || interesesValidos(interesesTexto),
    minimo: pesosValidos(minimoTexto),
    limite: fechaLimiteValida(limite, cierre),
  };
  const malo = (n: keyof typeof validos) => (n === "minimo" || n === "limite" ? esTarjeta : true) && !validos[n];
  const mostrar = (n: keyof typeof validos) => malo(n) && tocados[n] === true;

  const valido =
    cierre !== "" &&
    interesesValidos(interesesTexto) &&
    !(["cierre", "intereses", "minimo", "limite"] as const).some(malo);

  const guardar = async () => {
    if (!valido || guardando) return;
    const intereses = parseCOP(interesesTexto);
    if (intereses === null) return;
    const pagoMinimo = esTarjeta && minimoTexto.trim() !== "" ? parseCOP(minimoTexto) : null;
    const fechaLimite = esTarjeta && limite !== "" ? limite : null;
    setGuardando(true);
    setError(false);
    const cuerpo = { deuda_id: deuda.id, cierre, intereses, pago_minimo: pagoMinimo, fecha_limite: fechaLimite };
    const { id } = idPara(JSON.stringify(cuerpo));
    const r = await anotarExtracto({ id, ...cuerpo });
    if (!r.ok) {
      setError(true);
      setGuardando(false);
      return;
    }
    alGuardar(r.datos, deuda);
    alCerrar();
  };

  return (
    <Panel
      abierto
      alCerrar={alCerrar}
      titulo="Anotar extracto"
      alto="contenido"
      bloqueado={guardando}
      pie={
        <PiePie error={error ? "No se pudo guardar el extracto." : null}>
          <BotonPie
            formulario={idForm}
            texto={error ? "Reintentar" : "Guardar"}
            inhabilitado={!valido}
            guardando={guardando}
          />
        </PiePie>
      }
    >
      <form
        id={idForm}
        className="fh-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="fh-campos" data-guardando={guardando ? "" : undefined} inert={guardando}>
          <div className="fh-g">
            <p id={campo("deuda")} className="fl">
              Deuda
            </p>
            <div className="pills" role="group" aria-labelledby={campo("deuda")}>
              {deudas.map((d) => (
                <Pildora key={d.id} presionada={d.id === deuda.id} onClick={() => setDeudaId(d.id)}>
                  {d.nombre}
                </Pildora>
              ))}
            </div>
          </div>

          <div className="fh-g">
            <Etiqueta para={campo("cierre")}>Cierre</Etiqueta>
            <CampoFecha
              id={campo("cierre")}
              valor={cierre}
              alCambiar={setCierre}
              alSalir={() => tocar("cierre")}
              etiqueta="Fecha de cierre"
              max={hoy}
              invalido={mostrar("cierre")}
            />
          </div>

          <div className="fh-g">
            <Etiqueta para={campo("intereses")}>Intereses</Etiqueta>
            <CampoNumero
              id={campo("intereses")}
              valor={interesesTexto}
              alCambiar={setInteresesTexto}
              alSalir={() => tocar("intereses")}
              etiqueta="Intereses, en pesos"
              marcador="0"
              formato="pesos"
              prefijo="$"
              grande
              invalido={mostrar("intereses")}
            />
          </div>

          {/* Para un crédito el bloque guarda su espacio: nada se mueve al cambiar de deuda. */}
          <div
            className={`fh-g fh-op${esTarjeta ? "" : " fh-oculto"}`}
            aria-hidden={esTarjeta ? undefined : "true"}
            inert={!esTarjeta}
          >
            <p className="fl fl-op">Opcional</p>
            <div className="fh-rej">
              <div>
                <label htmlFor={campo("minimo")} className="lbl">
                  Pago mínimo
                </label>
                <CampoNumero
                  id={campo("minimo")}
                  valor={minimoTexto}
                  alCambiar={setMinimoTexto}
                  alSalir={() => tocar("minimo")}
                  etiqueta="Pago mínimo, en pesos"
                  marcador="0"
                  formato="pesos"
                  prefijo="$"
                  invalido={mostrar("minimo")}
                />
              </div>
              <div>
                <label htmlFor={campo("limite")} className="lbl">
                  Fecha límite
                </label>
                <CampoFecha
                  id={campo("limite")}
                  valor={limite}
                  alCambiar={setLimite}
                  alSalir={() => tocar("limite")}
                  etiqueta="Fecha límite de pago"
                  min={cierre !== "" ? cierre : undefined}
                  invalido={mostrar("limite")}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </Panel>
  );
}
