import { describe, expect, it } from "vitest";
import { filasDelServidor, type DatosServidor } from "./servidor";

const Z = (s: string) => new Date(s);
const OCT = { desde: "2026-10-01", hasta: "2026-10-31" };

const datos: DatosServidor = {
  dinero: {
    cuentas: [
      { id: "c-b", banco: "Nu", tipo: "Ahorros", ultimos4: "4821", creada_en: Z("2026-02-01T00:00:00Z") },
      { id: "c-a", banco: "Bancolombia", tipo: "Corriente", ultimos4: null, creada_en: Z("2026-01-01T00:00:00Z") },
    ],
    saldosCuentas: [
      { id: "s1", cuenta_id: "c-a", valor: BigInt(100), anotado_en: Z("2026-08-10T15:00:00Z") },
      { id: "s2", cuenta_id: "c-a", valor: BigInt(200), anotado_en: Z("2026-09-10T15:00:00Z") },
      { id: "s3", cuenta_id: "c-a", valor: BigInt(300), anotado_en: Z("2026-10-10T15:00:00Z") },
      { id: "s4", cuenta_id: "c-a", valor: BigInt(400), anotado_en: Z("2026-11-10T15:00:00Z") },
      { id: "s5", cuenta_id: "c-b", valor: BigInt(999), anotado_en: Z("2026-10-31T00:00:00Z") },
    ],
    deudas: [
      {
        id: "d-2", tipo: "credito", nombre: "Moto", con_quien: "Banco Y", tasa_ea: 21.5, cuota: BigInt(500000),
        cupo: null, monto_inicial: BigInt(9000000), ultimos4: "7777", cuotas_total: 24, dia_pago: 5,
        primera_cuota: Z("2026-03-05T00:00:00Z"), creada_en: Z("2026-03-01T00:00:00Z"),
      },
      {
        id: "d-1", tipo: "tarjeta", nombre: "Visa", con_quien: "Banco X", tasa_ea: null, cuota: null,
        cupo: BigInt(3000000), monto_inicial: null, ultimos4: "1234", cuotas_total: null, dia_pago: null,
        primera_cuota: null, creada_en: Z("2026-01-15T00:00:00Z"),
      },
    ],
    saldosDeudas: [
      { id: "sd1", deuda_id: "d-1", valor: BigInt(50), anotado_en: Z("2026-09-01T12:00:00Z") },
      { id: "sd2", deuda_id: "d-1", valor: BigInt(60), anotado_en: Z("2026-10-15T12:00:00Z") },
      { id: "sd3", deuda_id: "d-2", valor: BigInt(70), anotado_en: Z("2026-10-20T12:00:00Z") },
    ],
    extractos: [
      { id: "e1", deuda_id: "d-1", cierre: Z("2026-08-30T00:00:00Z"), intereses: BigInt(10), pago_minimo: null, fecha_limite: null, anotado_en: Z("2026-09-01T00:00:00Z") },
      { id: "e2", deuda_id: "d-1", cierre: Z("2026-09-30T00:00:00Z"), intereses: BigInt(20), pago_minimo: BigInt(5), fecha_limite: Z("2026-10-15T00:00:00Z"), anotado_en: Z("2026-10-01T00:00:00Z") },
      { id: "e3", deuda_id: "d-1", cierre: Z("2026-10-30T00:00:00Z"), intereses: BigInt(30), pago_minimo: null, fecha_limite: null, anotado_en: Z("2026-10-31T00:00:00Z") },
      { id: "e4", deuda_id: "d-1", cierre: Z("2026-10-30T00:00:00Z"), intereses: BigInt(31), pago_minimo: null, fecha_limite: null, anotado_en: Z("2026-11-02T00:00:00Z") },
    ],
  },
  tiempo: {
    temas: [
      { id: "t-2", nombre: "Inglés", creado_en: Z("2026-02-01T00:00:00Z") },
      { id: "t-1", nombre: "Código", creado_en: Z("2026-01-01T00:00:00Z") },
    ],
    registros: [
      { id: "r1", tema_id: "t-2", minutos: 30, fecha: Z("2026-10-05T00:00:00Z"), anotado_en: Z("2026-10-05T20:00:00Z") },
      { id: "r2", tema_id: "t-1", minutos: 45, fecha: Z("2026-10-05T00:00:00Z"), anotado_en: Z("2026-10-05T10:00:00Z") },
      { id: "r3", tema_id: "t-1", minutos: 60, fecha: Z("2026-09-30T00:00:00Z"), anotado_en: Z("2026-09-30T10:00:00Z") },
      { id: "r4", tema_id: "t-1", minutos: 15, fecha: Z("2026-10-31T00:00:00Z"), anotado_en: Z("2026-10-31T10:00:00Z") },
      { id: "r5", tema_id: "t-ausente", minutos: 99, fecha: Z("2026-10-06T00:00:00Z"), anotado_en: Z("2026-10-06T10:00:00Z") },
    ],
  },
};

describe("filasDelServidor", () => {
  const filas = filasDelServidor(datos, OCT, 300);
  const de = (tipo: string) => filas.filter((f) => f.tipo === tipo);

  it("el orden de las siete reglas", () => {
    const orden = filas.map((f) => f.tipo);
    const esperado = ["cuenta", "saldo_cuenta", "deuda", "saldo_deuda", "extracto", "tema", "tiempo"];
    const vistos = esperado.filter((t) => orden.includes(t as never));
    expect(vistos).toEqual(esperado);
    expect(orden).toEqual([...orden].sort((a, b) => esperado.indexOf(a) - esperado.indexOf(b)));
  });

  it("cuentas por creada_en, numeradas desde 1, con banco y clase", () => {
    expect(de("cuenta")).toEqual([
      { tipo: "cuenta", n: 1, banco: "Bancolombia", clase: "Corriente" },
      { tipo: "cuenta", n: 2, banco: "Nu", clase: "Ahorros" },
    ]);
  });

  it("saldos de cuenta: los del periodo y uno solo anterior a desde", () => {
    expect(de("saldo_cuenta")).toEqual([
      { tipo: "saldo_cuenta", cuenta: 1, fecha: "2026-09-10", valor: 200 },
      { tipo: "saldo_cuenta", cuenta: 1, fecha: "2026-10-10", valor: 300 },
      { tipo: "saldo_cuenta", cuenta: 2, fecha: "2026-10-30", valor: 999 },
    ]);
  });

  it("deudas por creada_en con bigint a número, null sigue null y fechas YYYY-MM-DD", () => {
    expect(de("deuda")).toEqual([
      {
        tipo: "deuda", n: 1, clase: "tarjeta", nombre: "Visa", con_quien: "Banco X", tasa_ea: null,
        cuota: null, cupo: 3000000, monto_inicial: null, cuotas_total: null, dia_pago: null, primera_cuota: null,
      },
      {
        tipo: "deuda", n: 2, clase: "credito", nombre: "Moto", con_quien: "Banco Y", tasa_ea: 21.5,
        cuota: 500000, cupo: null, monto_inicial: 9000000, cuotas_total: 24, dia_pago: 5, primera_cuota: "2026-03-05",
      },
    ]);
  });

  it("saldos de deuda con la misma regla", () => {
    expect(de("saldo_deuda")).toEqual([
      { tipo: "saldo_deuda", deuda: 1, fecha: "2026-09-01", valor: 50 },
      { tipo: "saldo_deuda", deuda: 1, fecha: "2026-10-15", valor: 60 },
      { tipo: "saldo_deuda", deuda: 2, fecha: "2026-10-20", valor: 70 },
    ]);
  });

  it("extractos: el último anterior a desde, los del periodo, y con el mismo cierre el más reciente", () => {
    expect(de("extracto")).toEqual([
      { tipo: "extracto", deuda: 1, cierre: "2026-09-30", intereses: 20, pago_minimo: 5, fecha_limite: "2026-10-15" },
      { tipo: "extracto", deuda: 1, cierre: "2026-10-30", intereses: 31, pago_minimo: null, fecha_limite: null },
    ]);
  });

  it("temas por nombre", () => {
    expect(de("tema")).toEqual([
      { tipo: "tema", nombre: "Código" },
      { tipo: "tema", nombre: "Inglés" },
    ]);
  });

  it("tiempo del periodo por fecha y anotado_en; un tema ausente se salta", () => {
    expect(de("tiempo")).toEqual([
      { tipo: "tiempo", fecha: "2026-10-05", tema: "Código", minutos: 45 },
      { tipo: "tiempo", fecha: "2026-10-05", tema: "Inglés", minutos: 30 },
      { tipo: "tiempo", fecha: "2026-10-31", tema: "Código", minutos: 15 },
    ]);
  });

  it("las 23:30 de Colombia del 31 oct (04:30Z del 1 nov): octubre con desfase 300, noviembre con 0", () => {
    const d: DatosServidor = {
      ...datos,
      dinero: {
        ...datos.dinero,
        cuentas: [datos.dinero.cuentas[0]],
        saldosCuentas: [{ id: "x", cuenta_id: "c-b", valor: BigInt(5), anotado_en: Z("2026-11-01T04:30:00Z") }],
        deudas: [],
        saldosDeudas: [],
        extractos: [],
      },
    };
    const con = filasDelServidor(d, OCT, 300).filter((f) => f.tipo === "saldo_cuenta");
    expect(con).toEqual([{ tipo: "saldo_cuenta", cuenta: 1, fecha: "2026-10-31", valor: 5 }]);
    const sin = filasDelServidor(d, OCT, 0).filter((f) => f.tipo === "saldo_cuenta");
    expect(sin).toEqual([]);
    const nov = filasDelServidor(d, { desde: "2026-11-01", hasta: "2026-11-30" }, 0);
    expect(nov.filter((f) => f.tipo === "saldo_cuenta")).toEqual([
      { tipo: "saldo_cuenta", cuenta: 1, fecha: "2026-11-01", valor: 5 },
    ]);
  });

  it("un saldo con fecha local igual a desde es del periodo; el «último anterior» es el de antes", () => {
    const d: DatosServidor = {
      ...datos,
      dinero: {
        ...datos.dinero,
        cuentas: [datos.dinero.cuentas[1]],
        saldosCuentas: [
          { id: "a", cuenta_id: "c-a", valor: BigInt(1), anotado_en: Z("2026-09-20T15:00:00Z") },
          { id: "b", cuenta_id: "c-a", valor: BigInt(2), anotado_en: Z("2026-09-30T15:00:00Z") },
          { id: "c", cuenta_id: "c-a", valor: BigInt(3), anotado_en: Z("2026-10-01T15:00:00Z") },
        ],
        deudas: [],
        saldosDeudas: [],
        extractos: [],
      },
    };
    const f = filasDelServidor(d, OCT, 300).filter((x) => x.tipo === "saldo_cuenta");
    expect(f).toEqual([
      { tipo: "saldo_cuenta", cuenta: 1, fecha: "2026-09-30", valor: 2 },
      { tipo: "saldo_cuenta", cuenta: 1, fecha: "2026-10-01", valor: 3 },
    ]);
  });

  it("nunca sale ultimos4, ningún id ni marcas de tiempo", () => {
    const json = JSON.stringify(filas);
    expect(json).not.toContain("4821");
    expect(json).not.toContain("7777");
    expect(json).not.toContain("1234\"");
    expect(json).not.toContain("ultimos4");
    for (const id of ["c-a", "c-b", "d-1", "d-2", "s1", "sd1", "e1", "t-1", "t-2", "r1"]) {
      expect(json).not.toContain(`"${id}"`);
    }
    for (const clave of ["\"id\"", "anotado_en", "creada_en", "creado_en", "_id"]) {
      expect(json).not.toContain(clave);
    }
  });

  it("sin datos → ninguna fila", () => {
    expect(
      filasDelServidor(
        {
          dinero: { cuentas: [], saldosCuentas: [], deudas: [], saldosDeudas: [], extractos: [] },
          tiempo: { temas: [], registros: [] },
        },
        OCT,
        300,
      ),
    ).toEqual([]);
  });
});
