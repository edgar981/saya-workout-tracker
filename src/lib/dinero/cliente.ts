/**
 * El cliente de las rutas de Dinero (DECISIONES.md §15). Dinero vive en el
 * servidor y sólo con señal: aquí no hay copia local ni cola. Cualquier respuesta
 * que no sea 200 o 201 (401, 403, 503, 400…), un error de red y la espera agotada
 * son el mismo `{ ok: false }`.
 */

import type { CuentaDto, DeudaDto, SaldoAnotadoDto } from "./servidor";

/** Lo que espera el teléfono al servidor antes de rendirse. */
export const ESPERA_DINERO_MS = 15000;

export type Resultado<T> = { ok: true; datos: T } | { ok: false };

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface Opciones {
  fetch?: Fetch;
  signal?: AbortSignal;
}

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
  const espera = setTimeout(cortar, ESPERA_DINERO_MS);
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

export function leerCuentas(opciones: Opciones = {}): Promise<Resultado<{ cuentas: CuentaDto[] }>> {
  return pedir("/api/dinero/cuentas", { method: "GET" }, opciones.fetch, opciones.signal);
}

export function leerDeudas(opciones: Opciones = {}): Promise<Resultado<{ deudas: DeudaDto[] }>> {
  return pedir("/api/dinero/deudas", { method: "GET" }, opciones.fetch, opciones.signal);
}

export function crearCuenta(
  cuenta: {
    id: string;
    banco: string;
    tipo: string;
    ultimos4: string | null;
    saldo: { id: string; valor: number };
  },
  opciones: Opciones = {},
): Promise<Resultado<CuentaDto>> {
  return pedir("/api/dinero/cuentas", post(cuenta), opciones.fetch, opciones.signal);
}

export function crearDeuda(
  deuda: {
    id: string;
    tipo: string;
    nombre: string;
    con_quien: string;
    tasa_ea: number | null;
    cuota: number | null;
    saldo: { id: string; valor: number };
  },
  opciones: Opciones = {},
): Promise<Resultado<DeudaDto>> {
  return pedir("/api/dinero/deudas", post(deuda), opciones.fetch, opciones.signal);
}

export function anotarSaldo(
  saldo: { id: string; cuenta_id: string; valor: number } | { id: string; deuda_id: string; valor: number },
  opciones: Opciones = {},
): Promise<Resultado<SaldoAnotadoDto>> {
  return pedir("/api/dinero/saldos", post(saldo), opciones.fetch, opciones.signal);
}
