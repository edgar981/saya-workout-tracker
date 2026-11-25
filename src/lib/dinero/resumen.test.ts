import { describe, expect, it } from "vitest";

import {
  compactoCOP,
  deudasVisibles,
  disponible,
  fechaDePago,
  formatoCOP,
  formatoTasa,
  interesesDelMes,
  lineaCuenta,
  lineaDeuda,
  loQueDebes,
  mesAnterior,
  mesNombre,
  nombreLargo,
  pagosDelMes,
  parseCOP,
  parseTasa,
  plural,
  progresoDeuda,
  quedanDespuesDePagar,
} from "./resumen";
import type { CuentaDto, DeudaDto, ExtractoDto } from "./servidor";

const HOY = "2026-11-10";

const saldo = (valor: number, anotado = "2026-11-08T21:40:00.000Z") => ({
  id: "s",
  valor,
  anotado_en: anotado,
});

const cuenta = (banco: string, tipo: string, valor: number | null, ultimos4: string | null = null): CuentaDto => ({
  id: banco,
  banco,
  tipo,
  ultimos4,
  creada_en: "2026-01-01T00:00:00.000Z",
  saldo: valor === null ? null : saldo(valor),
});

const deuda = (o: Partial<DeudaDto>): DeudaDto => ({
  id: "d",
  tipo: "personal",
  nombre: "Deuda",
  con_quien: "",
  tasa_ea: null,
  cuota: null,
  cupo: null,
  monto_inicial: null,
  ultimos4: null,
  cuotas_total: null,
  dia_pago: null,
  primera_cuota: null,
  creada_en: "2026-01-01T00:00:00.000Z",
  saldo: null,
  extracto: null,
  extractos: [],
  ...o,
});

/** Un `extracto` y, con él, su lista de `extractos` (como los lee el servidor). */
const conExtractos = (d: DeudaDto, ...e: ExtractoDto[]): DeudaDto => ({
  ...d,
  extracto: e[0] ?? null,
  extractos: e,
});

const CUENTAS = [
  cuenta("Bancolombia", "Ahorros", 3482150, "4821"),
  cuenta("Nu", "Cuenta", 1250000),
  cuenta("Nequi", "Depósito", 186400),
];

const EXTRACTO_T: ExtractoDto = {
  id: "e1",
  cierre: "2026-10-30",
  intereses: 57900,
  pago_minimo: 312000,
  fecha_limite: "2026-11-15",
  anotado_en: "2026-10-30T12:00:00.000Z",
};

const TARJETA = deuda({
  id: "t",
  tipo: "tarjeta",
  nombre: "Tarjeta Mastercard",
  con_quien: "Bancolombia",
  ultimos4: "7730",
  tasa_ea: 26.4,
  cupo: 6000000,
  saldo: saldo(2940000),
  extracto: EXTRACTO_T,
  extractos: [EXTRACTO_T],
});

const EXTRACTO_C: ExtractoDto = {
  id: "e2",
  cierre: "2026-10-28",
  intereses: 189400,
  pago_minimo: null,
  fecha_limite: null,
  anotado_en: "2026-10-28T12:00:00.000Z",
};

const CREDITO = deuda({
  id: "c",
  tipo: "credito",
  nombre: "Libre inversión",
  con_quien: "Davivienda",
  tasa_ea: 18.9,
  cuota: 645600,
  cuotas_total: 36,
  primera_cuota: "2025-10-28",
  dia_pago: 28,
  saldo: saldo(12546900),
  extracto: EXTRACTO_C,
  extractos: [EXTRACTO_C],
});

const PERSONAL = deuda({
  id: "p",
  tipo: "personal",
  nombre: "Préstamo de Andrés",
  con_quien: "Andrés",
  saldo: saldo(600000),
});

const DEUDAS = [TARJETA, CREDITO, PERSONAL];

describe("formatos", () => {
  it("formatoCOP", () => {
    expect(formatoCOP(4918550)).toBe("$4.918.550");
    expect(formatoCOP(0)).toBe("$0");
    expect(formatoCOP(950)).toBe("$950");
  });
  it("compactoCOP", () => {
    expect(compactoCOP(950)).toBe("$950");
    expect(compactoCOP(312000)).toBe("$312 mil");
    expect(compactoCOP(4918550)).toBe("$4,9 M");
    expect(compactoCOP(12000000)).toBe("$12 M");
  });
  it("formatoTasa", () => {
    expect(formatoTasa(26.4)).toBe("26,4 % E.A.");
    expect(formatoTasa(20)).toBe("20 % E.A.");
  });
  it("plural y meses", () => {
    expect(plural(3, "cuenta", "cuentas")).toBe("3 cuentas");
    expect(plural(1, "pago", "pagos")).toBe("1 pago");
    expect(mesNombre(HOY)).toBe("noviembre");
    expect(mesAnterior(HOY)).toBe("octubre");
    expect(mesAnterior("2027-01-05")).toBe("diciembre");
  });
  it("la fecha de un pago", () => {
    expect(fechaDePago("2026-11-15", HOY)).toBe("Dom 15 nov · en 5 días");
    expect(fechaDePago("2026-11-10", HOY)).toBe("Mar 10 nov · hoy");
    expect(fechaDePago("2026-11-11", HOY)).toBe("Mié 11 nov · mañana");
  });
  it("lo que se teclea", () => {
    expect(parseCOP("3.395.000")).toBe(3395000);
    expect(parseCOP("3395000")).toBe(3395000);
    expect(parseCOP("0")).toBe(0);
    expect(parseCOP("")).toBeNull();
    expect(parseCOP("-5")).toBeNull();
    expect(parseCOP("12,5")).toBeNull();
    expect(parseCOP("1.23")).toBeNull();
    expect(parseTasa("26,4")).toBe(26.4);
    expect(parseTasa("18.9")).toBe(18.9);
    expect(parseTasa("26,456")).toBeNull();
    expect(parseTasa("201")).toBeNull();
  });
});

describe("las sumas", () => {
  it("disponible", () => {
    expect(disponible(CUENTAS)).toBe(4918550);
    expect(formatoCOP(disponible(CUENTAS))).toBe("$4.918.550");
    expect(disponible([cuenta("X", "Cuenta", null)])).toBe(0);
  });
  it("pagos del mes y lo que queda", () => {
    const pagos = pagosDelMes(DEUDAS, HOY);
    expect(pagos.map((p) => [p.valor, p.fecha, p.etiqueta])).toEqual([
      [312000, "2026-11-15", "Pago mínimo"],
      [645600, "2026-11-28", "Cuota 14 de 36"],
    ]);
    expect(fechaDePago(pagos[0].fecha, HOY)).toBe("Dom 15 nov · en 5 días");
    expect(quedanDespuesDePagar(CUENTAS, pagos)).toBe(3960950);
  });
  it("lo que debes", () => {
    expect(loQueDebes(DEUDAS)).toBe(16086900);
  });
  it("una deuda en 0 no cuenta ni sale", () => {
    const cero = { ...CREDITO, saldo: saldo(0) };
    expect(deudasVisibles([TARJETA, cero])).toEqual([TARJETA]);
    expect(loQueDebes([TARJETA, cero])).toBe(2940000);
    expect(pagosDelMes([cero], HOY)).toEqual([]);
  });
  it("los intereses de octubre: una fila por extracto, de mayor a menor", () => {
    const r = interesesDelMes(DEUDAS, HOY);
    expect(r.total).toBe(247300);
    expect(r.filas.map((f) => [nombreLargo(f.deuda), f.valor, f.extracto.id])).toEqual([
      ["Crédito libre inversión Davivienda", 189400, "e2"],
      ["Tarjeta Mastercard Bancolombia", 57900, "e1"],
    ]);
  });
  it("los intereses cuentan una deuda en 0 aunque ya no se muestre", () => {
    const cero = { ...CREDITO, saldo: saldo(0) };
    expect(deudasVisibles([cero])).toEqual([]);
    expect(interesesDelMes([cero], HOY)).toEqual({
      total: 189400,
      filas: [{ deuda: cero, extracto: EXTRACTO_C, valor: 189400 }],
    });
  });
  it("el extracto de noviembre no quita el de octubre; dos de octubre dan dos filas", () => {
    const nov: ExtractoDto = { ...EXTRACTO_T, id: "e3", cierre: "2026-11-05", intereses: 70000 };
    const oct2: ExtractoDto = { ...EXTRACTO_T, id: "e4", cierre: "2026-10-02", intereses: 100 };
    const t = conExtractos(TARJETA, nov, EXTRACTO_T, oct2);
    expect(t.extracto?.id).toBe("e3");
    const r = interesesDelMes([t, CREDITO], HOY);
    expect(r.filas.map((f) => f.extracto.id)).toEqual(["e2", "e1", "e4"]);
    expect(r.total).toBe(247300 + 100);
  });
  it("en enero, el mes anterior es diciembre", () => {
    const dic: ExtractoDto = { ...EXTRACTO_T, id: "e5", cierre: "2026-12-30" };
    expect(interesesDelMes([conExtractos(TARJETA, dic)], "2027-01-10").filas).toHaveLength(1);
  });
});

describe("los pagos, caso por caso", () => {
  it("un pago anterior a hoy o de otro mes no sale", () => {
    const antes = { ...TARJETA, extracto: { ...TARJETA.extracto!, fecha_limite: "2026-11-09" } };
    const otro = { ...TARJETA, extracto: { ...TARJETA.extracto!, fecha_limite: "2026-12-02" } };
    expect(pagosDelMes([antes], HOY)).toEqual([]);
    expect(pagosDelMes([otro], HOY)).toEqual([]);
    expect(pagosDelMes([CREDITO], "2026-11-29")).toEqual([]);
  });
  it("sin extracto o sin pago mínimo, una tarjeta no paga", () => {
    expect(pagosDelMes([{ ...TARJETA, extracto: null }], HOY)).toEqual([]);
    expect(
      pagosDelMes([{ ...TARJETA, extracto: { ...TARJETA.extracto!, pago_minimo: null } }], HOY),
    ).toEqual([]);
  });
  it("la cuota 37 de 36 no sale", () => {
    const fin = { ...CREDITO, primera_cuota: "2023-11-28" };
    expect(pagosDelMes([fin], HOY)).toEqual([]);
    const ultima = { ...CREDITO, primera_cuota: "2023-12-28" };
    expect(pagosDelMes([ultima], HOY)[0].etiqueta).toBe("Cuota 36 de 36");
  });
  it("antes de la primera cuota no sale", () => {
    expect(pagosDelMes([{ ...CREDITO, primera_cuota: "2026-12-28" }], HOY)).toEqual([]);
  });
  it("dia_pago 31 en noviembre cae el 30", () => {
    const c = deuda({ tipo: "credito", cuota: 100000, dia_pago: 31, saldo: saldo(5) });
    const p = pagosDelMes([c], HOY);
    expect(p[0].fecha).toBe("2026-11-30");
    expect(p[0].etiqueta).toBe("Cuota");
  });
  it("personal no tiene pagos", () => {
    expect(pagosDelMes([PERSONAL], HOY)).toEqual([]);
  });
});

describe("el progreso y las líneas", () => {
  it("el medidor", () => {
    expect(progresoDeuda(TARJETA, HOY)?.etiqueta).toBe("49 % del cupo de $6.000.000");
    expect(progresoDeuda(CREDITO, HOY)?.etiqueta).toBe("13 de 36 cuotas");
    expect(progresoDeuda(CREDITO, HOY)?.fraccion).toBeCloseTo(13 / 36);
    expect(progresoDeuda(PERSONAL, HOY)).toBeNull();
    expect(progresoDeuda({ ...TARJETA, cupo: null }, HOY)).toBeNull();
  });
  it("la línea de cada deuda", () => {
    expect(lineaDeuda(TARJETA)).toBe("Bancolombia ···7730 · 26,4 % E.A.");
    expect(lineaDeuda(CREDITO)).toBe("Davivienda · 18,9 % E.A. · cuota $645.600");
    expect(lineaDeuda(PERSONAL)).toBe("Personal · Sin fecha ni interés");
  });
  it("la línea de una deuda, caso por caso", () => {
    expect(lineaDeuda(deuda({ tipo: "personal", cuota: 150000 }))).toBe("Personal · cuota $150.000");
    expect(lineaDeuda(deuda({ tipo: "personal", tasa_ea: 12, cuota: 150000 }))).toBe(
      "Personal · 12 % E.A. · cuota $150.000",
    );
    expect(lineaDeuda(deuda({ tipo: "tarjeta", con_quien: "Nu", ultimos4: "1846" }))).toBe("Nu ···1846");
    expect(lineaDeuda(deuda({ tipo: "tarjeta", con_quien: "Nu" }))).toBe("Nu");
    expect(lineaDeuda(deuda({ tipo: "tarjeta", con_quien: "", ultimos4: "1846" }))).toBe("···1846");
    expect(lineaDeuda(deuda({ tipo: "tarjeta" }))).toBe("");
    expect(lineaDeuda(deuda({ tipo: "credito", con_quien: "Davivienda", cuota: 645600 }))).toBe(
      "Davivienda · cuota $645.600",
    );
  });
  it("el nombre largo, caso por caso", () => {
    const n = (tipo: string, nombre: string, con_quien: string) => nombreLargo(deuda({ tipo, nombre, con_quien }));
    expect(n("tarjeta", "Mastercard", "Bancolombia")).toBe("Tarjeta Mastercard Bancolombia");
    expect(n("tarjeta", "tarjeta oro", "Bancolombia")).toBe("tarjeta oro Bancolombia");
    expect(n("tarjeta", "Tarjetas viejas", "X")).toBe("Tarjeta Tarjetas viejas X");
    expect(n("tarjeta", "Nu", "Nu")).toBe("Tarjeta Nu");
    expect(n("credito", "Libre inversión", "Davivienda")).toBe("Crédito libre inversión Davivienda");
    expect(n("credito", "Vehículo", "Banco de Bogotá")).toBe("Crédito vehículo Banco de Bogotá");
    expect(n("credito", "BBVA hipotecario", "")).toBe("Crédito BBVA hipotecario");
    expect(n("credito", "Crédito de estudio", "ICETEX")).toBe("Crédito de estudio ICETEX");
    expect(n("credito", "Credito vehículo", "X")).toBe("Credito vehículo X");
    expect(n("credito", "Vehículo", "vehículo")).toBe("Crédito vehículo");
    expect(n("personal", "Préstamo de Andrés", "Andrés")).toBe("Préstamo de Andrés");
    expect(n("personal", "Préstamo", "Andrés")).toBe("Préstamo Andrés");
  });
  it("el nombre largo y la línea de una cuenta", () => {
    expect(nombreLargo(TARJETA)).toBe("Tarjeta Mastercard Bancolombia");
    expect(lineaCuenta(CUENTAS[0])).toBe("Ahorros ···4821");
    expect(lineaCuenta(CUENTAS[1])).toBe("Cuenta");
  });
});
