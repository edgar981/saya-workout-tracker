import { describe, it, expect } from "vitest";
import type { Exercise } from "@/lib/db/types";
import { GRUPOS } from "@/lib/musculos";
import {
  calcularVolumen,
  SEMANAS_TIPICAS,
  seriesDeAparicion,
  type SesionVolumen,
} from "@/lib/volumen";

describe("§12.1 seriesDeAparicion", () => {
  it("§12.1: un giant set (segmentos del mismo set_index) es una serie", () => {
    expect(
      seriesDeAparicion([
        { set_index: 1, reps: 10 },
        { set_index: 1, reps: 8 },
        { set_index: 1, reps: 6 },
      ]),
    ).toBe(1);
  });
  it("§12.1: L y R con el mismo índice son una serie", () => {
    expect(
      seriesDeAparicion([
        { set_index: 1, reps: 8 },
        { set_index: 1, reps: 8 },
        { set_index: 2, reps: 8 },
        { set_index: 2, reps: 7 },
      ]),
    ).toBe(2);
  });
  it("§12.1: reps en cero no cuentan", () => {
    expect(
      seriesDeAparicion([
        { set_index: 1, reps: 8 },
        { set_index: 2, reps: 0 },
      ]),
    ).toBe(1);
    expect(seriesDeAparicion([{ set_index: 1, reps: 0 }])).toBe(0);
  });
});

describe("§12.3 calcularVolumen", () => {
  type Ej = Pick<Exercise, "nombre" | "grupos">;
  const HOY = "2026-11-08"; // domingo; la semana actual empieza el 2 nov
  const A: Ej = { nombre: "Press", grupos: { pecho: "directo", triceps: "indirecto" } };
  const B: Ej = { nombre: "Sin clasificar", grupos: {} };
  const ejercicios = new Map<string, Ej>([
    ["a", A],
    ["b", B],
  ]);
  const ses = (fecha: string, series: number, id = "a", deload = false): SesionVolumen => ({
    fecha,
    deload,
    series: [{ exerciseId: id, series }],
  });
  const grupo = (v: ReturnType<typeof calcularVolumen>, id: string) =>
    v.grupos.find((g) => g.grupo === id)!;

  it("§12.3: la semana típica salta la semana actual, las de descarga y las vacías", () => {
    const v = calcularVolumen(
      [
        ses("2026-09-28", 4),
        ses("2026-10-05", 10, "a", true), // descarga
        ses("2026-10-13", 3),
        ses("2026-10-21", 5),
        // semana del 26 oct: vacía
        ses("2026-11-03", 20), // la actual
      ],
      ejercicios,
      HOY,
    );
    expect(v.tipicas).toEqual(["2026-09-28", "2026-10-12", "2026-10-19"]);
    expect(grupo(v, "pecho").tipica).toBeCloseTo((4 + 3 + 5) / 3);
    // Tira: la vacía es hueco (null), no cero; la actual sí aparece en la tira.
    expect(grupo(v, "pecho").porSemana).toEqual([4, 10, 3, 5, null, 20]);
  });

  it("§12.2: el indirecto cuenta la mitad (tipica ponderada; directas/indirectas sin ponderar)", () => {
    const v = calcularVolumen([ses("2026-10-13", 4)], ejercicios, HOY);
    const tri = grupo(v, "triceps");
    expect(tri.directas).toBe(0);
    expect(tri.indirectas).toBe(4);
    expect(tri.tipica).toBe(2);
    expect(tri.porSemana[0]).toBe(2); // la tira empieza en la primera sesión (12 oct)
    expect(tri.aportes).toEqual([{ exerciseId: "a", nombre: "Press", rol: "indirecto", series: 4 }]);
  });

  it("§12.4: los grupos salen de mayor a menor; a igual volumen, el orden de GRUPOS", () => {
    const v = calcularVolumen([ses("2026-10-13", 4)], ejercicios, HOY);
    expect(v.grupos).toHaveLength(GRUPOS.length);
    expect(v.grupos[0].grupo).toBe("pecho");
    expect(v.grupos[1].grupo).toBe("triceps");
    for (let i = 1; i < v.grupos.length; i++) {
      expect(v.grupos[i - 1].tipica).toBeGreaterThanOrEqual(v.grupos[i].tipica);
    }
    const ceros = v.grupos.slice(2).map((g) => g.grupo);
    expect(ceros).toEqual(GRUPOS.map((g) => g.id).filter((id) => id !== "pecho" && id !== "triceps"));
  });

  it("§12.3: sin ninguna semana completa todo es cero", () => {
    const v = calcularVolumen([ses("2026-11-03", 6)], ejercicios, HOY);
    expect(v.tipicas).toEqual([]);
    expect(v.grupos.every((g) => g.tipica === 0 && g.aportes.length === 0)).toBe(true);
    const soloDescarga = calcularVolumen([ses("2026-10-13", 6, "a", true)], ejercicios, HOY);
    expect(soloDescarga.tipicas).toEqual([]);
    expect(soloDescarga.grupos.every((g) => g.tipica === 0)).toBe(true);
    expect(calcularVolumen([], ejercicios, HOY).grupos.every((g) => g.tipica === 0)).toBe(true);
  });

  it("§12.3: con más de SEMANAS_TIPICAS semanas completas sólo cuentan las últimas", () => {
    expect(SEMANAS_TIPICAS).toBe(4);
    const lunes = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];
    const v = calcularVolumen(
      lunes.map((f, i) => ses(f, i === 0 || i === 1 ? 100 : 2)),
      ejercicios,
      HOY,
    );
    expect(v.tipicas).toEqual(lunes.slice(-SEMANAS_TIPICAS));
    expect(grupo(v, "pecho").tipica).toBe(2);
  });

  it("§12.4: un ejercicio sin grupo con series en la tira aparece en sinGrupo; uno clasificado no", () => {
    const v = calcularVolumen(
      [
        { fecha: "2026-10-13", deload: false, series: [{ exerciseId: "a", series: 3 }, { exerciseId: "b", series: 2 }] },
        ses("2026-11-03", 1, "b"),
      ],
      ejercicios,
      HOY,
    );
    expect(v.sinGrupo).toEqual([{ exerciseId: "b", nombre: "Sin clasificar", series: 3 }]);
  });
});
