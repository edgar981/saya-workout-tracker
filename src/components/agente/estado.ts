/** Las reglas de la hoja del agente (SAYA-R2-6). Puro: lo prueba vitest sin DOM. */
import {
  MAX_CUERPO_BYTES,
  MAX_FILAS,
  validarPedido,
  validarRespuesta,
  type PedidoAgente,
  type RespuestaAgente,
} from "@/lib/agente/contrato";
import { elegirFilas, type DatosCuerpo } from "@/lib/agente/filas";

export type Vista =
  | { tipo: "preguntar" }
  | { tipo: "pensando"; pregunta: string }
  | {
      tipo: "respuesta";
      pregunta: string;
      respuesta: Extract<RespuestaAgente, { estado: "respuesta" }>;
    }
  | { tipo: "sin_datos"; pregunta: string }
  | { tipo: "error"; pregunta: string };

export function prepararPedido(
  pregunta: string,
  hoy: string,
  datos: DatosCuerpo,
  desfase: number,
): { tipo: "error" } | { tipo: "pedido"; texto: string } {
  const p = pregunta.trim();
  // Sin filas de Cuerpo también se manda: Dinero y Tiempo los lee la ruta, y quien dice «sin datos» es el servidor.
  const filas = elegirFilas(p, hoy, datos);
  if (filas.length > MAX_FILAS) return { tipo: "error" };
  const pedido: PedidoAgente = { pregunta: p, hoy, filas, desfase };
  if (!validarPedido(pedido).ok) return { tipo: "error" };
  const texto = JSON.stringify(pedido);
  if (new TextEncoder().encode(texto).length > MAX_CUERPO_BYTES) return { tipo: "error" };
  return { tipo: "pedido", texto };
}

/** La hoja nunca muestra el texto de error del servidor. */
export function leerRespuesta(pregunta: string, status: number, cuerpo: unknown): Vista {
  if (status !== 200) return { tipo: "error", pregunta };
  const r = validarRespuesta(cuerpo);
  if (!r.ok) return { tipo: "error", pregunta };
  if (r.respuesta.estado === "sin_datos") return { tipo: "sin_datos", pregunta };
  return { tipo: "respuesta", pregunta, respuesta: r.respuesta };
}
