import {
  ESQUEMA_RESPUESTA,
  MAX_CUERPO_BYTES,
  validarPedido,
  validarRespuesta,
  type ErrorAgente,
  type FilaServidor,
  type PedidoAgente,
  type RespuestaAgente,
} from "./contrato";
import { periodoDe, type Periodo } from "./filas";
import { MAX_FILAS_SERVIDOR, filasDelServidor, type DatosServidor } from "./servidor";
import { respuestaConConsejo } from "./consejo";
import { INSTRUCCIONES } from "./instrucciones";

export const URL_MENSAJES = "https://api.anthropic.com/v1/messages";
export const VERSION_API = "2026-10-21";
export const MAX_TOKENS = 2048;
export const ESPERA_MS = 25000;

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type MotivoFallo = "red" | "api" | "rechazo" | "corte" | "forma";

/** El pedido a Claude, exactamente: sin thinking, temperature, stream, tools ni prellenado. */
export function cuerpoDeLlamada(
  modelo: string,
  pedido: PedidoAgente,
  extra: { periodo: Periodo; filas: FilaServidor[] },
): Record<string, unknown> {
  return {
    model: modelo,
    max_tokens: MAX_TOKENS,
    system: INSTRUCCIONES,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          hoy: pedido.hoy,
          periodo: extra.periodo,
          pregunta: pedido.pregunta,
          filas: [...pedido.filas, ...extra.filas],
        }),
      },
    ],
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: ESQUEMA_RESPUESTA },
    },
  };
}

export async function pedirRespuesta(a: {
  clave: string;
  modelo: string;
  pedido: PedidoAgente;
  periodo: Periodo;
  filas: FilaServidor[];
  fetch: Fetch;
}): Promise<{ ok: true; respuesta: RespuestaAgente } | { ok: false; motivo: MotivoFallo }> {
  let res: Response;
  try {
    res = await a.fetch(URL_MENSAJES, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": a.clave,
        "anthropic-version": VERSION_API,
      },
      body: JSON.stringify(cuerpoDeLlamada(a.modelo, a.pedido, { periodo: a.periodo, filas: a.filas })),
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch {
    return { ok: false, motivo: "red" };
  }
  if (!res.ok) return { ok: false, motivo: "api" };

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, motivo: "forma" };
  }
  if (typeof data !== "object" || data === null) return { ok: false, motivo: "forma" };
  const msg = data as { stop_reason?: unknown; content?: unknown };
  if (msg.stop_reason === "refusal") return { ok: false, motivo: "rechazo" };
  if (msg.stop_reason === "max_tokens") return { ok: false, motivo: "corte" };
  if (!Array.isArray(msg.content)) return { ok: false, motivo: "forma" };

  const texto = msg.content
    .filter(
      (b): b is { type: "text"; text: string } =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("");

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: "forma" };
  }
  const v = validarRespuesta(json);
  if (!v.ok) return { ok: false, motivo: "forma" };
  return { ok: true, respuesta: v.respuesta };
}

/** Todo lo que la ruta hace después de comprobar la sesión. */
export async function atenderPedido(a: {
  clave: string | undefined;
  modelo: string;
  texto: string;
  fetch: Fetch;
  leer: () => Promise<DatosServidor>;
}): Promise<{ status: number; cuerpo: RespuestaAgente | ErrorAgente }> {
  if (!a.clave) return { status: 503, cuerpo: { error: "Sin llave." } };
  if (new TextEncoder().encode(a.texto).length > MAX_CUERPO_BYTES) {
    return { status: 413, cuerpo: { error: "El cuerpo es demasiado grande." } };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(a.texto);
  } catch {
    return { status: 400, cuerpo: { error: "El cuerpo no es JSON válido." } };
  }
  const pedido = validarPedido(raw);
  if (!pedido.ok) return { status: pedido.status, cuerpo: { error: pedido.error } };

  const periodo = periodoDe(pedido.pedido.pregunta, pedido.pedido.hoy);
  let datos: DatosServidor;
  try {
    datos = await a.leer();
  } catch {
    return { status: 503, cuerpo: { error: "No se pudo leer." } };
  }
  const filas = filasDelServidor(datos, periodo, pedido.pedido.desfase);
  if (filas.length > MAX_FILAS_SERVIDOR) {
    return { status: 413, cuerpo: { error: "Demasiadas filas." } };
  }
  if (pedido.pedido.filas.length === 0 && filas.length === 0) {
    return { status: 200, cuerpo: { estado: "sin_datos" } };
  }

  const r = await pedirRespuesta({
    clave: a.clave,
    modelo: a.modelo,
    pedido: pedido.pedido,
    periodo,
    filas,
    fetch: a.fetch,
  });
  if (!r.ok || respuestaConConsejo(r.respuesta)) {
    return { status: 502, cuerpo: { error: "No se pudo responder." } };
  }
  return { status: 200, cuerpo: r.respuesta };
}
