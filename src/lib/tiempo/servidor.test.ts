import { describe, expect, it, vi } from "vitest";

import {
  crearRegistro,
  crearTema,
  leerTiempo,
  origenPermitido,
  type AlmacenTiempo,
  type FilaRegistro,
  type FilaTema,
} from "./servidor";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const R1 = "33333333-3333-4333-8333-333333333333";
const R2 = "44444444-4444-4444-8444-444444444444";

function almacen(
  inicial: { temas?: FilaTema[]; registros?: FilaRegistro[] } = {},
): AlmacenTiempo & { llamadas: string[] } {
  const temas = [...(inicial.temas ?? [])];
  const registros = [...(inicial.registros ?? [])];
  const llamadas: string[] = [];
  const marca = <T>(n: string, v: T): Promise<T> => {
    llamadas.push(n);
    return Promise.resolve(v);
  };
  return {
    llamadas,
    temas: () => marca("temas", temas),
    registrosDesde: (desde) => marca("registrosDesde", registros.filter((r) => r.fecha >= desde)),
    primerRegistro: () =>
      marca(
        "primerRegistro",
        registros.length ? new Date(Math.min(...registros.map((r) => r.fecha.getTime()))) : null,
      ),
    temaPorId: (id) => marca("temaPorId", temas.find((t) => t.id === id) ?? null),
    temaPorNombre: (n) => marca("temaPorNombre", temas.find((t) => t.nombre === n) ?? null),
    crearTema: ({ id, nombre }) => {
      const t = { id, nombre, creado_en: new Date("2026-11-10T12:00:00Z") };
      temas.push(t);
      return marca("crearTema", t);
    },
    registroPorId: (id) => marca("registroPorId", registros.find((r) => r.id === id) ?? null),
    crearRegistro: (d) => {
      const r = { ...d, anotado_en: new Date("2026-11-10T12:30:00Z") };
      registros.push(r);
      return marca("crearRegistro", r);
    },
  };
}

const tema = (id: string, nombre: string): FilaTema => ({
  id,
  nombre,
  creado_en: new Date("2026-11-01T00:00:00Z"),
});

describe("leerTiempo", () => {
  it("400 con «desde» inválido, sin tocar el almacén", async () => {
    const a = almacen();
    for (const d of [null, "", "ayer", "2026-02-30", "2026-1-1"]) {
      expect((await leerTiempo(d, a)).status).toBe(400);
    }
    expect(a.llamadas).toEqual([]);
  });

  it("200 con fechas YYYY-MM-DD de las partes UTC, aunque el Date caiga cerca de medianoche", async () => {
    const a = almacen({
      temas: [tema(T2, "Inglés"), tema(T1, "Agentes")],
      registros: [
        {
          id: R1,
          tema_id: T1,
          minutos: 30,
          fecha: new Date("2026-11-09T00:00:00.000Z"),
          anotado_en: new Date("2026-11-10T03:59:59.000Z"),
        },
        {
          id: R2,
          tema_id: T2,
          minutos: 45,
          fecha: new Date("2026-11-10T00:00:00.000Z"),
          anotado_en: new Date("2026-11-10T01:00:00.000Z"),
        },
      ],
    });
    const r = await leerTiempo("2026-10-07", a);
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({
      temas: [
        { id: T1, nombre: "Agentes" },
        { id: T2, nombre: "Inglés" },
      ],
      registros: [
        { id: R2, tema_id: T2, minutos: 45, fecha: "2026-11-10", anotado_en: "2026-11-10T01:00:00.000Z" },
        { id: R1, tema_id: T1, minutos: 30, fecha: "2026-11-09", anotado_en: "2026-11-10T03:59:59.000Z" },
      ],
      primer_registro: "2026-11-09",
    });
  });

  it("sin registros, primer_registro es null", async () => {
    const r = await leerTiempo("2026-10-07", almacen());
    expect(r.cuerpo).toMatchObject({ registros: [], primer_registro: null });
  });

  it("un fallo del almacén es 503", async () => {
    const a = almacen();
    a.temas = () => Promise.reject(new Error("x"));
    expect((await leerTiempo("2026-10-07", a)).status).toBe(503);
  });
});

describe("crearTema", () => {
  it("nuevo: 201", async () => {
    const a = almacen();
    const r = await crearTema(JSON.stringify({ id: T1, nombre: "  Agentes  " }), a);
    expect(r).toEqual({ status: 201, cuerpo: { id: T1, nombre: "Agentes" } });
  });
  it("mismo id: 200 con el mismo", async () => {
    const a = almacen({ temas: [tema(T1, "Agentes")] });
    const r = await crearTema(JSON.stringify({ id: T1, nombre: "Agentes" }), a);
    expect(r).toEqual({ status: 200, cuerpo: { id: T1, nombre: "Agentes" } });
    expect(a.llamadas).not.toContain("crearTema");
  });
  it("nombre repetido con otro id: 200 con el que existe", async () => {
    const a = almacen({ temas: [tema(T1, "Agentes")] });
    const r = await crearTema(JSON.stringify({ id: T2, nombre: "Agentes" }), a);
    expect(r).toEqual({ status: 200, cuerpo: { id: T1, nombre: "Agentes" } });
  });
  it("nombre vacío o de 61 caracteres: 400", async () => {
    const a = almacen();
    expect((await crearTema(JSON.stringify({ id: T1, nombre: "   " }), a)).status).toBe(400);
    expect((await crearTema(JSON.stringify({ id: T1, nombre: "x".repeat(61) }), a)).status).toBe(400);
    expect((await crearTema(JSON.stringify({ id: T1, nombre: "x".repeat(60) }), a)).status).toBe(201);
  });
  it("JSON inválido, id malo o campo ausente: 400 sin llamar al almacén", async () => {
    const a = almacen();
    for (const t of ["{", "[]", "null", JSON.stringify({ id: "no", nombre: "a" }), JSON.stringify({ id: T1 })]) {
      expect((await crearTema(t, a)).status).toBe(400);
    }
    expect(a.llamadas).toEqual([]);
  });
});

describe("crearRegistro", () => {
  const ok = { id: R1, tema_id: T1, minutos: 50, fecha: "2026-11-10" };
  it("nuevo: 201 con la forma de leerTiempo", async () => {
    const r = await crearRegistro(JSON.stringify(ok), almacen());
    expect(r).toEqual({
      status: 201,
      cuerpo: { ...ok, anotado_en: "2026-11-10T12:30:00.000Z" },
    });
  });
  it("mismo id: 200 con el que existe", async () => {
    const a = almacen();
    await crearRegistro(JSON.stringify(ok), a);
    const r = await crearRegistro(JSON.stringify({ ...ok, minutos: 99 }), a);
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ id: R1, minutos: 50 });
  });
  it("minutos 0, 1441 y 2,5: 400; la fecha 2026-02-30: 400", async () => {
    const a = almacen();
    for (const m of [0, 1441, 2.5, "50"]) {
      expect((await crearRegistro(JSON.stringify({ ...ok, minutos: m }), a)).status).toBe(400);
    }
    expect((await crearRegistro(JSON.stringify({ ...ok, fecha: "2026-02-30" }), a)).status).toBe(400);
    expect((await crearRegistro(JSON.stringify({ ...ok, minutos: 1440 }), a)).status).toBe(201);
  });
  it("JSON inválido o campo ausente: 400 sin tocar el almacén", async () => {
    const a = almacen();
    expect((await crearRegistro("{", a)).status).toBe(400);
    expect((await crearRegistro(JSON.stringify({ id: R1 }), a)).status).toBe(400);
    expect(a.llamadas).toEqual([]);
  });
});

describe("los errores del almacén", () => {
  const lanza = (code?: string) => Object.assign(new Error("boom"), code ? { code } : {});
  const reg = { id: R1, tema_id: T1, minutos: 50, fecha: "2026-11-10" };

  it("P2023 y P2003: 400", async () => {
    for (const code of ["P2023", "P2003"]) {
      const a = almacen();
      a.crearRegistro = () => Promise.reject(lanza(code));
      expect((await crearRegistro(JSON.stringify(reg), a)).status).toBe(400);
    }
    const a = almacen();
    a.crearTema = () => Promise.reject(lanza("P2023"));
    expect((await crearTema(JSON.stringify({ id: T1, nombre: "a" }), a)).status).toBe(400);
  });
  it("P2002 en crearTema: vuelve a buscar y devuelve el existente", async () => {
    const a = almacen();
    const existente = tema(T2, "Agentes");
    let primera = true;
    a.temaPorId = () => Promise.resolve(null);
    a.temaPorNombre = () => {
      if (primera) {
        primera = false;
        return Promise.resolve(null);
      }
      return Promise.resolve(existente);
    };
    a.crearTema = () => Promise.reject(lanza("P2002"));
    const r = await crearTema(JSON.stringify({ id: T1, nombre: "Agentes" }), a);
    expect(r).toEqual({ status: 200, cuerpo: { id: T2, nombre: "Agentes" } });
  });
  it("P2002 en crearRegistro: devuelve el existente", async () => {
    const a = almacen();
    const fila: FilaRegistro = {
      id: R1,
      tema_id: T1,
      minutos: 50,
      fecha: new Date("2026-11-10T00:00:00Z"),
      anotado_en: new Date("2026-11-10T12:00:00Z"),
    };
    const buscar = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(fila);
    a.registroPorId = buscar;
    a.crearRegistro = () => Promise.reject(lanza("P2002"));
    const r = await crearRegistro(JSON.stringify(reg), a);
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ id: R1, fecha: "2026-11-10" });
  });
  it("cualquier otro error: 503, nunca 500", async () => {
    for (const code of [undefined, "P1001"]) {
      const a = almacen();
      a.crearRegistro = () => Promise.reject(lanza(code));
      const r = await crearRegistro(JSON.stringify(reg), a);
      expect(r).toEqual({ status: 503, cuerpo: { error: "No se pudo leer o guardar." } });
    }
    const a = almacen();
    a.registroPorId = () => Promise.reject("texto");
    expect((await crearRegistro(JSON.stringify(reg), a)).status).toBe(503);
  });
});

describe("origenPermitido", () => {
  it("igual, distinto, sin Origin y sin baseUrl", () => {
    expect(origenPermitido("https://app.example.com", "https://app.example.com/ruta")).toBe(true);
    expect(origenPermitido("https://otra.example.com", "https://app.example.com")).toBe(false);
    expect(origenPermitido("http://app.example.com", "https://app.example.com")).toBe(false);
    expect(origenPermitido(null, "https://app.example.com")).toBe(false);
    expect(origenPermitido("https://app.example.com", undefined)).toBe(false);
    expect(origenPermitido("https://app.example.com", "no es una url")).toBe(false);
  });
});
