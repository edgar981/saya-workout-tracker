/**
 * Dinero en el servidor (DECISIONES.md §15). TypeScript puro, sin ninguna
 * dependencia del servidor, para correr en vitest en node. El almacén se
 * inyecta (como en Tiempo); el adaptador de la ruta lo une con la base.
 */

export const MAX_CUERPO_DINERO_BYTES = 4096;

export const TIPOS_CUENTA = ["Ahorros", "Corriente", "Depósito", "Cuenta"] as const;
export const TIPOS_DEUDA = ["tarjeta", "credito", "personal"] as const;

// ── Filas del almacén: planas, tal como salen de la base ────────────────────

export interface FilaCuenta {
  id: string;
  banco: string;
  tipo: string;
  ultimos4: string | null;
  creada_en: Date;
}

export interface FilaSaldoCuenta {
  id: string;
  cuenta_id: string;
  valor: bigint;
  anotado_en: Date;
}

export interface FilaDeuda {
  id: string;
  tipo: string;
  nombre: string;
  con_quien: string;
  tasa_ea: number | null;
  cuota: bigint | null;
  cupo: bigint | null;
  monto_inicial: bigint | null;
  ultimos4: string | null;
  cuotas_total: number | null;
  dia_pago: number | null;
  /** Columna `@db.Date`: medianoche UTC. */
  primera_cuota: Date | null;
  creada_en: Date;
}

export interface FilaSaldoDeuda {
  id: string;
  deuda_id: string;
  valor: bigint;
  anotado_en: Date;
}

export interface FilaExtracto {
  id: string;
  deuda_id: string;
  /** Columnas `@db.Date`: medianoche UTC. */
  cierre: Date;
  intereses: bigint;
  pago_minimo: bigint | null;
  fecha_limite: Date | null;
  anotado_en: Date;
}

export interface AlmacenDinero {
  cuentas(): Promise<FilaCuenta[]>;
  /** Los saldos de las cuentas (basta con el último de cada una; el módulo elige). */
  saldosCuentas(): Promise<FilaSaldoCuenta[]>;
  deudas(): Promise<FilaDeuda[]>;
  saldosDeudas(): Promise<FilaSaldoDeuda[]>;
  /** Los extractos de las deudas (basta con el de `cierre` más reciente de cada una). */
  extractos(): Promise<FilaExtracto[]>;

  cuentaPorId(id: string): Promise<FilaCuenta | null>;
  ultimoSaldoDeCuenta(cuentaId: string): Promise<FilaSaldoCuenta | null>;
  deudaPorId(id: string): Promise<FilaDeuda | null>;
  ultimoSaldoDeDeuda(deudaId: string): Promise<FilaSaldoDeuda | null>;
  extractoDeDeuda(deudaId: string): Promise<FilaExtracto | null>;
  saldoCuentaPorId(id: string): Promise<FilaSaldoCuenta | null>;
  saldoDeudaPorId(id: string): Promise<FilaSaldoDeuda | null>;

  /** Una transacción: la cuenta y su saldo inicial. */
  crearCuentaConSaldo(datos: {
    cuenta: { id: string; banco: string; tipo: string; ultimos4: string | null };
    saldo: { id: string; valor: bigint };
  }): Promise<{ cuenta: FilaCuenta; saldo: FilaSaldoCuenta }>;
  /** Una transacción: la deuda y su saldo inicial. */
  crearDeudaConSaldo(datos: {
    deuda: {
      id: string;
      tipo: string;
      nombre: string;
      con_quien: string;
      tasa_ea: number | null;
      cuota: bigint | null;
    };
    saldo: { id: string; valor: bigint };
  }): Promise<{ deuda: FilaDeuda; saldo: FilaSaldoDeuda }>;
  crearSaldoCuenta(datos: { id: string; cuenta_id: string; valor: bigint }): Promise<FilaSaldoCuenta>;
  crearSaldoDeuda(datos: { id: string; deuda_id: string; valor: bigint }): Promise<FilaSaldoDeuda>;
}

// ── Lo que sale por la red ──────────────────────────────────────────────────

export interface SaldoDto {
  id: string;
  valor: number;
  anotado_en: string;
}

export interface CuentaDto {
  id: string;
  banco: string;
  tipo: string;
  ultimos4: string | null;
  creada_en: string;
  saldo: SaldoDto | null;
}

export interface ExtractoDto {
  id: string;
  cierre: string;
  intereses: number;
  pago_minimo: number | null;
  fecha_limite: string | null;
  anotado_en: string;
}

export interface DeudaDto {
  id: string;
  tipo: string;
  nombre: string;
  con_quien: string;
  tasa_ea: number | null;
  cuota: number | null;
  cupo: number | null;
  monto_inicial: number | null;
  ultimos4: string | null;
  cuotas_total: number | null;
  dia_pago: number | null;
  primera_cuota: string | null;
  creada_en: string;
  saldo: SaldoDto | null;
  extracto: ExtractoDto | null;
}

export interface SaldoAnotadoDto {
  id: string;
  cuenta_id?: string;
  deuda_id?: string;
  valor: number;
  anotado_en: string;
}

export interface Respuesta {
  status: number;
  cuerpo: unknown;
}

// ── Validación y formatos ───────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

function enteroSeguro(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v);
}

/** Texto `YYYY-MM-DD` de las partes UTC: nunca la zona del servidor. */
function deFecha(d: Date): string {
  const a = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${a}-${m}-${dia}`;
}

function numero(n: bigint | null): number | null {
  return n === null ? null : Number(n);
}

function saldoDto(s: { id: string; valor: bigint; anotado_en: Date } | null): SaldoDto | null {
  return s ? { id: s.id, valor: Number(s.valor), anotado_en: s.anotado_en.toISOString() } : null;
}

function cuentaDto(c: FilaCuenta, saldo: FilaSaldoCuenta | null): CuentaDto {
  return {
    id: c.id,
    banco: c.banco,
    tipo: c.tipo,
    ultimos4: c.ultimos4,
    creada_en: c.creada_en.toISOString(),
    saldo: saldoDto(saldo),
  };
}

function extractoDto(e: FilaExtracto | null): ExtractoDto | null {
  if (!e) return null;
  return {
    id: e.id,
    cierre: deFecha(e.cierre),
    intereses: Number(e.intereses),
    pago_minimo: numero(e.pago_minimo),
    fecha_limite: e.fecha_limite ? deFecha(e.fecha_limite) : null,
    anotado_en: e.anotado_en.toISOString(),
  };
}

function deudaDto(d: FilaDeuda, saldo: FilaSaldoDeuda | null, extracto: FilaExtracto | null): DeudaDto {
  return {
    id: d.id,
    tipo: d.tipo,
    nombre: d.nombre,
    con_quien: d.con_quien,
    tasa_ea: d.tasa_ea,
    cuota: numero(d.cuota),
    cupo: numero(d.cupo),
    monto_inicial: numero(d.monto_inicial),
    ultimos4: d.ultimos4,
    cuotas_total: d.cuotas_total,
    dia_pago: d.dia_pago,
    primera_cuota: d.primera_cuota ? deFecha(d.primera_cuota) : null,
    creada_en: d.creada_en.toISOString(),
    saldo: saldoDto(saldo),
    extracto: extractoDto(extracto),
  };
}

function mala(error: string): Respuesta {
  return { status: 400, cuerpo: { error } };
}

const NO_DISPONIBLE: Respuesta = {
  status: 503,
  cuerpo: { error: "No se pudo leer o guardar." },
};

function codigoDe(e: unknown): string | null {
  if (typeof e === "object" && e !== null && "code" in e) {
    const c = (e as { code: unknown }).code;
    return typeof c === "string" ? c : null;
  }
  return null;
}

function leerJson(texto: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(texto);
    return typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** El más reciente por `anotado_en` (a igual fecha, el último de la lista). */
function masReciente<T extends { anotado_en: Date }>(filas: readonly T[]): T | null {
  let r: T | null = null;
  for (const f of filas) if (r === null || f.anotado_en.getTime() >= r.anotado_en.getTime()) r = f;
  return r;
}

function porCreada<T extends { id: string; creada_en: Date }>(filas: readonly T[]): T[] {
  return [...filas].sort(
    (a, b) => a.creada_en.getTime() - b.creada_en.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

function agrupar<T>(filas: readonly T[], clave: (f: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const f of filas) {
    const k = clave(f);
    const l = m.get(k);
    if (l) l.push(f);
    else m.set(k, [f]);
  }
  return m;
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export async function leerCuentas(almacen: AlmacenDinero): Promise<Respuesta> {
  try {
    const [cuentas, saldos] = await Promise.all([almacen.cuentas(), almacen.saldosCuentas()]);
    const porCuenta = agrupar(saldos, (s) => s.cuenta_id);
    return {
      status: 200,
      cuerpo: {
        cuentas: porCreada(cuentas).map((c) => cuentaDto(c, masReciente(porCuenta.get(c.id) ?? []))),
      },
    };
  } catch {
    return NO_DISPONIBLE;
  }
}

export async function leerDeudas(almacen: AlmacenDinero): Promise<Respuesta> {
  try {
    const [deudas, saldos, extractos] = await Promise.all([
      almacen.deudas(),
      almacen.saldosDeudas(),
      almacen.extractos(),
    ]);
    const porDeuda = agrupar(saldos, (s) => s.deuda_id);
    const extractosPorDeuda = agrupar(extractos, (e) => e.deuda_id);
    return {
      status: 200,
      cuerpo: {
        deudas: porCreada(deudas).map((d) => {
          const ultimo = [...(extractosPorDeuda.get(d.id) ?? [])].sort(
            (a, b) =>
              a.cierre.getTime() - b.cierre.getTime() || a.anotado_en.getTime() - b.anotado_en.getTime(),
          );
          return deudaDto(d, masReciente(porDeuda.get(d.id) ?? []), ultimo[ultimo.length - 1] ?? null);
        }),
      },
    };
  } catch {
    return NO_DISPONIBLE;
  }
}

// ── Escrituras ──────────────────────────────────────────────────────────────

function leerSaldoInicial(v: unknown): { id: string; valor: number } | string {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return "«saldo» debe ser un objeto.";
  const { id, valor } = v as Record<string, unknown>;
  if (!esUuid(id)) return "«saldo.id» debe ser un uuid.";
  if (!enteroSeguro(valor) || valor < 0) return "«saldo.valor» debe ser un entero de 0 en adelante.";
  return { id, valor };
}

function ultimos4Valido(v: unknown): v is string | null {
  return v === null || (typeof v === "string" && /^\d{4}$/.test(v));
}

async function cuentaExistente(id: string, almacen: AlmacenDinero): Promise<Respuesta | null> {
  const c = await almacen.cuentaPorId(id);
  if (!c) return null;
  return { status: 200, cuerpo: cuentaDto(c, await almacen.ultimoSaldoDeCuenta(id)) };
}

export async function crearCuenta(texto: string, almacen: AlmacenDinero): Promise<Respuesta> {
  const o = leerJson(texto);
  if (!o) return mala("El cuerpo debe ser un objeto JSON.");
  const { id, banco, tipo, ultimos4 } = o;
  if (!esUuid(id)) return mala("«id» debe ser un uuid.");
  if (typeof banco !== "string") return mala("«banco» debe ser texto.");
  const bancoLimpio = banco.trim();
  if (bancoLimpio.length < 1 || bancoLimpio.length > 40) {
    return mala("«banco» debe tener de 1 a 40 caracteres.");
  }
  if (typeof tipo !== "string" || !(TIPOS_CUENTA as readonly string[]).includes(tipo)) {
    return mala("«tipo» no es un tipo de cuenta.");
  }
  if (!ultimos4Valido(ultimos4)) return mala("«ultimos4» debe ser cuatro dígitos o null.");
  const saldo = leerSaldoInicial(o.saldo);
  if (typeof saldo === "string") return mala(saldo);

  try {
    const ya = await cuentaExistente(id, almacen);
    if (ya) return ya;
    const nueva = await almacen.crearCuentaConSaldo({
      cuenta: { id, banco: bancoLimpio, tipo, ultimos4 },
      saldo: { id: saldo.id, valor: BigInt(saldo.valor) },
    });
    return { status: 201, cuerpo: cuentaDto(nueva.cuenta, nueva.saldo) };
  } catch (e) {
    const codigo = codigoDe(e);
    if (codigo === "P2023" || codigo === "P2003") return mala("Un id no es válido.");
    if (codigo === "P2002") {
      try {
        const ya = await cuentaExistente(id, almacen);
        if (ya) return ya;
        return mala("Un id ya está en uso.");
      } catch {
        /* cae al 503 */
      }
    }
    return NO_DISPONIBLE;
  }
}

async function deudaExistente(id: string, almacen: AlmacenDinero): Promise<Respuesta | null> {
  const d = await almacen.deudaPorId(id);
  if (!d) return null;
  const [saldo, extracto] = await Promise.all([
    almacen.ultimoSaldoDeDeuda(id),
    almacen.extractoDeDeuda(id),
  ]);
  return { status: 200, cuerpo: deudaDto(d, saldo, extracto) };
}

export async function crearDeuda(texto: string, almacen: AlmacenDinero): Promise<Respuesta> {
  const o = leerJson(texto);
  if (!o) return mala("El cuerpo debe ser un objeto JSON.");
  const { id, tipo, nombre, con_quien, tasa_ea, cuota } = o;
  if (!esUuid(id)) return mala("«id» debe ser un uuid.");
  if (typeof tipo !== "string" || !(TIPOS_DEUDA as readonly string[]).includes(tipo)) {
    return mala("«tipo» no es un tipo de deuda.");
  }
  if (typeof nombre !== "string") return mala("«nombre» debe ser texto.");
  const nombreLimpio = nombre.trim();
  if (nombreLimpio.length < 1 || nombreLimpio.length > 60) {
    return mala("«nombre» debe tener de 1 a 60 caracteres.");
  }
  if (typeof con_quien !== "string") return mala("«con_quien» debe ser texto.");
  const conQuien = con_quien.trim();
  if (conQuien.length > 60) return mala("«con_quien» debe tener hasta 60 caracteres.");
  if (tasa_ea !== null) {
    if (typeof tasa_ea !== "number" || !Number.isFinite(tasa_ea) || tasa_ea < 0 || tasa_ea > 200) {
      return mala("«tasa_ea» debe ser un número de 0 a 200 o null.");
    }
    if (Math.abs(Math.round(tasa_ea * 100) - tasa_ea * 100) > 1e-6) {
      return mala("«tasa_ea» admite a lo más dos decimales.");
    }
  }
  if (cuota !== null && (!enteroSeguro(cuota) || cuota <= 0)) {
    return mala("«cuota» debe ser un entero mayor que 0 o null.");
  }
  const saldo = leerSaldoInicial(o.saldo);
  if (typeof saldo === "string") return mala(saldo);

  try {
    const ya = await deudaExistente(id, almacen);
    if (ya) return ya;
    const nueva = await almacen.crearDeudaConSaldo({
      deuda: {
        id,
        tipo,
        nombre: nombreLimpio,
        con_quien: conQuien,
        // Ya validados arriba: un número o null.
        tasa_ea: tasa_ea === null ? null : (tasa_ea as number),
        cuota: cuota === null ? null : BigInt(cuota as number),
      },
      saldo: { id: saldo.id, valor: BigInt(saldo.valor) },
    });
    return { status: 201, cuerpo: deudaDto(nueva.deuda, nueva.saldo, null) };
  } catch (e) {
    const codigo = codigoDe(e);
    if (codigo === "P2023" || codigo === "P2003") return mala("Un id no es válido.");
    if (codigo === "P2002") {
      try {
        const ya = await deudaExistente(id, almacen);
        if (ya) return ya;
        return mala("Un id ya está en uso.");
      } catch {
        /* cae al 503 */
      }
    }
    return NO_DISPONIBLE;
  }
}

function saldoAnotado(
  s: FilaSaldoCuenta | FilaSaldoDeuda,
): SaldoAnotadoDto {
  const dueno = "cuenta_id" in s ? { cuenta_id: s.cuenta_id } : { deuda_id: s.deuda_id };
  return { id: s.id, ...dueno, valor: Number(s.valor), anotado_en: s.anotado_en.toISOString() };
}

export async function anotarSaldo(texto: string, almacen: AlmacenDinero): Promise<Respuesta> {
  const o = leerJson(texto);
  if (!o) return mala("El cuerpo debe ser un objeto JSON.");
  const { id, valor } = o;
  const cuentaId = o.cuenta_id ?? null;
  const deudaId = o.deuda_id ?? null;
  if (!esUuid(id)) return mala("«id» debe ser un uuid.");
  if (!enteroSeguro(valor) || valor < 0) return mala("«valor» debe ser un entero de 0 en adelante.");
  if ((cuentaId === null) === (deudaId === null)) {
    return mala("Debe venir exactamente uno de «cuenta_id» y «deuda_id».");
  }
  if (cuentaId !== null && !esUuid(cuentaId)) return mala("«cuenta_id» debe ser un uuid.");
  if (deudaId !== null && !esUuid(deudaId)) return mala("«deuda_id» debe ser un uuid.");

  const existente = async (): Promise<Respuesta | null> => {
    const ya = (await almacen.saldoCuentaPorId(id)) ?? (await almacen.saldoDeudaPorId(id));
    return ya ? { status: 200, cuerpo: saldoAnotado(ya) } : null;
  };

  try {
    const ya = await existente();
    if (ya) return ya;
    const nuevo =
      cuentaId !== null
        ? await almacen.crearSaldoCuenta({ id, cuenta_id: cuentaId as string, valor: BigInt(valor) })
        : await almacen.crearSaldoDeuda({ id, deuda_id: deudaId as string, valor: BigInt(valor) });
    return { status: 201, cuerpo: saldoAnotado(nuevo) };
  } catch (e) {
    const codigo = codigoDe(e);
    if (codigo === "P2023") return mala("Un id no tiene forma de uuid.");
    if (codigo === "P2003") return mala("La cuenta o la deuda no existe.");
    if (codigo === "P2002") {
      try {
        const ya = await existente();
        if (ya) return ya;
        return mala("Un id ya está en uso.");
      } catch {
        /* cae al 503 */
      }
    }
    return NO_DISPONIBLE;
  }
}

/** Verdadero sólo si `baseUrl` es una URL válida y `origin` es exactamente la suya. */
export function origenPermitido(origin: string | null, baseUrl: string | undefined): boolean {
  if (!origin || !baseUrl) return false;
  try {
    return origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}
