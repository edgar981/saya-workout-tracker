import { afterEach, describe, expect, it, vi } from "vitest";

import { ESPERA_TIEMPO_MS, guardarRegistro, guardarTema, leer, type Fetch } from "./cliente";

const respuesta = (status: number, cuerpo: unknown = {}): Fetch =>
  vi.fn(async () => new Response(JSON.stringify(cuerpo), { status }));

afterEach(() => vi.useRealTimers());

describe("cliente de Tiempo", () => {
  it("200 y 201 dan ok con los datos", async () => {
    const datos = { temas: [], registros: [], primer_registro: null };
    expect(await leer("2026-10-07", { fetch: respuesta(200, datos) })).toEqual({ ok: true, datos });
    const tema = { id: "a", nombre: "b" };
    expect(await guardarTema(tema, { fetch: respuesta(201, tema) })).toEqual({ ok: true, datos: tema });
    const reg = { id: "a", tema_id: "b", minutos: 5, fecha: "2026-11-10" };
    const r = await guardarRegistro(reg, { fetch: respuesta(200, reg) });
    expect(r.ok).toBe(true);
  });

  it("401, 403, 503 y 400 dan ok: false", async () => {
    for (const s of [401, 403, 503, 400]) {
      expect(await leer("2026-10-07", { fetch: respuesta(s) })).toEqual({ ok: false });
      expect(await guardarTema({ id: "a", nombre: "b" }, { fetch: respuesta(s) })).toEqual({ ok: false });
    }
  });

  it("un rechazo de red da ok: false", async () => {
    const f: Fetch = () => Promise.reject(new TypeError("red"));
    expect(await leer("2026-10-07", { fetch: f })).toEqual({ ok: false });
  });

  it("un cuerpo que no es JSON da ok: false", async () => {
    const f: Fetch = async () => new Response("<html>", { status: 200 });
    expect(await leer("2026-10-07", { fetch: f })).toEqual({ ok: false });
  });

  it("los POST mandan content-type JSON y el cuerpo", async () => {
    const f = respuesta(201, {});
    await guardarTema({ id: "a", nombre: "b" }, { fetch: f });
    const [url, init] = (f as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tiempo/temas");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ id: "a", nombre: "b" }));
  });

  it("la espera agotada da ok: false", async () => {
    vi.useFakeTimers();
    const f: Fetch = (_u, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("abort", "AbortError")));
      });
    const p = leer("2026-10-07", { fetch: f });
    await vi.advanceTimersByTimeAsync(ESPERA_TIEMPO_MS + 1);
    expect(await p).toEqual({ ok: false });
  });

  it("una señal ya abortada no pide nada", async () => {
    const f = respuesta(200);
    const c = new AbortController();
    c.abort();
    expect(await leer("2026-10-07", { fetch: f, signal: c.signal })).toEqual({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
});
