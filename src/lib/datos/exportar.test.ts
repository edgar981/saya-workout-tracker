import { afterEach, describe, expect, it, vi } from "vitest";

import { exportarServidor, type Fetch } from "./exportar";

const AHORA = new Date("2026-11-25T14:30:45.123Z");

const DINERO = {
  cuentas: [{ id: "c1" }],
  saldos_cuenta: [{ id: "s1" }, { id: "s2" }],
  deudas: [{ id: "d1" }],
  saldos_deuda: [],
  extractos: [{ id: "e1" }, { id: "e2" }, { id: "e3" }],
};
const TIEMPO = { temas: [{ id: "t1" }], registros: [{ id: "r1" }, { id: "r2" }] };

const json = (cuerpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));

function falso(dinero: () => Promise<Response>, tiempo: () => Promise<Response>): Fetch {
  return (url) => (url === "/api/dinero/exportar" ? dinero() : tiempo());
}

afterEach(() => vi.useRealTimers());

describe("exportarServidor", () => {
  it("los 2 en 200: ok, con el nombre y un archivo con el manifiesto y los conteos", async () => {
    const descargar = vi.fn();
    const r = await exportarServidor({
      fetch: falso(() => json(DINERO), () => json(TIEMPO)),
      ahora: AHORA,
      descargar,
    });
    expect(r).toEqual({ ok: true, archivo: "saya-servidor-2026-11-25T14-30-45.json" });
    expect(descargar).toHaveBeenCalledTimes(1);
    const [carga, nombre] = descargar.mock.calls[0];
    expect(nombre).toBe("saya-servidor-2026-11-25T14-30-45.json");
    expect(carga).toEqual({
      manifest: {
        formato: "saya-servidor",
        version: 1,
        exportado_en: "2026-11-25T14:30:45.123Z",
        conteos: {
          cuentas: 1,
          saldos_cuenta: 2,
          deudas: 1,
          saldos_deuda: 0,
          extractos: 3,
          temas: 1,
          registros: 2,
        },
      },
      dinero: DINERO,
      tiempo: TIEMPO,
    });
  });

  it("el manifiesto no tiene schema_version", async () => {
    const descargar = vi.fn();
    await exportarServidor({ fetch: falso(() => json(DINERO), () => json(TIEMPO)), ahora: AHORA, descargar });
    expect(descargar.mock.calls[0][0].manifest).not.toHaveProperty("schema_version");
  });

  it("pide las dos rutas con GET", async () => {
    const f = vi.fn<Fetch>((url) => json(url.includes("dinero") ? DINERO : TIEMPO));
    await exportarServidor({ fetch: f, ahora: AHORA, descargar: vi.fn() });
    expect(f.mock.calls.map((c) => [c[0], c[1]?.method]).sort()).toEqual([
      ["/api/dinero/exportar", "GET"],
      ["/api/tiempo/exportar", "GET"],
    ]);
  });

  it.each([
    ["401 en Dinero", () => json({ error: "Sin sesión." }, 401), () => json(TIEMPO)],
    ["503 en Tiempo", () => json(DINERO), () => json({ error: "x" }, 503)],
    ["un fetch que lanza", () => Promise.reject(new TypeError("red")), () => json(TIEMPO)],
    ["un cuerpo que no es JSON", () => Promise.resolve(new Response("no", { status: 200 })), () => json(TIEMPO)],
  ])("%s: ok false y la descarga no se llama", async (_n, dinero, tiempo) => {
    const descargar = vi.fn();
    const r = await exportarServidor({ fetch: falso(dinero, tiempo), ahora: AHORA, descargar });
    expect(r).toEqual({ ok: false });
    expect(descargar).not.toHaveBeenCalled();
  });

  it("un corte a los 15000 ms: ok false y la descarga no se llama", async () => {
    vi.useFakeTimers();
    const descargar = vi.fn();
    const colgado: Fetch = (_u, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("corte", "AbortError")));
      });
    const p = exportarServidor({
      fetch: (u, i) => (u.includes("dinero") ? colgado(u, i) : json(TIEMPO)),
      ahora: AHORA,
      descargar,
    });
    await vi.advanceTimersByTimeAsync(15000);
    expect(await p).toEqual({ ok: false });
    expect(descargar).not.toHaveBeenCalled();
  });
});
