import { describe, expect, it } from "vitest";

import type { SetLog } from "@/lib/db/types";
import type { Aparicion } from "@/lib/progress";
import {
  barrasBalance,
  barrasHistorial,
  cabezaHistorial,
  conteoSesion,
  conteoVeredictos,
  cuentaEstados,
  decimalComa,
  descargasEnLinea,
  diaCorto,
  duracion,
  fechaComun,
  fechaFila,
  fechaLarga,
  partirUnidad,
  puntosLinea,
  semanasHistorial,
  subtituloFila,
  textoAporte,
} from "./leer";

const fecha = (iso: string) => `F(${iso})`;

describe("días y fechas", () => {
  it("diaCorto sale de la tabla", () => {
    expect(diaCorto("2026-11-09")).toBe("Lun");
    expect(diaCorto("2026-11-15")).toBe("Dom");
    expect(diaCorto("2026-11-14")).toBe("Sáb");
    expect(diaCorto("2026-11-11")).toBe("Mié");
  });
  it("fechaFila junta día y fecha corta", () => {
    expect(fechaFila("2026-11-09", fecha)).toBe("Lun, F(2026-11-09)");
  });
  it("fechaLarga: día con mayúscula, mes en minúscula", () => {
    expect(fechaLarga("2026-11-03")).toBe("Martes 3 de noviembre");
    expect(fechaLarga("2026-01-01")).toBe("Jueves 1 de enero");
  });
});

describe("subtituloFila", () => {
  const base = {
    fecha: "2026-11-09",
    abierta: false,
    ejerciciosConSeries: 7,
    totalSeries: 19,
    tags: [] as string[],
    tieneNota: false,
  };
  it("el caso común", () => {
    expect(subtituloFila(base, fecha)).toBe("Lun, F(2026-11-09) · 7 ej · 19 series");
  });
  it("con tags y nota", () => {
    expect(subtituloFila({ ...base, tags: ["poco tiempo", "dormí mal"], tieneNota: true }, fecha)).toBe(
      "Lun, F(2026-11-09) · 7 ej · 19 series · poco tiempo, dormí mal · con nota",
    );
  });
  it("la abierta no lleva tags; una serie va en singular", () => {
    expect(subtituloFila({ ...base, abierta: true, tags: ["x"], totalSeries: 1 }, fecha)).toBe(
      "Lun, F(2026-11-09) · 7 ej · 1 serie",
    );
  });
});

describe("cabezaHistorial", () => {
  it("cuenta sólo cerradas y toma la más antigua", () => {
    const r = [
      { fecha: "2026-11-10", abierta: true },
      { fecha: "2026-11-09", abierta: false },
      { fecha: "2026-09-15", abierta: false },
    ];
    expect(cabezaHistorial(r, fecha)).toBe("2 sesiones · desde el F(2026-09-15)");
  });
  it("singular", () => {
    expect(cabezaHistorial([{ fecha: "2026-11-09", abierta: false }], fecha)).toBe(
      "1 sesión · desde el F(2026-11-09)",
    );
  });
  it("sin cerradas (vacío o sólo la abierta) es null", () => {
    expect(cabezaHistorial([], fecha)).toBeNull();
    expect(cabezaHistorial([{ fecha: "2026-11-10", abierta: true }], fecha)).toBeNull();
  });
});

describe("semanasHistorial", () => {
  it("agrupa por lunes, descendente, con bandera de descarga", () => {
    const r = [
      { id: "a", fecha: "2026-11-10", deload: false },
      { id: "b", fecha: "2026-11-09", deload: true },
      { id: "c", fecha: "2026-11-08", deload: false },
    ];
    const g = semanasHistorial(r);
    expect(g.map((x) => x.lunes)).toEqual(["2026-11-09", "2026-11-02"]);
    expect(g[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(g[0].deload).toBe(true);
    expect(g[1].deload).toBe(false);
  });
  it("vacío", () => {
    expect(semanasHistorial([])).toEqual([]);
  });
});

describe("barrasHistorial", () => {
  const s = (f: string, n: number, extra = {}) => ({
    fecha: f,
    abierta: false,
    deload: false,
    totalSeries: n,
    ...extra,
  });
  it("cronológicas, alto en % y clases op/dl", () => {
    const r = [s("2026-11-10", 10, { abierta: true }), s("2026-11-09", 20), s("2026-11-08", 5, { deload: true })];
    const b = barrasHistorial(r);
    expect(b.barras.map((x) => x.alto)).toEqual([25, 100, 50]);
    expect(b.barras.map((x) => x.clase)).toEqual(["dl", "", "op"]);
    expect(b.primera).toBe("2026-11-08");
    expect(b.ultima).toBe("2026-11-10");
    expect(b.etiqueta).toBe(
      "Series por sesión, últimas 3: de 5 a 20. La abierta lleva el cromo. 1 de descarga.",
    );
  });
  it("sólo las 14 más recientes", () => {
    const r = Array.from({ length: 20 }, (_, i) => s(`2026-10-${String(30 - i).padStart(2, "0")}`, i + 1));
    const b = barrasHistorial(r);
    expect(b.n).toBe(14);
    expect(b.barras).toHaveLength(14);
  });
  it("vacío, y todo en cero no divide por cero", () => {
    expect(barrasHistorial([]).n).toBe(0);
    expect(barrasHistorial([s("2026-11-09", 0)]).barras[0].alto).toBe(0);
  });
});

describe("duracion", () => {
  it("minutos bajo una hora", () => {
    expect(duracion(58 * 60_000)).toBe("58 min");
    expect(duracion(58.4 * 60_000)).toBe("58 min");
  });
  it("cruza la hora con formatGap", () => {
    expect(duracion(3_599_000)).toBe("59 min");
    expect(duracion(3_600_000)).toBe("1 h 00");
    expect(duracion(64 * 60_000)).toBe("1 h 04");
  });
  it("null → null; menos de un minuto es 1 min", () => {
    expect(duracion(null)).toBeNull();
    expect(duracion(10_000)).toBe("1 min");
  });
});

describe("veredictos", () => {
  const v = (category: "mejor" | "igual" | "peor" | "sin_comparacion", referenceFecha: string | null) => ({
    verdict: { category },
    referenceFecha,
  });
  it("conteoVeredictos da los cuatro, siempre", () => {
    expect(conteoVeredictos({ a: v("mejor", "x"), b: v("mejor", "x"), c: v("peor", "x") })).toEqual({
      mejor: 2,
      igual: 0,
      peor: 1,
      sin_comparacion: 0,
    });
    expect(conteoVeredictos({})).toEqual({ mejor: 0, igual: 0, peor: 0, sin_comparacion: 0 });
  });
  it("fechaComun: la misma, ignorando los sin fecha", () => {
    expect(fechaComun({ a: v("mejor", "2026-11-03"), b: v("sin_comparacion", null) })).toBe("2026-11-03");
  });
  it("fechaComun: null si difieren o no hay ninguna", () => {
    expect(fechaComun({ a: v("mejor", "2026-11-03"), b: v("igual", "2026-10-30") })).toBeNull();
    expect(fechaComun({ a: v("sin_comparacion", null) })).toBeNull();
    expect(fechaComun({})).toBeNull();
  });
});

describe("conteoSesion", () => {
  it("hechos, total y series reales", () => {
    expect(conteoSesion([{ sets: [1, 2, 3] }, { sets: [] }, { sets: [1] }])).toEqual({
      hechos: 2,
      total: 3,
      series: 4,
    });
  });
  it("vacío", () => {
    expect(conteoSesion([])).toEqual({ hechos: 0, total: 0, series: 0 });
  });
});

describe("estados y volumen", () => {
  it("cuentaEstados", () => {
    const c = cuentaEstados([{ estado: "subiendo" }, { estado: "sin_registros" }, { estado: "estancado" }]);
    expect(c).toEqual({ conSeries: 2, sinSeries: 1, texto: "2 con series · 1 sin series" });
  });
  it("sin « · N sin series» si N es 0", () => {
    expect(cuentaEstados([{ estado: "subiendo" }]).texto).toBe("1 con series");
    expect(cuentaEstados([]).texto).toBe("0 con series");
  });
  it("decimalComa", () => {
    expect(decimalComa(17.5)).toBe("17,5");
    expect(decimalComa(12)).toBe("12");
    expect(decimalComa(0)).toBe("0");
  });
  it("textoAporte: directo e indirecto", () => {
    expect(textoAporte({ nombre: "Dips", rol: "directo", series: 8 })).toBe("Dips · 8");
    expect(textoAporte({ nombre: "Pull Up", rol: "indirecto", series: 11 })).toBe("Pull Up · ½ de 11 · 5,5");
    expect(textoAporte({ nombre: "Row", rol: "indirecto", series: 4 })).toBe("Row · ½ de 4 · 2");
  });
});

describe("barrasBalance", () => {
  const sem = (lunes: string, net: number, sesiones: number, deload = false) => ({ lunes, net, sesiones, deload });
  it("alto en px, signo, descarga y posición del número", () => {
    const b = barrasBalance([sem("2026-11-02", 4, 2), sem("2026-11-09", -2, 1, true)], fecha);
    expect(b.columnas[0]).toMatchObject({ alto: 44, negativo: false, texto: "+4" });
    expect(b.columnas[0].numero).toEqual({ bottom: "calc(50% + 47px)" });
    expect(b.columnas[1]).toMatchObject({ alto: 22, negativo: true, deload: true, texto: "−2" });
    expect(b.columnas[1].numero).toEqual({ top: "calc(50% + 25px)" });
    expect(b.primera).toBe("2026-11-02");
    expect(b.ultima).toBe("2026-11-09");
  });
  it("una semana hueca es un hueco, no un cero, y no pesa en el máximo", () => {
    const b = barrasBalance([sem("2026-11-02", 0, 0), sem("2026-11-09", 1, 1)], fecha);
    expect(b.columnas[0]).toMatchObject({ hueco: true, alto: 0, texto: "·", numero: { top: "calc(50% - 7px)" } });
    expect(b.columnas[1].alto).toBe(44);
  });
  it("el aria-label dice huecos y descargas", () => {
    const b = barrasBalance([sem("2026-11-02", 0, 0), sem("2026-11-09", -2, 1, true)], fecha);
    expect(b.etiqueta).toBe(
      "Balance por semana, de F(2026-11-02) a F(2026-11-09): F(2026-11-02) sin sesiones, F(2026-11-09) −2. La semana del F(2026-11-09) fue de descarga.",
    );
  });
  it("neto 0 con sesiones no tiene alto y sin semanas no hay nada", () => {
    expect(barrasBalance([sem("2026-11-02", 0, 1)], fecha).columnas[0]).toMatchObject({ alto: 0, texto: "0" });
    expect(barrasBalance([], fecha).columnas).toEqual([]);
  });
});

describe("partirUnidad", () => {
  it("separa lb y kg del final", () => {
    expect(partirUnidad("8 × 135 lb")).toEqual({ cifra: "8 × 135", unidad: "lb" });
    expect(partirUnidad("10 × 62,5 kg")).toEqual({ cifra: "10 × 62,5", unidad: "kg" });
  });
  it("sin unidad al final, todo va en la cifra", () => {
    expect(partirUnidad("12 reps")).toEqual({ cifra: "12 reps", unidad: null });
    expect(partirUnidad("8 × +10 kg extra")).toEqual({ cifra: "8 × +10 kg extra", unidad: null });
    expect(partirUnidad("lb")).toEqual({ cifra: "lb", unidad: null });
  });
});

function set(over: Partial<SetLog>): SetLog {
  return {
    id: "s",
    session_exercise_id: "se",
    set_index: 1,
    segment_index: 0,
    side: null,
    reps: 8,
    weight_value: 100,
    weight_unit: "LB",
    weight_basis: null,
    added_unit: null,
    es_extra: false,
    ...over,
  } as unknown as SetLog;
}
const ap = (f: string, peso: number, deload = false, unit: "LB" | "KG" = "LB"): Aparicion => ({
  fecha: f,
  sets: [set({ weight_value: peso, weight_unit: unit }), set({ id: "t", set_index: 2, weight_value: peso, weight_unit: unit })],
  deload,
  pesoCorporal: null,
});

describe("descargasEnLinea", () => {
  it("incluye la descarga con la misma clave que la línea", () => {
    const d = descargasEnLinea([ap("2026-10-01", 100), ap("2026-10-08", 80, true), ap("2026-10-15", 105)]);
    expect(d).toHaveLength(1);
    expect(d[0].fecha).toBe("2026-10-08");
    expect(d[0].marca).toBeGreaterThan(0);
  });
  it("deja fuera la descarga en otra clave (otra unidad)", () => {
    const d = descargasEnLinea([ap("2026-10-01", 100), ap("2026-10-08", 40, true, "KG"), ap("2026-10-15", 105)]);
    expect(d).toEqual([]);
  });
  it("sin ninguna aparición normal, no hay", () => {
    expect(descargasEnLinea([ap("2026-10-08", 80, true)])).toEqual([]);
    expect(descargasEnLinea([])).toEqual([]);
  });
});

describe("puntosLinea", () => {
  const p = (f: string, marca: number) => ({ fecha: f, marca });
  it("x repartida de 14 a 336 e y de 14 a 126", () => {
    const l = puntosLinea([p("2026-10-01", 10), p("2026-10-08", 20), p("2026-10-15", 15)], []);
    expect(l.elementos.map((e) => e.x)).toEqual([14, 175, 336]);
    expect(l.elementos.map((e) => e.y)).toEqual([126, 14, 70]);
    expect(l.polilinea).toBe("14,126 175,14 336,70");
    expect(l.primera).toBe("2026-10-01");
    expect(l.ultima).toBe("2026-10-15");
  });
  it("las descargas se ordenan con los puntos y no entran en la polilínea; empate: primero el punto", () => {
    const l = puntosLinea(
      [p("2026-10-01", 10), p("2026-10-15", 20)],
      [{ fecha: "2026-10-08", marca: 5 }, { fecha: "2026-10-15", marca: 12 }],
    );
    expect(l.elementos.map((e) => `${e.tipo}:${e.fecha}`)).toEqual([
      "punto:2026-10-01",
      "descarga:2026-10-08",
      "punto:2026-10-15",
      "descarga:2026-10-15",
    ]);
    // la marca más baja es la de la descarga: define el piso de la escala
    expect(l.elementos[1].y).toBe(126);
    expect(l.polilinea.split(" ")).toHaveLength(2);
  });
  it("el rótulo de la descarga baja 18, o sube 10 si no cabe", () => {
    const l = puntosLinea([p("2026-10-01", 20), p("2026-10-15", 20)], [{ fecha: "2026-10-08", marca: 5 }]);
    const d = l.elementos[1];
    expect(d.y).toBe(126);
    expect(d.yTexto).toBe(116);
    const u = puntosLinea([p("2026-10-01", 20), p("2026-10-15", 10)], [{ fecha: "2026-10-08", marca: 20 }]);
    expect(u.elementos[1].yTexto).toBe(u.elementos[1].y + 18);
  });
  it("marcas iguales caen en y = 70; sin elementos no hay nada", () => {
    const l = puntosLinea([p("2026-10-01", 10), p("2026-10-08", 10)], []);
    expect(l.elementos.map((e) => e.y)).toEqual([70, 70]);
    expect(puntosLinea([], []).elementos).toEqual([]);
  });
});
