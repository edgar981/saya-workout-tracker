"use client";

import { useRef, useState, type ReactNode } from "react";

import { fechaCorta } from "@/components/progress/estado";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Pildora } from "@/components/ui/pildora";
import { anotarSaldo, crearCuenta, crearDeuda } from "@/lib/dinero/cliente";
import {
  fechaHoraLocal,
  fechaLocalCorta,
  formatoCOP,
  parseCOP,
  parseTasa,
} from "@/lib/dinero/resumen";
import type { CuentaDto, DeudaDto, SaldoAnotadoDto } from "@/lib/dinero/servidor";
import { todayISO } from "@/lib/db/queries";

/*
 * Las tres hojas de Dinero (DECISIONES.md §15). Dinero vive en el servidor: guardar
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

// ── Agregar deuda ───────────────────────────────────────────────────────────

export function DeudaSheet({
  abierto,
  alCerrar,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: (deuda: DeudaDto) => void;
}) {
  return (
    <Panel abierto={abierto} alCerrar={alCerrar} titulo="Agregar deuda">
      <FormularioDeuda alCerrar={alCerrar} alGuardar={alGuardar} />
    </Panel>
  );
}

function FormularioDeuda({
  alCerrar,
  alGuardar,
}: {
  alCerrar: () => void;
  alGuardar: (deuda: DeudaDto) => void;
}) {
  const [tipo, setTipo] = useState<(typeof TIPOS_DEUDA)[number] | null>(null);
  const [nombre, setNombre] = useState("");
  const [conQuien, setConQuien] = useState("");
  const [saldoTexto, setSaldoTexto] = useState("");
  const [tasaTexto, setTasaTexto] = useState("");
  const [cuotaTexto, setCuotaTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);
  const idPara = useIdPorIntento();

  const saldo = parseCOP(saldoTexto);
  const tasa = tasaTexto.trim() === "" ? null : parseTasa(tasaTexto);
  const cuota = cuotaTexto.trim() === "" ? null : parseCOP(cuotaTexto);
  const valido =
    tipo !== null &&
    saldo !== null &&
    saldo > 0 &&
    (tasaTexto.trim() === "" || tasa !== null) &&
    (cuotaTexto.trim() === "" || (cuota !== null && cuota > 0));

  const guardar = async () => {
    if (!valido || tipo === null || saldo === null || guardando) return;
    setGuardando(true);
    setError(false);
    const nombreFinal = nombre.trim() === "" ? tipo.etiqueta : nombre.trim();
    const { id, idSaldo } = idPara(
      JSON.stringify([tipo.valor, nombreFinal, conQuien.trim(), saldo, tasa, cuota]),
    );
    const r = await crearDeuda({
      id,
      tipo: tipo.valor,
      nombre: nombreFinal,
      con_quien: conQuien.trim(),
      tasa_ea: tasa,
      cuota,
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

      <Grupo titulo="Tipo">
        <div className="pills mt-2.5">
          {TIPOS_DEUDA.map((t) => (
            <Pildora key={t.valor} presionada={tipo?.valor === t.valor} onClick={() => setTipo(t)}>
              {t.etiqueta}
            </Pildora>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Nombre">
        <Input
          className="mt-2.5"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Libre inversión"
          aria-label="Nombre"
          maxLength={60}
          autoComplete="off"
        />
      </Grupo>

      <Grupo titulo="Con quién">
        <Input
          className="mt-2.5"
          value={conQuien}
          onChange={(e) => setConQuien(e.target.value)}
          placeholder="Davivienda"
          aria-label="Con quién"
          maxLength={60}
          autoComplete="off"
        />
      </Grupo>

      <Grupo titulo="Saldo">
        <Input
          className="mt-2.5"
          variante="cifra"
          prefijo="$"
          inputMode="numeric"
          value={saldoTexto}
          onChange={(e) => setSaldoTexto(e.target.value)}
          placeholder="0"
          aria-label="Saldo"
          autoComplete="off"
        />
      </Grupo>

      <Grupo titulo="Tasa E.A. y cuota">
        <div className="mt-2.5 flex gap-2.5">
          <Input
            value={tasaTexto}
            onChange={(e) => setTasaTexto(e.target.value)}
            inputMode="decimal"
            placeholder="% E.A."
            aria-label="% E.A."
            autoComplete="off"
          />
          <Input
            value={cuotaTexto}
            onChange={(e) => setCuotaTexto(e.target.value)}
            inputMode="numeric"
            placeholder="Cuota $"
            aria-label="Cuota $"
            autoComplete="off"
          />
        </div>
        <p className="dek mt-2">Opcional.</p>
      </Grupo>

      {error && <Error_ texto="No se pudo guardar la deuda." />}
      <Button type="submit" size="lg" disabled={!valido || guardando}>
        {error ? "Reintentar" : "Agregar deuda"}
      </Button>
    </form>
  );
}
