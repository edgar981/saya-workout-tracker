import { describe, expect, it } from "vitest";

import {
  balanceDeSemana,
  contarEstados,
  dekPeso,
  etiquetaGrafica,
  formatoDiferencia,
  formatoNeto,
  formatoPeso,
  netoDeFila,
  teselasDeEstados,
  polilinea,
  puntosGrafica,
  resumirPeso,
  sesionesDeSemana,
  subtituloSesiones,
  textoSeries,
} from "./cuerpo";

const fecha = (iso: string) => `F(${iso})`;
const kg = (f: string, v: number) => ({ fecha: f, valor: v, unidad: "KG" as const });
const lb = (f: string, v: number) => ({ fecha: f, valor: v, unidad: "LB" as const });

describe("formatos", () => {
  it("peso con una decimal y coma", () => {
    expect(formatoPeso(78.4)).toBe("78,4");
    expect(formatoPeso(80)).toBe("80,0");
  });
  it("diferencia con signo real", () => {
    expect(formatoDiferencia(-1.2)).toBe("−1,2");
    expect(formatoDiferencia(0.5)).toBe("+0,5");
    expect(formatoDiferencia(0)).toBe("0,0");
    expect(formatoDiferencia(0.04)).toBe("0,0");
  });
  it("neto como Historial", () => {
    expect(formatoNeto(3)).toBe("+3");
    expect(formatoNeto(-2)).toBe("−2");
    expect(formatoNeto(0)).toBe("0");
  });
  it("series en singular", () => {
    expect(textoSeries(1)).toBe("1 serie");
    expect(textoSeries(12)).toBe("12 series");
  });
});

describe("resumirPeso", () => {
  it("sin registros es null", () => {
    expect(resumirPeso([])).toBeNull();
  });
  it("un solo registro: dek «1 registro», sin gráfica", () => {
    const r = resumirPeso([kg("2026-11-09", 78.4)])!;
    expect(r.n).toBe(1);
    expect(dekPeso(r, fecha)).toBe("1 registro");
    expect(puntosGrafica(r.serie.map((s) => s.valor))).toBeNull();
  });
  it("ordena por fecha y calcula la diferencia contra el primero", () => {
    const r = resumirPeso([kg("2026-11-09", 78.4), kg("2026-09-15", 79.6)])!;
    expect(r.ultimo).toBe(78.4);
    expect(r.unidad).toBe("kg");
    expect(r.primeraFecha).toBe("2026-09-15");
    expect(dekPeso(r, fecha)).toBe("−1,2 kg desde el F(2026-09-15) · 2 registros");
  });
  it("la serie es sólo la unidad del último", () => {
    const r = resumirPeso([lb("2026-09-01", 180), kg("2026-09-15", 79.6), kg("2026-11-09", 78.4)])!;
    expect(r.n).toBe(2);
    expect(r.serie.map((s) => s.valor)).toEqual([79.6, 78.4]);
  });
  it("empate de fecha: el último de la tabla es el último", () => {
    const r = resumirPeso([kg("2026-11-09", 78), kg("2026-11-09", 79)])!;
    expect(r.ultimo).toBe(79);
    expect(r.serie.map((s) => s.valor)).toEqual([78, 79]);
  });
  it("etiqueta de la gráfica", () => {
    const r = resumirPeso([kg("2026-09-15", 79.6), kg("2026-11-09", 78.4)])!;
    expect(etiquetaGrafica(r, fecha)).toBe(
      "Peso corporal, 2 registros: de 79,6 kg el F(2026-09-15) a 78,4 kg el F(2026-11-09).",
    );
  });
});

describe("puntosGrafica", () => {
  it("x reparte 342 desde 4 y y mapea alto→6, bajo→56", () => {
    const p = puntosGrafica([80, 79, 78])!;
    expect(p.map((q) => q.x)).toEqual([4, 175, 346]);
    expect(p.map((q) => q.y)).toEqual([6, 31, 56]);
  });
  it("serie plana: línea a y = 31", () => {
    expect(puntosGrafica([78, 78, 78])!.every((q) => q.y === 31)).toBe(true);
  });
  it("polilínea", () => {
    expect(polilinea(puntosGrafica([80, 78])!)).toBe("4,6 346,56");
  });
});

describe("la semana", () => {
  // 2026-11-11 es miércoles → lunes 2026-11-09.
  it("sesiones desde el lunes, en el orden recibido", () => {
    const s = [{ fecha: "2026-11-11" }, { fecha: "2026-11-09" }, { fecha: "2026-11-08" }];
    expect(sesionesDeSemana(s, "2026-11-11")).toEqual([{ fecha: "2026-11-11" }, { fecha: "2026-11-09" }]);
  });
  it("subtítulo con cerrada/abierta", () => {
    expect(
      subtituloSesiones([
        { fecha: "x", nombre: "Pierna", abierta: true },
        { fecha: "x", nombre: "Sesión libre", abierta: false },
      ]),
    ).toBe("Pierna abierta · Sesión libre cerrada");
  });
  it("balance: neto de la semana actual; hueco si no hay cerradas", () => {
    const semanas = [
      { lunes: "2026-11-02", net: 4, sesiones: 3 },
      { lunes: "2026-11-09", net: -2, sesiones: 2 },
    ];
    expect(balanceDeSemana(semanas, "2026-11-11")).toBe(-2);
    expect(balanceDeSemana([{ lunes: "2026-11-09", net: 0, sesiones: 0 }], "2026-11-11")).toBeNull();
    expect(balanceDeSemana([], "2026-11-11")).toBeNull();
  });
  it("un neto cero con sesiones es 0, no un hueco", () => {
    expect(balanceDeSemana([{ lunes: "2026-11-09", net: 0, sesiones: 1 }], "2026-11-11")).toBe(0);
  });
});

describe("contarEstados", () => {
  it("cuenta por estado y deja fuera sin_registros", () => {
    const c = contarEstados([
      "subiendo",
      "subiendo",
      "estancado",
      "por_debajo",
      "pocos_datos",
      "sin_registrar",
      "sin_registros",
    ]);
    expect(c).toEqual({
      subiendo: 2,
      estancado: 1,
      por_debajo: 1,
      pocos_datos: 1,
      sin_registrar: 1,
      conSeries: 6,
    });
  });
});

describe("netoDeFila", () => {
  const net = (n: number, comparados = 3, sinComparacion = 0) => ({ net: n, comparados, sinComparacion });
  it("sesión abierta con neto: null", () => {
    expect(netoDeFila(true, net(2))).toBeNull();
  });
  it("sesión cerrada sin neto: null", () => {
    expect(netoDeFila(false, undefined)).toBeNull();
  });
  it("comparados 0: null", () => {
    expect(netoDeFila(false, net(0, 0))).toBeNull();
  });
  it("positivo", () => {
    expect(netoDeFila(false, net(3))).toEqual({ texto: "+3", positivo: true, sinComparacion: 0 });
  });
  it("negativo con U+2212", () => {
    expect(netoDeFila(false, net(-2))).toEqual({ texto: "−2", positivo: false, sinComparacion: 0 });
  });
  it("cero", () => {
    expect(netoDeFila(false, net(0))).toEqual({ texto: "0", positivo: false, sinComparacion: 0 });
  });
  it("lleva la cuenta de sin comparación", () => {
    expect(netoDeFila(false, net(1, 4, 2))?.sinComparacion).toBe(2);
  });
});

describe("teselasDeEstados", () => {
  const conteo = (sin_registrar: number) => ({
    subiendo: 1,
    estancado: 2,
    por_debajo: 3,
    pocos_datos: 4,
    sin_registrar,
    conSeries: 10 + sin_registrar,
  });
  it("con sin_registrar 0: cuatro teselas", () => {
    expect(teselasDeEstados(conteo(0)).map((t) => t.estado)).toEqual([
      "subiendo",
      "estancado",
      "por_debajo",
      "pocos_datos",
    ]);
  });
  it("con sin_registrar 2: cinco, la última Sin registrar", () => {
    const t = teselasDeEstados(conteo(2));
    expect(t).toHaveLength(5);
    expect(t[4]).toEqual({ estado: "sin_registrar", cuenta: 2 });
    expect(t.map((x) => x.cuenta)).toEqual([1, 2, 3, 4, 2]);
  });
});
