/**
 * Tiempo en el servidor (DECISIONES.md §15). TypeScript puro, sin ninguna
 * dependencia del servidor, para correr en vitest en node. El almacén se
 * inyecta (como `atenderPedido` del agente); el adaptador de la ruta lo une con la base.
 */

export const MAX_CUERPO_TIEMPO_BYTES = 4096;

export interface FilaTema {
  id: string;
  nombre: string;
  creado_en: Date;
}

export interface FilaRegistro {
  id: string;
  tema_id: string;
  minutos: number;
  /** Columna `@db.Date`: medianoche UTC. */
  fecha: Date;
  anotado_en: Date;
}

export interface AlmacenTiempo {
  temas(): Promise<FilaTema[]>;
  registrosDesde(desde: Date): Promise<FilaRegistro[]>;
  primerRegistro(): Promise<Date | null>;
  /** Todas las filas de las dos tablas, en una lectura coherente. */
  todo(): Promise<{ temas: FilaTema[]; registros: FilaRegistro[] }>;
  temaPorId(id: string): Promise<FilaTema | null>;
  temaPorNombre(nombre: string): Promise<FilaTema | null>;
  crearTema(datos: { id: string; nombre: string }): Promise<FilaTema>;
  registroPorId(id: string): Promise<FilaRegistro | null>;
  crearRegistro(datos: {
    id: string;
    tema_id: string;
    minutos: number;
    fecha: Date;
  }): Promise<FilaRegistro>;
}

export interface TemaDto {
  id: string;
  nombre: string;
}

export interface RegistroDto {
  id: string;
  tema_id: string;
  minutos: number;
  fecha: string;
  anotado_en: string;
}

export interface TiempoDto {
  temas: TemaDto[];
  registros: RegistroDto[];
  primer_registro: string | null;
}

export interface Respuesta {
  status: number;
  cuerpo: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function esUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/** Una fecha real `YYYY-MM-DD` (rechaza 2026-02-30). */
function fechaValida(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = FECHA.exec(v);
  if (!m) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() + 1 === Number(m[2]) &&
    d.getUTCDate() === Number(m[3])
  );
}

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Texto `YYYY-MM-DD` de las partes UTC: nunca la zona del servidor. */
function deFecha(d: Date): string {
  const a = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${a}-${m}-${dia}`;
}

function temaDto(t: FilaTema): TemaDto {
  return { id: t.id, nombre: t.nombre };
}

function registroDto(r: FilaRegistro): RegistroDto {
  return {
    id: r.id,
    tema_id: r.tema_id,
    minutos: r.minutos,
    fecha: deFecha(r.fecha),
    anotado_en: r.anotado_en.toISOString(),
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

export async function leerTiempo(
  desde: string | null,
  almacen: AlmacenTiempo,
): Promise<Respuesta> {
  if (!fechaValida(desde)) return mala("«desde» debe ser una fecha AAAA-MM-DD.");
  try {
    const [temas, registros, primero] = await Promise.all([
      almacen.temas(),
      almacen.registrosDesde(aFecha(desde)),
      almacen.primerRegistro(),
    ]);
    const cuerpo: TiempoDto = {
      temas: [...temas]
        .sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0))
        .map(temaDto),
      registros: registros
        .filter((r) => r.fecha.getTime() >= aFecha(desde).getTime())
        .sort(
          (a, b) =>
            b.fecha.getTime() - a.fecha.getTime() || b.anotado_en.getTime() - a.anotado_en.getTime(),
        )
        .map(registroDto),
      primer_registro: primero ? deFecha(primero) : null,
    };
    return { status: 200, cuerpo };
  } catch {
    return NO_DISPONIBLE;
  }
}

/** Todas las filas de Tiempo: la copia del owner (§15). */
export async function exportarTiempo(almacen: AlmacenTiempo): Promise<Respuesta> {
  try {
    const t = await almacen.todo();
    const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    return {
      status: 200,
      cuerpo: {
        temas: [...t.temas]
          .sort((a, b) => a.creado_en.getTime() - b.creado_en.getTime() || cmp(a.id, b.id))
          .map((x) => ({ id: x.id, nombre: x.nombre, creado_en: x.creado_en.toISOString() })),
        registros: [...t.registros]
          .sort(
            (a, b) =>
              a.fecha.getTime() - b.fecha.getTime() ||
              a.anotado_en.getTime() - b.anotado_en.getTime() ||
              cmp(a.id, b.id),
          )
          .map(registroDto),
      },
    };
  } catch {
    return NO_DISPONIBLE;
  }
}

export async function crearTema(texto: string, almacen: AlmacenTiempo): Promise<Respuesta> {
  const o = leerJson(texto);
  if (!o) return mala("El cuerpo debe ser un objeto JSON.");
  const { id, nombre } = o;
  if (!esUuid(id)) return mala("«id» debe ser un uuid.");
  if (typeof nombre !== "string") return mala("«nombre» debe ser texto.");
  const limpio = nombre.trim();
  if (limpio.length < 1 || limpio.length > 60) {
    return mala("«nombre» debe tener de 1 a 60 caracteres.");
  }

  const existente = async (): Promise<FilaTema | null> =>
    (await almacen.temaPorId(id)) ?? (await almacen.temaPorNombre(limpio));

  try {
    const ya = await existente();
    if (ya) return { status: 200, cuerpo: temaDto(ya) };
    const nuevo = await almacen.crearTema({ id, nombre: limpio });
    return { status: 201, cuerpo: temaDto(nuevo) };
  } catch (e) {
    const codigo = codigoDe(e);
    if (codigo === "P2023") return mala("Un id no tiene forma de uuid.");
    if (codigo === "P2002") {
      try {
        const ya = await existente();
        if (ya) return { status: 200, cuerpo: temaDto(ya) };
      } catch {
        /* cae al 503 */
      }
    }
    return NO_DISPONIBLE;
  }
}

export async function crearRegistro(texto: string, almacen: AlmacenTiempo): Promise<Respuesta> {
  const o = leerJson(texto);
  if (!o) return mala("El cuerpo debe ser un objeto JSON.");
  const { id, tema_id, minutos, fecha } = o;
  if (!esUuid(id)) return mala("«id» debe ser un uuid.");
  if (!esUuid(tema_id)) return mala("«tema_id» debe ser un uuid.");
  if (typeof minutos !== "number" || !Number.isInteger(minutos) || minutos < 1 || minutos > 1440) {
    return mala("«minutos» debe ser un entero de 1 a 1440.");
  }
  if (!fechaValida(fecha)) return mala("«fecha» debe ser una fecha AAAA-MM-DD.");

  try {
    const ya = await almacen.registroPorId(id);
    if (ya) return { status: 200, cuerpo: registroDto(ya) };
    const nuevo = await almacen.crearRegistro({
      id,
      tema_id,
      minutos,
      fecha: aFecha(fecha),
    });
    return { status: 201, cuerpo: registroDto(nuevo) };
  } catch (e) {
    const codigo = codigoDe(e);
    if (codigo === "P2023") return mala("Un id no tiene forma de uuid.");
    if (codigo === "P2003") return mala("El tema no existe.");
    if (codigo === "P2002") {
      try {
        const ya = await almacen.registroPorId(id);
        if (ya) return { status: 200, cuerpo: registroDto(ya) };
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
