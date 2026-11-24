import { describe, expect, it } from "vitest";
import {
  ESQUEMA_RESPUESTA,
  MAX_DESGLOSE,
  MAX_FILAS,
  MAX_PREGUNTA,
  validarPedido,
  validarRespuesta,
  type FilaCuerpo,
} from "./contrato";

const serie: FilaCuerpo = {
  tipo: "serie",
  fecha: "2026-03-10",
  sesion: "Day 4",
  abierta: true,
  ejercicio: "Incline Bench Press Wide Grip",
  directos: ["Pecho"],
  indirectos: ["Tríceps"],
  unidad: "KG",
  base: "TOTAL",
  anadido: null,
  series: 3,
  apuntes: [{ serie: 1, reps: 8, peso: 40, lado: null }],
};
const peso: FilaCuerpo = { tipo: "peso", fecha: "2026-03-09", valor: 78.4, unidad: "KG" };
const sesion: FilaCuerpo = {
  tipo: "sesion", fecha: "2026-03-10", sesion: "Day 4", abierta: true, ejercicios: 2, series: 6,
};
const pedido = (o: Record<string, unknown> = {}) => ({
  pregunta: "  ¿Cuántas series de pecho hoy?  ",
  hoy: "2026-03-10",
  filas: [serie, peso, sesion],
  ...o,
});

describe("validarPedido", () => {
  it("válido con una fila de cada tipo, pregunta recortada", () => {
    const r = validarPedido(pedido());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pedido.pregunta).toBe("¿Cuántas series de pecho hoy?");
  });
  it("pregunta vacía, larga o que no es texto → 400", () => {
    for (const pregunta of ["   ", "a".repeat(MAX_PREGUNTA + 1), 5]) {
      const r = validarPedido(pedido({ pregunta }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
    expect(validarPedido(pedido({ pregunta: "a".repeat(MAX_PREGUNTA) })).ok).toBe(true);
  });
  it("hoy mal formado → 400", () => {
    for (const hoy of ["10/03/2026", "2026-13-40", 3]) {
      const r = validarPedido(pedido({ hoy }));
      expect(!r.ok && r.status).toBe(400);
    }
  });
  it("tipo desconocido, fila sin series, número negativo → 400", () => {
    const sinSeries: Record<string, unknown> = { ...serie };
    delete sinSeries.series;
    for (const fila of [{ ...peso, tipo: "otro" }, sinSeries, { ...peso, valor: -1 }, { ...peso, valor: NaN }]) {
      const r = validarPedido(pedido({ filas: [fila] }));
      expect(!r.ok && r.status).toBe(400);
    }
  });
  it("MAX_FILAS + 1 → 413 aunque sean válidas, antes de mirar la forma", () => {
    const r = validarPedido(pedido({ filas: Array.from({ length: MAX_FILAS + 1 }, () => peso) }));
    expect(!r.ok && r.status).toBe(413);
    const mal = validarPedido(pedido({ filas: Array.from({ length: MAX_FILAS + 1 }, () => 1) }));
    expect(!mal.ok && mal.status).toBe(413);
    expect(validarPedido(pedido({ filas: Array.from({ length: MAX_FILAS }, () => peso) })).ok).toBe(true);
  });
  it("clave de más o no objeto → 400", () => {
    expect(!validarPedido({ ...pedido(), extra: 1 }).ok).toBe(true);
    expect(validarPedido(null).ok).toBe(false);
    expect(validarPedido([]).ok).toBe(false);
  });
  it("los errores no repiten la pregunta", () => {
    const r = validarPedido(pedido({ hoy: "x" }));
    expect(!r.ok && r.error).not.toContain("series de pecho");
  });
});

describe("validarRespuesta", () => {
  const maqueta = {
    estado: "respuesta",
    cifra: "6",
    unidad: "series",
    desglose: [
      { etiqueta: "Incline Bench Press Wide Grip", valor: "3" },
      { etiqueta: "Weighted Dips", valor: "3" },
    ],
    fuente: "Day 4 de hoy, abierta",
  };
  it("sin_datos ignora los demás campos", () => {
    expect(validarRespuesta({ ...maqueta, estado: "sin_datos" })).toEqual({
      ok: true,
      respuesta: { estado: "sin_datos" },
    });
  });
  it("la respuesta de la maqueta pasa", () => {
    const r = validarRespuesta(maqueta);
    expect(r).toEqual({ ok: true, respuesta: maqueta });
  });
  it("fuente «Sale de…» no pasa, con cualquier caja", () => {
    expect(validarRespuesta({ ...maqueta, fuente: "Sale de tu sesión de hoy" }).ok).toBe(false);
    expect(validarRespuesta({ ...maqueta, fuente: "sale de tu sesión" }).ok).toBe(false);
    expect(validarRespuesta({ ...maqueta, fuente: "Salé de tu sesión" }).ok).toBe(false);
  });
  it("cifra vacía, fuente vacía o campos de más largos no pasan", () => {
    expect(validarRespuesta({ ...maqueta, cifra: " " }).ok).toBe(false);
    expect(validarRespuesta({ ...maqueta, fuente: "" }).ok).toBe(false);
    expect(validarRespuesta({ ...maqueta, cifra: "1".repeat(25) }).ok).toBe(false);
    expect(validarRespuesta({ ...maqueta, unidad: "" }).ok).toBe(true);
  });
  it("desglose de MAX_DESGLOSE + 1 no pasa; de MAX_DESGLOSE sí", () => {
    const fila = { etiqueta: "A", valor: "1" };
    expect(validarRespuesta({ ...maqueta, desglose: Array(MAX_DESGLOSE + 1).fill(fila) }).ok).toBe(false);
    expect(validarRespuesta({ ...maqueta, desglose: Array(MAX_DESGLOSE).fill(fila) }).ok).toBe(true);
    expect(validarRespuesta({ ...maqueta, desglose: [{ etiqueta: "", valor: "1" }] }).ok).toBe(false);
  });
  it("otras formas se rechazan", () => {
    expect(validarRespuesta(null).ok).toBe(false);
    expect(validarRespuesta({ estado: "otro" }).ok).toBe(false);
    expect(validarRespuesta({ ...maqueta, desglose: "x" }).ok).toBe(false);
  });
});

describe("ESQUEMA_RESPUESTA", () => {
  const PROHIBIDAS = ["anyOf", "minLength", "maxLength", "minItems", "maxItems"];
  function recorrer(nodo: unknown): void {
    if (Array.isArray(nodo)) return nodo.forEach(recorrer);
    if (typeof nodo !== "object" || nodo === null) return;
    const o = nodo as Record<string, unknown>;
    for (const k of PROHIBIDAS) expect(k in o).toBe(false);
    if (o.type === "object") {
      expect(o.additionalProperties).toBe(false);
      expect([...(o.required as string[])].sort()).toEqual(
        Object.keys(o.properties as object).sort(),
      );
    }
    Object.values(o).forEach(recorrer);
  }
  it("objetos cerrados, todo requerido, sin restricciones", () => {
    recorrer(ESQUEMA_RESPUESTA);
  });
});
