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
  /**
   * El extracto de `cierre` más reciente de cada deuda y todos los de `cierre >= desde`
   * (el módulo deduplica por `id` y por par). `desde` es medianoche UTC.
   */
  extractos(desde: Date): Promise<FilaExtracto[]>;

  cuentaPorId(id: string): Promise<FilaCuenta | null>;
  ultimoSaldoDeCuenta(cuentaId: string): Promise<FilaSaldoCuenta | null>;
  deudaPorId(id: string): Promise<FilaDeuda | null>;
  ultimoSaldoDeDeuda(deudaId: string): Promise<FilaSaldoDeuda | null>;
  extractoDeDeuda(deudaId: string): Promise<FilaExtracto | null>;
  extractoPorId(id: string): Promise<FilaExtracto | null>;
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
      cupo: bigint | null;
      monto_inicial: bigint | null;
      ultimos4: string | null;
      cuotas_total: number | null;
      dia_pago: number | null;
      /** Medianoche UTC. */
      primera_cuota: Date | null;
    };
    saldo: { id: string; valor: bigint };
  }): Promise<{ deuda: FilaDeuda; saldo: FilaSaldoDeuda }>;
  crearExtracto(datos: {
    id: string;
    deuda_id: string;
    cierre: Date;
    intereses: bigint;
    pago_minimo: bigint | null;
    fecha_limite: Date | null;
  }): Promise<FilaExtracto>;
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

/** Un extracto anotado: el `ExtractoDto` más la deuda a la que pertenece. */
export interface ExtractoAnotadoDto extends ExtractoDto {
  deuda_id: string;
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
  /** Los de `cierre` desde el primer día del mes de hace dos meses, del más reciente al más antiguo. */
  extractos: ExtractoDto[];
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

function extractoPlano(e: FilaExtracto): ExtractoDto {
  return {
    id: e.id,
    cierre: deFecha(e.cierre),
    intereses: Number(e.intereses),
    pago_minimo: numero(e.pago_minimo),
    fecha_limite: e.fecha_limite ? deFecha(e.fecha_limite) : null,
    anotado_en: e.anotado_en.toISOString(),
  };
}

function extractoDto(e: FilaExtracto | null): ExtractoDto | null {
  return e ? extractoPlano(e) : null;
}

function extractoAnotadoDto(e: FilaExtracto): ExtractoAnotadoDto {
  return { ...extractoPlano(e), deuda_id: e.deuda_id };
}

function deudaDto(
  d: FilaDeuda,
  saldo: FilaSaldoDeuda | null,
  extracto: FilaExtracto | null,
  extractos: readonly FilaExtracto[] = [],
): DeudaDto {
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
    extractos: extractos.map(extractoPlano),
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

/** Medianoche UTC del primer día del mes de `ahora` menos dos meses. */
function inicioDeLectura(ahora: Date): Date {
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 2, 1));
}

/** De cada par (deuda, cierre) conserva sólo el de `anotado_en` más reciente (y un `id` una sola vez). */
function sinDuplicados(filas: readonly FilaExtracto[]): FilaExtracto[] {
  const porId = new Map<string, FilaExtracto>();
  for (const f of filas) porId.set(f.id, f);
  const porPar = new Map<string, FilaExtracto>();
  for (const f of porId.values()) {
    const k = `${f.deuda_id}|${f.cierre.getTime()}`;
    const previo = porPar.get(k);
    if (!previo || f.anotado_en.getTime() >= previo.anotado_en.getTime()) porPar.set(k, f);
  }
  return [...porPar.values()];
}

const masNuevoPrimero = (a: FilaExtracto, b: FilaExtracto) =>
  b.cierre.getTime() - a.cierre.getTime() || b.anotado_en.getTime() - a.anotado_en.getTime();

export async function leerDeudas(almacen: AlmacenDinero, ahora: Date = new Date()): Promise<Respuesta> {
  try {
    const desde = inicioDeLectura(ahora);
    const [deudas, saldos, extractos] = await Promise.all([
      almacen.deudas(),
      almacen.saldosDeudas(),
      almacen.extractos(desde),
    ]);
    const porDeuda = agrupar(saldos, (s) => s.deuda_id);
    const extractosPorDeuda = agrupar(sinDuplicados(extractos), (e) => e.deuda_id);
    return {
      status: 200,
      cuerpo: {
        deudas: porCreada(deudas).map((d) => {
          const todos = [...(extractosPorDeuda.get(d.id) ?? [])].sort(masNuevoPrimero);
          const recientes = todos.filter((e) => e.cierre.getTime() >= desde.getTime());
          return deudaDto(d, masReciente(porDeuda.get(d.id) ?? []), todos[0] ?? null, recientes);
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
  return { status: 200, cuerpo: deudaDto(d, saldo, extracto, extracto ? [extracto] : []) };
}

/** `YYYY-MM-DD` que es una fecha del calendario (no «2026-02-30») como medianoche UTC; si no, `null`. */
function fechaCalendario(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || deFecha(d) !== v ? null : d;
}

/** Ausente o `null` es `null`; con valor, el entero seguro mayor que 0; si no, `undefined` (inválido). */
function enteroPositivoOpcional(v: unknown): number | null | undefined {
  if (v === undefined || v === null) return null;
  return enteroSeguro(v) && v > 0 ? v : undefined;
}

/** Ausente o `null` es `null`; con valor, un entero de `min` a `max`; si no, `undefined` (inválido). */
function enteroEnRango(v: unknown, min: number, max: number): number | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
}

/** Los tipos que admiten cada uno de los campos opcionales de una deuda. */
const ADMITE: Record<string, readonly string[]> = {
  cuota: ["credito", "personal"],
  cupo: ["tarjeta"],
  ultimos4: ["tarjeta"],
  monto_inicial: ["credito"],
  cuotas_total: ["credito"],
  dia_pago: ["credito"],
  primera_cuota: ["credito"],
};

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
  const cupo = enteroPositivoOpcional(o.cupo);
  if (cupo === undefined) return mala("«cupo» debe ser un entero mayor que 0 o null.");
  const montoInicial = enteroPositivoOpcional(o.monto_inicial);
  if (montoInicial === undefined) return mala("«monto_inicial» debe ser un entero mayor que 0 o null.");
  const ultimos4 = o.ultimos4 ?? null;
  if (!ultimos4Valido(ultimos4)) return mala("«ultimos4» debe ser cuatro dígitos o null.");
  const cuotasTotal = enteroEnRango(o.cuotas_total, 1, 600);
  if (cuotasTotal === undefined) return mala("«cuotas_total» debe ser un entero de 1 a 600 o null.");
  const diaPago = enteroEnRango(o.dia_pago, 1, 31);
  if (diaPago === undefined) return mala("«dia_pago» debe ser un entero de 1 a 31 o null.");
  const primeraTexto = o.primera_cuota ?? null;
  const primeraCuota = primeraTexto === null ? null : fechaCalendario(primeraTexto);
  if (primeraTexto !== null && primeraCuota === null) {
    return mala("«primera_cuota» debe ser una fecha YYYY-MM-DD o null.");
  }

  // Un campo con valor en un tipo que no lo admite: la hoja manda null lo que su tipo no muestra.
  const conValor: Record<string, unknown> = {
    cuota,
    cupo,
    ultimos4,
    monto_inicial: montoInicial,
    cuotas_total: cuotasTotal,
    dia_pago: diaPago,
    primera_cuota: primeraCuota,
  };
  for (const [campo, tipos] of Object.entries(ADMITE)) {
    if (conValor[campo] !== null && !tipos.includes(tipo)) {
      return mala(`«${campo}» no aplica a una deuda de tipo ${tipo}.`);
    }
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
        cupo: cupo === null ? null : BigInt(cupo),
        monto_inicial: montoInicial === null ? null : BigInt(montoInicial),
        ultimos4: ultimos4,
        cuotas_total: cuotasTotal,
        dia_pago: diaPago,
        primera_cuota: primeraCuota,
      },
      saldo: { id: saldo.id, valor: BigInt(saldo.valor) },
    });
    return { status: 201, cuerpo: deudaDto(nueva.deuda, nueva.saldo, null, []) };
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

/** Anota el extracto de una tarjeta o de un crédito. */
export async function anotarExtracto(
  texto: string,
  almacen: AlmacenDinero,
  ahora: Date = new Date(),
): Promise<Respuesta> {
  const o = leerJson(texto);
  if (!o) return mala("El cuerpo debe ser un objeto JSON.");
  const { id, deuda_id, intereses } = o;
  if (!esUuid(id)) return mala("«id» debe ser un uuid.");
  if (!esUuid(deuda_id)) return mala("«deuda_id» debe ser un uuid.");
  const cierre = fechaCalendario(o.cierre);
  if (cierre === null) return mala("«cierre» debe ser una fecha YYYY-MM-DD.");
  // La hoja limita a hoy en la zona del teléfono; el día de margen cubre la zona.
  const tope = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1);
  if (cierre.getTime() > tope) return mala("«cierre» no puede ser posterior a hoy.");
  if (!enteroSeguro(intereses) || intereses < 0) return mala("«intereses» debe ser un entero de 0 en adelante.");
  const pagoMinimo = o.pago_minimo ?? null;
  if (pagoMinimo !== null && (!enteroSeguro(pagoMinimo) || pagoMinimo < 0)) {
    return mala("«pago_minimo» debe ser un entero de 0 en adelante o null.");
  }
  const limiteTexto = o.fecha_limite ?? null;
  const fechaLimite = limiteTexto === null ? null : fechaCalendario(limiteTexto);
  if (limiteTexto !== null && fechaLimite === null) {
    return mala("«fecha_limite» debe ser una fecha YYYY-MM-DD o null.");
  }
  if (fechaLimite !== null && fechaLimite.getTime() < cierre.getTime()) {
    return mala("«fecha_limite» no puede ser anterior al cierre.");
  }

  try {
    const ya = await almacen.extractoPorId(id);
    if (ya) return { status: 200, cuerpo: extractoAnotadoDto(ya) };
    const deuda = await almacen.deudaPorId(deuda_id);
    if (!deuda) return mala("La deuda no existe.");
    if (deuda.tipo === "personal") return mala("Una deuda personal no lleva extracto.");
    if (deuda.tipo === "credito" && (pagoMinimo !== null || fechaLimite !== null)) {
      return mala("Un crédito no lleva «pago_minimo» ni «fecha_limite».");
    }
    const nuevo = await almacen.crearExtracto({
      id,
      deuda_id,
      cierre,
      intereses: BigInt(intereses),
      pago_minimo: pagoMinimo === null ? null : BigInt(pagoMinimo as number),
      fecha_limite: fechaLimite,
    });
    return { status: 201, cuerpo: extractoAnotadoDto(nuevo) };
  } catch (e) {
    const codigo = codigoDe(e);
    if (codigo === "P2023" || codigo === "P2003") return mala("Un id no es válido.");
    if (codigo === "P2002") {
      try {
        const ya = await almacen.extractoPorId(id);
        if (ya) return { status: 200, cuerpo: extractoAnotadoDto(ya) };
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
