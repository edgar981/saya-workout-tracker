import { describe, expect, it } from "vitest";

import {
  MAX_CUERPO_DINERO_BYTES,
  anotarSaldo,
  crearCuenta,
  crearDeuda,
  leerCuentas,
  leerDeudas,
  origenPermitido,
  type AlmacenDinero,
  type FilaCuenta,
  type FilaDeuda,
  type FilaExtracto,
  type FilaSaldoCuenta,
  type FilaSaldoDeuda,
} from "./servidor";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const D = (s: string) => new Date(s);

interface Estado {
  cuentas: FilaCuenta[];
  saldosCuentas: FilaSaldoCuenta[];
  deudas: FilaDeuda[];
  saldosDeudas: FilaSaldoDeuda[];
  extractos: FilaExtracto[];
}

/** Un almacén en memoria que cuenta sus escrituras y puede fallar a pedido. */
function falso(inicial: Partial<Estado> = {}, falla?: () => unknown) {
  const e: Estado = {
    cuentas: [],
    saldosCuentas: [],
    deudas: [],
    saldosDeudas: [],
    extractos: [],
    ...inicial,
  };
  const c = { escrituras: 0 };
  const ultimo = <T extends { anotado_en: Date }>(l: T[]) =>
    [...l].sort((a, b) => b.anotado_en.getTime() - a.anotado_en.getTime())[0] ?? null;
  const escribir = () => {
    c.escrituras++;
    const f = falla?.();
    if (f) throw f;
  };
  const almacen: AlmacenDinero = {
    cuentas: async () => e.cuentas,
    saldosCuentas: async () => e.saldosCuentas,
    deudas: async () => e.deudas,
    saldosDeudas: async () => e.saldosDeudas,
    extractos: async () => e.extractos,
    cuentaPorId: async (id) => e.cuentas.find((x) => x.id === id) ?? null,
    ultimoSaldoDeCuenta: async (id) => ultimo(e.saldosCuentas.filter((s) => s.cuenta_id === id)),
    deudaPorId: async (id) => e.deudas.find((x) => x.id === id) ?? null,
    ultimoSaldoDeDeuda: async (id) => ultimo(e.saldosDeudas.filter((s) => s.deuda_id === id)),
    extractoDeDeuda: async (id) => e.extractos.find((x) => x.deuda_id === id) ?? null,
    saldoCuentaPorId: async (id) => e.saldosCuentas.find((x) => x.id === id) ?? null,
    saldoDeudaPorId: async (id) => e.saldosDeudas.find((x) => x.id === id) ?? null,
    crearCuentaConSaldo: async ({ cuenta, saldo }) => {
      escribir();
      const fc = { ...cuenta, creada_en: D("2026-11-01T00:00:00Z") };
      const fs = { id: saldo.id, cuenta_id: cuenta.id, valor: saldo.valor, anotado_en: D("2026-11-01T00:00:00Z") };
      e.cuentas.push(fc);
      e.saldosCuentas.push(fs);
      return { cuenta: fc, saldo: fs };
    },
    crearDeudaConSaldo: async ({ deuda, saldo }) => {
      escribir();
      const fd: FilaDeuda = {
        ...deuda,
        cupo: null,
        monto_inicial: null,
        ultimos4: null,
        cuotas_total: null,
        dia_pago: null,
        primera_cuota: null,
        creada_en: D("2026-11-01T00:00:00Z"),
      };
      const fs = { id: saldo.id, deuda_id: deuda.id, valor: saldo.valor, anotado_en: D("2026-11-01T00:00:00Z") };
      e.deudas.push(fd);
      e.saldosDeudas.push(fs);
      return { deuda: fd, saldo: fs };
    },
    crearSaldoCuenta: async (d) => {
      escribir();
      const f = { ...d, anotado_en: D("2026-11-02T00:00:00Z") };
      e.saldosCuentas.push(f);
      return f;
    },
    crearSaldoDeuda: async (d) => {
      escribir();
      const f = { ...d, anotado_en: D("2026-11-02T00:00:00Z") };
      e.saldosDeudas.push(f);
      return f;
    },
  };
  return { almacen, estado: e, contador: c };
}

const cuentaOk = {
  id: U(1),
  banco: "  Davivienda ",
  tipo: "Ahorros",
  ultimos4: "4821",
  saldo: { id: U(2), valor: 1500000 },
};
const deudaOk = {
  id: U(3),
  tipo: "credito",
  nombre: " Libre inversión ",
  con_quien: "Davivienda",
  tasa_ea: 18.9,
  cuota: 645600,
  saldo: { id: U(4), valor: 12546900 },
};

const j = (o: unknown) => JSON.stringify(o);
const cuerpo = (r: { cuerpo: unknown }) => r.cuerpo as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("crearCuenta", () => {
  it("201 con cuenta y saldo, con trim", async () => {
    const { almacen, estado } = falso();
    const r = await crearCuenta(j(cuentaOk), almacen);
    expect(r.status).toBe(201);
    expect(cuerpo(r).banco).toBe("Davivienda");
    expect(cuerpo(r).saldo).toMatchObject({ id: U(2), valor: 1500000 });
    expect(estado.cuentas).toHaveLength(1);
    expect(estado.saldosCuentas).toHaveLength(1);
  });

  it("el mismo id da 200 con la existente y no escribe", async () => {
    const f = falso();
    await crearCuenta(j(cuentaOk), f.almacen);
    const antes = f.contador.escrituras;
    const r = await crearCuenta(j({ ...cuentaOk, banco: "Otro" }), f.almacen);
    expect(r.status).toBe(200);
    expect(cuerpo(r).banco).toBe("Davivienda");
    expect(cuerpo(r).saldo.valor).toBe(1500000);
    expect(f.contador.escrituras).toBe(antes);
  });

  it.each([
    ["tipo fuera de la lista", { tipo: "Nómina" }],
    ["ultimos4 de tres dígitos", { ultimos4: "482" }],
    ["valor negativo", { saldo: { id: U(2), valor: -1 } }],
    ["valor con decimales", { saldo: { id: U(2), valor: 10.5 } }],
    ["valor inseguro", { saldo: { id: U(2), valor: 2 ** 60 } }],
    ["banco vacío", { banco: "   " }],
    ["banco de 41", { banco: "x".repeat(41) }],
    ["id que no es uuid", { id: "nope" }],
    ["saldo ausente", { saldo: undefined }],
  ])("400 sin tocar el almacén: %s", async (_n, cambio) => {
    const f = falso();
    const r = await crearCuenta(j({ ...cuentaOk, ...cambio }), f.almacen);
    expect(r.status).toBe(400);
    expect(f.contador.escrituras).toBe(0);
  });

  it("JSON inválido o que no es objeto: 400", async () => {
    const f = falso();
    expect((await crearCuenta("{", f.almacen)).status).toBe(400);
    expect((await crearCuenta("[]", f.almacen)).status).toBe(400);
    expect(f.contador.escrituras).toBe(0);
  });

  it("ultimos4 null se acepta", async () => {
    const f = falso();
    expect((await crearCuenta(j({ ...cuentaOk, ultimos4: null }), f.almacen)).status).toBe(201);
  });
});

describe("crearDeuda", () => {
  it("201 con trim y sin campos de la ronda siguiente", async () => {
    const f = falso();
    const r = await crearDeuda(j({ ...deudaOk, cupo: 5, dia_pago: 3 }), f.almacen);
    expect(r.status).toBe(201);
    expect(cuerpo(r)).toMatchObject({
      nombre: "Libre inversión",
      tasa_ea: 18.9,
      cuota: 645600,
      cupo: null,
      dia_pago: null,
      extracto: null,
    });
    expect(cuerpo(r).saldo.valor).toBe(12546900);
  });

  it("tasa y cuota null, con_quien vacío", async () => {
    const f = falso();
    const r = await crearDeuda(
      j({ ...deudaOk, tipo: "personal", con_quien: "", tasa_ea: null, cuota: null }),
      f.almacen,
    );
    expect(r.status).toBe(201);
  });

  it("el mismo id da 200", async () => {
    const f = falso();
    await crearDeuda(j(deudaOk), f.almacen);
    const antes = f.contador.escrituras;
    const r = await crearDeuda(j({ ...deudaOk, nombre: "Otra" }), f.almacen);
    expect(r.status).toBe(200);
    expect(cuerpo(r).nombre).toBe("Libre inversión");
    expect(f.contador.escrituras).toBe(antes);
  });

  it.each([
    ["tipo fuera de la lista", { tipo: "hipoteca" }],
    ["tasa de tres decimales", { tasa_ea: 26.456 }],
    ["tasa de 201", { tasa_ea: 201 }],
    ["tasa negativa", { tasa_ea: -1 }],
    ["cuota 0", { cuota: 0 }],
    ["cuota con decimales", { cuota: 10.5 }],
    ["valor negativo", { saldo: { id: U(4), valor: -5 } }],
    ["nombre vacío", { nombre: " " }],
    ["nombre de 61", { nombre: "x".repeat(61) }],
    ["con_quien de 61", { con_quien: "x".repeat(61) }],
    ["tasa ausente", { tasa_ea: undefined }],
  ])("400 sin tocar el almacén: %s", async (_n, cambio) => {
    const f = falso();
    const r = await crearDeuda(j({ ...deudaOk, ...cambio }), f.almacen);
    expect(r.status).toBe(400);
    expect(f.contador.escrituras).toBe(0);
  });

  it("tasa de dos decimales y de 0 se aceptan", async () => {
    const f = falso();
    expect((await crearDeuda(j({ ...deudaOk, tasa_ea: 26.45 }), f.almacen)).status).toBe(201);
    expect((await crearDeuda(j({ ...deudaOk, id: U(9), saldo: { id: U(8), valor: 1 }, tasa_ea: 0 }), f.almacen)).status).toBe(201);
  });
});

describe("anotarSaldo", () => {
  const base = {
    cuentas: [{ id: U(1), banco: "Nu", tipo: "Cuenta", ultimos4: null, creada_en: D("2026-01-01T00:00:00Z") }],
    deudas: [
      {
        id: U(3), tipo: "personal", nombre: "P", con_quien: "", tasa_ea: null, cuota: null, cupo: null,
        monto_inicial: null, ultimos4: null, cuotas_total: null, dia_pago: null, primera_cuota: null,
        creada_en: D("2026-01-01T00:00:00Z"),
      },
    ],
  };

  it("201 para una cuenta y para una deuda", async () => {
    const f = falso(base);
    const a = await anotarSaldo(j({ id: U(5), cuenta_id: U(1), valor: 100 }), f.almacen);
    expect(a.status).toBe(201);
    expect(cuerpo(a)).toMatchObject({ id: U(5), cuenta_id: U(1), valor: 100 });
    expect(cuerpo(a).deuda_id).toBeUndefined();
    expect(typeof cuerpo(a).anotado_en).toBe("string");
    const b = await anotarSaldo(j({ id: U(6), deuda_id: U(3), valor: 0 }), f.almacen);
    expect(b.status).toBe(201);
    expect(cuerpo(b)).toMatchObject({ id: U(6), deuda_id: U(3), valor: 0 });
  });

  it("el mismo id, en cualquiera de las dos tablas, da 200 con el existente", async () => {
    const f = falso(base);
    await anotarSaldo(j({ id: U(5), cuenta_id: U(1), valor: 100 }), f.almacen);
    await anotarSaldo(j({ id: U(6), deuda_id: U(3), valor: 7 }), f.almacen);
    const antes = f.contador.escrituras;
    const a = await anotarSaldo(j({ id: U(5), cuenta_id: U(1), valor: 999 }), f.almacen);
    const b = await anotarSaldo(j({ id: U(6), deuda_id: U(3), valor: 999 }), f.almacen);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(cuerpo(a).valor).toBe(100);
    expect(cuerpo(b).valor).toBe(7);
    expect(f.contador.escrituras).toBe(antes);
  });

  it.each([
    ["los dos dueños", { cuenta_id: U(1), deuda_id: U(3) }],
    ["ninguno", {}],
    ["valor negativo", { cuenta_id: U(1), valor: -1 }],
    ["valor con decimales", { cuenta_id: U(1), valor: 1.5 }],
    ["dueño que no es uuid", { cuenta_id: "x" }],
  ])("400 sin tocar el almacén: %s", async (_n, cambio) => {
    const f = falso(base);
    const r = await anotarSaldo(j({ id: U(5), valor: 10, ...cambio }), f.almacen);
    expect(r.status).toBe(400);
    expect(f.contador.escrituras).toBe(0);
  });

  it("JSON inválido: 400", async () => {
    const f = falso(base);
    expect((await anotarSaldo("nope", f.almacen)).status).toBe(400);
  });
});

describe("las lecturas", () => {
  const estado: Partial<Estado> = {
    cuentas: [
      { id: U(2), banco: "Nu", tipo: "Cuenta", ultimos4: null, creada_en: D("2026-02-01T00:00:00Z") },
      { id: U(1), banco: "Bancolombia", tipo: "Ahorros", ultimos4: "4821", creada_en: D("2026-01-01T00:00:00Z") },
      { id: U(7), banco: "Vacía", tipo: "Cuenta", ultimos4: null, creada_en: D("2026-03-01T00:00:00Z") },
    ],
    saldosCuentas: [
      { id: U(10), cuenta_id: U(1), valor: 3000000n, anotado_en: D("2026-11-01T10:00:00Z") },
      { id: U(11), cuenta_id: U(1), valor: 3482150n, anotado_en: D("2026-11-08T21:40:00Z") },
      { id: U(12), cuenta_id: U(2), valor: 1250000n, anotado_en: D("2026-11-05T10:00:00Z") },
    ],
    deudas: [
      {
        id: U(3), tipo: "tarjeta", nombre: "Tarjeta Mastercard", con_quien: "Bancolombia", tasa_ea: 26.4,
        cuota: null, cupo: 6000000n, monto_inicial: null, ultimos4: "7730", cuotas_total: null, dia_pago: null,
        primera_cuota: D("2025-10-28T00:00:00Z"), creada_en: D("2026-01-01T00:00:00Z"),
      },
    ],
    saldosDeudas: [{ id: U(20), deuda_id: U(3), valor: 2940000n, anotado_en: D("2026-11-08T00:00:00Z") }],
    extractos: [
      { id: U(30), deuda_id: U(3), cierre: D("2026-09-30T00:00:00Z"), intereses: 1n, pago_minimo: null, fecha_limite: null, anotado_en: D("2026-10-01T00:00:00Z") },
      { id: U(31), deuda_id: U(3), cierre: D("2026-10-30T00:00:00Z"), intereses: 57900n, pago_minimo: 312000n, fecha_limite: D("2026-11-15T00:00:00Z"), anotado_en: D("2026-10-30T12:00:00Z") },
    ],
  };

  it("cuentas: por creada_en, último saldo, bigint como número, null sin saldo", async () => {
    const r = await leerCuentas(falso(estado).almacen);
    expect(r.status).toBe(200);
    const l = cuerpo(r).cuentas;
    expect(l.map((c: { banco: string }) => c.banco)).toEqual(["Bancolombia", "Nu", "Vacía"]);
    expect(l[0].saldo).toEqual({ id: U(11), valor: 3482150, anotado_en: "2026-11-08T21:40:00.000Z" });
    expect(typeof l[0].saldo.valor).toBe("number");
    expect(l[2].saldo).toBeNull();
    expect(l[0].creada_en).toBe("2026-01-01T00:00:00.000Z");
  });

  it("deudas: campos, último saldo, último extracto y fechas YYYY-MM-DD", async () => {
    const r = await leerDeudas(falso(estado).almacen);
    expect(r.status).toBe(200);
    const d = cuerpo(r).deudas[0];
    expect(d).toMatchObject({
      tasa_ea: 26.4, cuota: null, cupo: 6000000, ultimos4: "7730", primera_cuota: "2025-10-28",
    });
    expect(d.saldo.valor).toBe(2940000);
    expect(d.extracto).toEqual({
      id: U(31), cierre: "2026-10-30", intereses: 57900, pago_minimo: 312000,
      fecha_limite: "2026-11-15", anotado_en: "2026-10-30T12:00:00.000Z",
    });
  });

  it("las listas vacías", async () => {
    expect(cuerpo(await leerCuentas(falso().almacen)).cuentas).toEqual([]);
    expect(cuerpo(await leerDeudas(falso().almacen)).deudas).toEqual([]);
  });

  it("un fallo de lectura es 503", async () => {
    const f = falso();
    f.almacen.cuentas = async () => {
      throw new Error("base caída");
    };
    f.almacen.deudas = f.almacen.cuentas as never;
    expect((await leerCuentas(f.almacen)).status).toBe(503);
    expect((await leerDeudas(f.almacen)).status).toBe(503);
  });
});

describe("los errores del almacén", () => {
  const err = (code?: string) => Object.assign(new Error("x"), code ? { code } : {});

  it.each(["P2023", "P2003"])("%s da 400", async (code) => {
    const f = falso({}, () => err(code));
    expect((await crearCuenta(j(cuentaOk), f.almacen)).status).toBe(400);
    expect((await crearDeuda(j(deudaOk), f.almacen)).status).toBe(400);
    expect((await anotarSaldo(j({ id: U(5), cuenta_id: U(1), valor: 1 }), f.almacen)).status).toBe(400);
  });

  it("P2002 devuelve lo que existe", async () => {
    const f = falso();
    let primera = true;
    const original = f.almacen.cuentaPorId;
    // La primera búsqueda no ve nada; entre medias otro la crea; la creación choca.
    f.almacen.cuentaPorId = async (id) => {
      if (primera) {
        primera = false;
        return null;
      }
      return original(id);
    };
    f.almacen.crearCuentaConSaldo = async ({ cuenta, saldo }) => {
      f.estado.cuentas.push({ ...cuenta, creada_en: D("2026-11-01T00:00:00Z") });
      f.estado.saldosCuentas.push({ id: saldo.id, cuenta_id: cuenta.id, valor: saldo.valor, anotado_en: D("2026-11-01T00:00:00Z") });
      throw err("P2002");
    };
    const r = await crearCuenta(j(cuentaOk), f.almacen);
    expect(r.status).toBe(200);
    expect(cuerpo(r).id).toBe(U(1));
  });

  it("P2002 sin nada que devolver es 400", async () => {
    const f = falso({}, () => err("P2002"));
    expect((await crearCuenta(j(cuentaOk), f.almacen)).status).toBe(400);
  });

  it("otro error es 503, nunca 500", async () => {
    const f = falso({}, () => err());
    for (const r of [
      await crearCuenta(j(cuentaOk), f.almacen),
      await crearDeuda(j(deudaOk), f.almacen),
      await anotarSaldo(j({ id: U(5), cuenta_id: U(1), valor: 1 }), f.almacen),
    ]) {
      expect(r.status).toBe(503);
      expect(cuerpo(r).error).toBe("No se pudo leer o guardar.");
    }
  });
});

describe("origenPermitido y el tope", () => {
  it("sólo el origen exacto", () => {
    expect(origenPermitido("https://a.app", "https://a.app/ruta")).toBe(true);
    expect(origenPermitido("https://b.app", "https://a.app")).toBe(false);
    expect(origenPermitido(null, "https://a.app")).toBe(false);
    expect(origenPermitido("https://a.app", undefined)).toBe(false);
    expect(origenPermitido("https://a.app", "no es url")).toBe(false);
  });
  it("el tope", () => {
    expect(MAX_CUERPO_DINERO_BYTES).toBe(4096);
  });
});
