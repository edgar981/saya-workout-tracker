import { describe, expect, it, vi } from "vitest";

import { leerRespuesta, prepararPedido } from "@/components/agente/estado";
import { MAX_FILAS } from "@/lib/agente/contrato";
import type { DatosCuerpo } from "@/lib/agente/filas";

// `elegirFilas` real salvo cuando una prueba fuerza una fila que el contrato rechaza.
const forzada = vi.hoisted(() => ({ filas: null as unknown[] | null }));
vi.mock("@/lib/agente/filas", async (original) => {
  const real = await original<typeof import("@/lib/agente/filas")>();
  return {
    ...real,
    elegirFilas: (...args: Parameters<typeof real.elegirFilas>) =>
      forzada.filas ?? real.elegirFilas(...args),
  };
});

const HOY = "2026-03-18";
const vacio: DatosCuerpo = {
  sesiones: [],
  apariciones: [],
  sets: [],
  ejercicios: [],
  dias: [],
  pesos: [],
};
const pesos = (n: number): DatosCuerpo["pesos"] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, fecha: "2026-03-05", valor: 80, unidad: "KG" as const }));

describe("prepararPedido", () => {
  it("sin tema → sin_datos", () => {
    expect(prepararPedido("¿Cuánto gasté?", HOY, vacio)).toEqual({ tipo: "sin_datos" });
  });
  it("con tema pero sin filas → sin_datos", () => {
    expect(prepararPedido("¿Cuánto pesé este mes?", HOY, vacio)).toEqual({ tipo: "sin_datos" });
  });
  it("demasiadas filas → error", () => {
    const r = prepararPedido("¿Cuánto pesé este mes?", HOY, { ...vacio, pesos: pesos(MAX_FILAS + 1) });
    expect(r).toEqual({ tipo: "error" });
  });
  it("con filas → pedido", () => {
    const r = prepararPedido("  ¿Cuánto pesé este mes?  ", HOY, { ...vacio, pesos: pesos(2) });
    expect(r.tipo).toBe("pedido");
    if (r.tipo !== "pedido") return;
    const p = JSON.parse(r.texto);
    expect(p.pregunta).toBe("¿Cuánto pesé este mes?");
    expect(p.hoy).toBe(HOY);
    expect(p.filas).toHaveLength(2);
  });
  it("una fila que el contrato rechaza (series negativo) → error, no se manda", () => {
    forzada.filas = [
      { tipo: "sesion", fecha: "2026-03-10", sesion: "Day 1", abierta: false, ejercicios: 1, series: -1 },
    ];
    try {
      expect(prepararPedido("¿Cuántas sesiones hice este mes?", HOY, vacio)).toEqual({ tipo: "error" });
    } finally {
      forzada.filas = null;
    }
  });
  it("demasiados bytes → error", () => {
    // 400 filas de peso caben; con una pregunta enorme no, pero el tope de bytes
    // se prueba con filas que lo exceden: nombres largos en sesiones.
    const sesiones = Array.from({ length: 300 }, (_, i) => ({
      id: `s${i}`,
      fecha: "2026-03-10",
      routine_day_id: "d",
      iniciada_en: "2026-03-10T10:00:00Z",
      cerrada_en: "2026-03-10T11:00:00Z",
      activa: 0 as const,
      nota: null,
      tag_ids: [],
    }));
    const dias = [{ id: "d", nombre: "x".repeat(400), orden: 1, mesociclo_id: "m" }];
    const r = prepararPedido("¿Cuántas sesiones hice este mes?", HOY, { ...vacio, sesiones, dias });
    expect(r).toEqual({ tipo: "error" });
  });
});

const buena = {
  estado: "respuesta",
  cifra: "6",
  unidad: "series",
  desglose: [
    { etiqueta: "Incline Bench Press Wide Grip", valor: "3" },
    { etiqueta: "Weighted Dips", valor: "3" },
  ],
  fuente: "Day 4 de hoy, abierta",
};

describe("leerRespuesta", () => {
  it("200 con respuesta → respuesta", () => {
    const v = leerRespuesta("p", 200, buena);
    expect(v.tipo).toBe("respuesta");
  });
  it("200 con sin_datos → sin_datos", () => {
    expect(leerRespuesta("p", 200, { estado: "sin_datos" })).toEqual({ tipo: "sin_datos", pregunta: "p" });
  });
  it("«Sale de…» o basura → error", () => {
    expect(leerRespuesta("p", 200, { ...buena, fuente: "Sale de tus sesiones" }).tipo).toBe("error");
    expect(leerRespuesta("p", 200, "basura").tipo).toBe("error");
    expect(leerRespuesta("p", 200, null).tipo).toBe("error");
  });
  it.each([401, 413, 502, 503])("%i → error", (s) => {
    expect(leerRespuesta("p", s, buena)).toEqual({ tipo: "error", pregunta: "p" });
  });
});
