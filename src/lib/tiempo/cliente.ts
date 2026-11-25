/**
 * El cliente de las rutas de Tiempo (DECISIONES.md §15). Tiempo vive en el
 * servidor y sólo con señal: aquí no hay copia local ni cola. Cualquier respuesta
 * que no sea 200 o 201 (401, 403, 503, 400…), un error de red y la espera agotada
 * son el mismo `{ ok: false }`: una base caída también llega como 401, así que no
 * se lleva a otra pantalla.
 */

import type { DatosTiempo, RegistroTiempoDto, TemaTiempo } from "./semana";

/** Lo que espera el teléfono al servidor antes de rendirse. */
export const ESPERA_TIEMPO_MS = 15000;

export type Resultado<T> = { ok: true; datos: T } | { ok: false };

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

async function pedir<T>(
  url: string,
  init: RequestInit,
  fetchFn: Fetch | undefined,
  senal?: AbortSignal,
): Promise<Resultado<T>> {
  const f: Fetch = fetchFn ?? ((u, i) => fetch(u, i));
  const control = new AbortController();
  const cortar = () => control.abort();
  if (senal) {
    if (senal.aborted) return { ok: false };
    senal.addEventListener("abort", cortar, { once: true });
  }
  const espera = setTimeout(cortar, ESPERA_TIEMPO_MS);
  try {
    const res = await f(url, { ...init, signal: control.signal });
    if (res.status !== 200 && res.status !== 201) return { ok: false };
    return { ok: true, datos: (await res.json()) as T };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(espera);
    senal?.removeEventListener("abort", cortar);
  }
}

function post(cuerpo: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  };
}

export function leer(
  desde: string,
  opciones: { fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<Resultado<DatosTiempo>> {
  return pedir<DatosTiempo>(
    `/api/tiempo?desde=${encodeURIComponent(desde)}`,
    { method: "GET" },
    opciones.fetch,
    opciones.signal,
  );
}

export function guardarTema(
  tema: { id: string; nombre: string },
  opciones: { fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<Resultado<TemaTiempo>> {
  return pedir<TemaTiempo>("/api/tiempo/temas", post(tema), opciones.fetch, opciones.signal);
}

export function guardarRegistro(
  registro: { id: string; tema_id: string; minutos: number; fecha: string },
  opciones: { fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<Resultado<RegistroTiempoDto>> {
  return pedir<RegistroTiempoDto>(
    "/api/tiempo/registros",
    post(registro),
    opciones.fetch,
    opciones.signal,
  );
}
