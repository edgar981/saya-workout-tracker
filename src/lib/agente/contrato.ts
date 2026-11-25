/** El cable del agente: tipos y validación del pedido y de la respuesta. Puro: lo importa también el teléfono. */

export const MAX_PREGUNTA = 280; // caracteres de la pregunta, después de trim
export const MAX_FILAS = 400; // filas de Cuerpo en un pedido
export const MAX_CUERPO_BYTES = 65536; // bytes del cuerpo del POST
export const MAX_DESGLOSE = 8; // filas del desglose en la respuesta

export type UnidadPeso = "KG" | "LB" | "BODYWEIGHT" | "BODYWEIGHT_PLUS" | "STACK_POSITION";

export type FilaSerie = {
  tipo: "serie"; // una aparición de un ejercicio en una sesión
  fecha: string; // YYYY-MM-DD, la de la sesión
  sesion: string; // nombre del día de rutina, o «Sesión libre»
  abierta: boolean; // la sesión sigue activa
  ejercicio: string; // Exercise.nombre
  directos: string[]; // nombres de GRUPOS donde el ejercicio es directo
  indirectos: string[]; // nombres de GRUPOS donde es indirecto
  unidad: UnidadPeso; // weight_unit
  base: "TOTAL" | "PER_IMPLEMENT" | null; // weight_basis
  anadido: "KG" | "LB" | null; // added_unit
  series: number; // seriesDeAparicion(sets) de volumen.ts
  apuntes: { serie: number; reps: number; peso: number | null; lado: "L" | "R" | null }[];
};
export type FilaPeso = { tipo: "peso"; fecha: string; valor: number; unidad: "KG" | "LB" };
export type FilaSesion = {
  tipo: "sesion";
  fecha: string;
  sesion: string;
  abierta: boolean;
  ejercicios: number;
  series: number;
};
export type FilaCuerpo = FilaSerie | FilaPeso | FilaSesion;

// Las filas que la ruta arma desde Postgres (Dinero y Tiempo): nunca `ultimos4` ni ids ni marcas de tiempo.
export type FilaAgenteCuenta = { tipo: "cuenta"; n: number; banco: string; clase: string };
export type FilaAgenteSaldoCuenta = { tipo: "saldo_cuenta"; cuenta: number; fecha: string; valor: number };
export type FilaAgenteDeuda = {
  tipo: "deuda";
  n: number;
  clase: string;
  nombre: string;
  con_quien: string;
  tasa_ea: number | null;
  cuota: number | null;
  cupo: number | null;
  monto_inicial: number | null;
  cuotas_total: number | null;
  dia_pago: number | null;
  primera_cuota: string | null;
};
export type FilaAgenteSaldoDeuda = { tipo: "saldo_deuda"; deuda: number; fecha: string; valor: number };
export type FilaAgenteExtracto = {
  tipo: "extracto";
  deuda: number;
  cierre: string;
  intereses: number;
  pago_minimo: number | null;
  fecha_limite: string | null;
};
export type FilaAgenteTema = { tipo: "tema"; nombre: string };
export type FilaAgenteTiempo = { tipo: "tiempo"; fecha: string; tema: string; minutos: number };
export type FilaServidor =
  | FilaAgenteCuenta
  | FilaAgenteSaldoCuenta
  | FilaAgenteDeuda
  | FilaAgenteSaldoDeuda
  | FilaAgenteExtracto
  | FilaAgenteTema
  | FilaAgenteTiempo;

export const DESFASE_MIN = -840;
export const DESFASE_MAX = 720;
/** `desfase`: minutos, como `getTimezoneOffset()`; opcional en el cable, siempre presente ya validado. */
export type PedidoAgente = { pregunta: string; hoy: string; filas: FilaCuerpo[]; desfase?: number };
export type PedidoValidado = PedidoAgente & { desfase: number };

export type RespuestaAgente =
  | {
      estado: "respuesta";
      cifra: string;
      unidad: string;
      desglose: { etiqueta: string; valor: string }[];
    }
  | { estado: "sin_datos" };
export type ErrorAgente = { error: string };

export type ResultadoPedido =
  | { ok: true; pedido: PedidoValidado }
  | { ok: false; status: 400 | 413; error: string };

type Obj = Record<string, unknown>;

function esObjeto(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clavesExactas(o: Obj, claves: string[]): boolean {
  const ks = Object.keys(o);
  return ks.length === claves.length && claves.every((c) => ks.includes(c));
}

function esFecha(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function esNumero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function esTexto(v: unknown): v is string {
  return typeof v === "string";
}

function esListaTexto(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(esTexto);
}

const UNIDADES = ["KG", "LB", "BODYWEIGHT", "BODYWEIGHT_PLUS", "STACK_POSITION"];

function esApunte(v: unknown): boolean {
  return (
    esObjeto(v) &&
    clavesExactas(v, ["serie", "reps", "peso", "lado"]) &&
    esNumero(v.serie) &&
    esNumero(v.reps) &&
    (v.peso === null || esNumero(v.peso)) &&
    (v.lado === null || v.lado === "L" || v.lado === "R")
  );
}

function esFilaValida(v: unknown): boolean {
  if (!esObjeto(v)) return false;
  switch (v.tipo) {
    case "serie":
      return (
        clavesExactas(v, [
          "tipo", "fecha", "sesion", "abierta", "ejercicio", "directos",
          "indirectos", "unidad", "base", "anadido", "series", "apuntes",
        ]) &&
        esFecha(v.fecha) &&
        esTexto(v.sesion) &&
        typeof v.abierta === "boolean" &&
        esTexto(v.ejercicio) &&
        esListaTexto(v.directos) &&
        esListaTexto(v.indirectos) &&
        typeof v.unidad === "string" &&
        UNIDADES.includes(v.unidad) &&
        (v.base === null || v.base === "TOTAL" || v.base === "PER_IMPLEMENT") &&
        (v.anadido === null || v.anadido === "KG" || v.anadido === "LB") &&
        esNumero(v.series) &&
        Array.isArray(v.apuntes) &&
        v.apuntes.every(esApunte)
      );
    case "peso":
      return (
        clavesExactas(v, ["tipo", "fecha", "valor", "unidad"]) &&
        esFecha(v.fecha) &&
        esNumero(v.valor) &&
        (v.unidad === "KG" || v.unidad === "LB")
      );
    case "sesion":
      return (
        clavesExactas(v, ["tipo", "fecha", "sesion", "abierta", "ejercicios", "series"]) &&
        esFecha(v.fecha) &&
        esTexto(v.sesion) &&
        typeof v.abierta === "boolean" &&
        esNumero(v.ejercicios) &&
        esNumero(v.series)
      );
    default:
      return false;
  }
}

const malo = (error: string): ResultadoPedido => ({ ok: false, status: 400, error });

export function validarPedido(raw: unknown): ResultadoPedido {
  if (
    !esObjeto(raw) ||
    !(
      clavesExactas(raw, ["pregunta", "hoy", "filas"]) ||
      clavesExactas(raw, ["pregunta", "hoy", "filas", "desfase"])
    )
  ) {
    return malo("El pedido no tiene la forma esperada.");
  }
  if (!esTexto(raw.pregunta)) return malo("La pregunta no es texto.");
  const pregunta = raw.pregunta.trim();
  if (pregunta.length === 0) return malo("La pregunta está vacía.");
  if (pregunta.length > MAX_PREGUNTA) return malo("La pregunta es demasiado larga.");
  if (!esFecha(raw.hoy)) return malo("La fecha de hoy no es válida.");
  if (!Array.isArray(raw.filas)) return malo("Las filas no son un arreglo.");
  if (raw.filas.length > MAX_FILAS) {
    return { ok: false, status: 413, error: "Demasiadas filas." };
  }
  if (!raw.filas.every(esFilaValida)) return malo("Una fila no tiene la forma esperada.");
  let desfase = 0;
  if ("desfase" in raw) {
    const d = raw.desfase;
    if (typeof d !== "number" || !Number.isInteger(d) || d < DESFASE_MIN || d > DESFASE_MAX) {
      return malo("El desfase no es válido.");
    }
    desfase = d;
  }
  return {
    ok: true,
    pedido: { pregunta, hoy: raw.hoy, filas: raw.filas as FilaCuerpo[], desfase },
  };
}

export const ESQUEMA_RESPUESTA = {
  type: "object",
  additionalProperties: false,
  required: ["estado", "cifra", "unidad", "desglose"],
  properties: {
    estado: { type: "string", enum: ["respuesta", "sin_datos"] },
    cifra: { type: "string" },
    unidad: { type: "string" },
    desglose: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["etiqueta", "valor"],
        properties: { etiqueta: { type: "string" }, valor: { type: "string" } },
      },
    },
  },
} as const;

function texto(v: unknown, min: number, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
}

export function validarRespuesta(
  raw: unknown,
): { ok: true; respuesta: RespuestaAgente } | { ok: false } {
  if (!esObjeto(raw)) return { ok: false };
  if (raw.estado === "sin_datos") return { ok: true, respuesta: { estado: "sin_datos" } };
  if (raw.estado !== "respuesta") return { ok: false };

  const cifra = texto(raw.cifra, 1, 24);
  const unidad = texto(raw.unidad, 0, 24);
  if (cifra === null || unidad === null) return { ok: false };
  if (!Array.isArray(raw.desglose) || raw.desglose.length > MAX_DESGLOSE) return { ok: false };
  const desglose: { etiqueta: string; valor: string }[] = [];
  for (const d of raw.desglose) {
    if (!esObjeto(d)) return { ok: false };
    const etiqueta = texto(d.etiqueta, 1, 120);
    const valor = texto(d.valor, 1, 40);
    if (etiqueta === null || valor === null) return { ok: false };
    desglose.push({ etiqueta, valor });
  }
  return { ok: true, respuesta: { estado: "respuesta", cifra, unidad, desglose } };
}
