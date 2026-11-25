/**
 * «Exportar» también baja Dinero y Tiempo (DECISIONES.md §15): un JSON aparte,
 * leído de las dos rutas GET con sesión. Una copia a medias no es una copia: si
 * cualquiera de las dos falla, no se baja nada.
 */

/** Lo que espera el teléfono a cada ruta antes de rendirse. */
export const ESPERA_EXPORTAR_MS = 15000;

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type ResultadoExportar = { ok: true; archivo: string } | { ok: false };

export interface OpcionesExportar {
  fetch?: Fetch;
  ahora?: Date;
  /** La descarga, inyectable para que un test no toque el DOM. */
  descargar?: (carga: unknown, archivo: string) => void;
}

interface CuerpoDinero {
  cuentas: unknown[];
  saldos_cuenta: unknown[];
  deudas: unknown[];
  saldos_deuda: unknown[];
  extractos: unknown[];
}

interface CuerpoTiempo {
  temas: unknown[];
  registros: unknown[];
}

async function pedir<T>(url: string, fetchFn: Fetch): Promise<T | null> {
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), ESPERA_EXPORTAR_MS);
  try {
    const res = await fetchFn(url, { method: "GET", signal: control.signal });
    if (res.status !== 200) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(espera);
  }
}

function descargarJSON(carga: unknown, archivo: string): void {
  const blob = new Blob([JSON.stringify(carga, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const largo = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

export async function exportarServidor(opciones: OpcionesExportar = {}): Promise<ResultadoExportar> {
  const f: Fetch = opciones.fetch ?? ((u, i) => fetch(u, i));
  const descargar = opciones.descargar ?? descargarJSON;
  const ahora = opciones.ahora ?? new Date();

  const [dinero, tiempo] = await Promise.all([
    pedir<CuerpoDinero>("/api/dinero/exportar", f),
    pedir<CuerpoTiempo>("/api/tiempo/exportar", f),
  ]);
  if (dinero === null || tiempo === null) return { ok: false };

  const archivo = `saya-servidor-${ahora.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
  const carga = {
    // Sin `schema_version`: «Restaurar desde archivo» lo rechaza en vez de restaurarlo en Dexie.
    manifest: {
      formato: "saya-servidor",
      version: 1,
      exportado_en: ahora.toISOString(),
      conteos: {
        cuentas: largo(dinero.cuentas),
        saldos_cuenta: largo(dinero.saldos_cuenta),
        deudas: largo(dinero.deudas),
        saldos_deuda: largo(dinero.saldos_deuda),
        extractos: largo(dinero.extractos),
        temas: largo(tiempo.temas),
        registros: largo(tiempo.registros),
      },
    },
    dinero,
    tiempo,
  };
  try {
    descargar(carga, archivo);
  } catch {
    return { ok: false };
  }
  return { ok: true, archivo };
}
