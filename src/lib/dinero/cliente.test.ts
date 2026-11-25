import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ESPERA_DINERO_MS,
  anotarExtracto,
  anotarSaldo,
  crearCuenta,
  crearDeuda,
  leerCuentas,
  leerDeudas,
  type Fetch,
} from "./cliente";

const respuesta = (status: number, cuerpo: unknown = {}): Fetch =>
  vi.fn(async () => new Response(JSON.stringify(cuerpo), { status }));

afterEach(() => vi.useRealTimers());

const cuenta = { id: "a", banco: "Nu", tipo: "Cuenta", ultimos4: null, saldo: { id: "s", valor: 0 } };
const deuda = {
  id: "d", tipo: "personal", nombre: "P", con_quien: "", tasa_ea: null, cuota: null,
  cupo: null, monto_inicial: null, ultimos4: null, cuotas_total: null, dia_pago: null, primera_cuota: null,
  saldo: { id: "s", valor: 5 },
};
const extracto = {
  id: "e", deuda_id: "d", cierre: "2026-10-30", intereses: 0, pago_minimo: null, fecha_limite: null,
};

describe("cliente de Dinero", () => {
  it("200 y 201 dan ok con los datos", async () => {
    const cs = { cuentas: [] };
    expect(await leerCuentas({ fetch: respuesta(200, cs) })).toEqual({ ok: true, datos: cs });
    const ds = { deudas: [] };
    expect(await leerDeudas({ fetch: respuesta(200, ds) })).toEqual({ ok: true, datos: ds });
    expect((await crearCuenta(cuenta, { fetch: respuesta(201, cuenta) })).ok).toBe(true);
    expect((await crearDeuda(deuda, { fetch: respuesta(200, deuda) })).ok).toBe(true);
    expect((await anotarSaldo({ id: "x", cuenta_id: "a", valor: 1 }, { fetch: respuesta(201, {}) })).ok).toBe(
      true,
    );
  });

  it("401, 403, 503 y 400 dan ok: false", async () => {
    for (const s of [401, 403, 503, 400]) {
      expect(await leerCuentas({ fetch: respuesta(s) })).toEqual({ ok: false });
      expect(await leerDeudas({ fetch: respuesta(s) })).toEqual({ ok: false });
      expect(await crearCuenta(cuenta, { fetch: respuesta(s) })).toEqual({ ok: false });
      expect(await anotarSaldo({ id: "x", deuda_id: "d", valor: 1 }, { fetch: respuesta(s) })).toEqual({
        ok: false,
      });
    }
  });

  it("un rechazo de red da ok: false", async () => {
    const f: Fetch = () => Promise.reject(new TypeError("red"));
    expect(await leerCuentas({ fetch: f })).toEqual({ ok: false });
  });

  it("un cuerpo que no es JSON da ok: false", async () => {
    const f: Fetch = async () => new Response("<html>", { status: 200 });
    expect(await leerDeudas({ fetch: f })).toEqual({ ok: false });
  });

  it("las rutas y los POST", async () => {
    const g = respuesta(200, {});
    await leerDeudas({ fetch: g });
    expect((g as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/api/dinero/deudas");
    const f = respuesta(201, {});
    await anotarSaldo({ id: "x", cuenta_id: "a", valor: 1 }, { fetch: f });
    const [url, init] = (f as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/dinero/saldos");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ id: "x", cuenta_id: "a", valor: 1 }));
  });

  it("anotarExtracto: POST /api/dinero/extractos, 201 ok, el resto no", async () => {
    const f = respuesta(201, extracto);
    expect(await anotarExtracto(extracto, { fetch: f })).toEqual({ ok: true, datos: extracto });
    const [url, init] = (f as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/dinero/extractos");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(extracto));
    expect((await anotarExtracto(extracto, { fetch: respuesta(200, extracto) })).ok).toBe(true);
    for (const s of [401, 403, 503, 400]) {
      expect(await anotarExtracto(extracto, { fetch: respuesta(s) })).toEqual({ ok: false });
    }
  });

  it("crearDeuda manda los seis campos nuevos tal cual", async () => {
    const f = respuesta(201, deuda);
    const c = { ...deuda, tipo: "credito", monto_inicial: 38000000, cuotas_total: 48, dia_pago: 25, primera_cuota: "2025-03-25" };
    await crearDeuda(c, { fetch: f });
    const [, init] = (f as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      cupo: null, monto_inicial: 38000000, ultimos4: null, cuotas_total: 48, dia_pago: 25, primera_cuota: "2025-03-25",
    });
  });

  it("anotarExtracto: la espera agotada da ok: false", async () => {
    vi.useFakeTimers();
    const f: Fetch = (_u, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("abort", "AbortError")));
      });
    const p = anotarExtracto(extracto, { fetch: f });
    await vi.advanceTimersByTimeAsync(ESPERA_DINERO_MS + 1);
    expect(await p).toEqual({ ok: false });
  });

  it("la espera agotada da ok: false", async () => {
    vi.useFakeTimers();
    const f: Fetch = (_u, init) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("abort", "AbortError")));
      });
    const p = leerCuentas({ fetch: f });
    await vi.advanceTimersByTimeAsync(ESPERA_DINERO_MS + 1);
    expect(await p).toEqual({ ok: false });
  });

  it("una señal ya abortada no pide nada", async () => {
    const f = respuesta(200);
    const c = new AbortController();
    c.abort();
    expect(await leerCuentas({ fetch: f, signal: c.signal })).toEqual({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
});
