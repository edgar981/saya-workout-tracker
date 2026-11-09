import { describe, it, expect } from "vitest";
import type { SetLog } from "@/lib/db/types";
import { compareAppearances, MAX_REPS_E1RM } from "@/lib/verdict";

let n = 0;
function serie(p: Partial<SetLog> & { reps: number }): SetLog {
  n += 1;
  return {
    id: `s${n}`,
    session_exercise_id: "se",
    set_index: 1,
    segment_index: 0,
    weight_value: 100,
    weight_unit: "KG",
    weight_basis: "TOTAL",
    added_unit: null,
    side: null,
    es_extra: false,
    creado_en: null,
    ...p,
  };
}

const kg = (peso: number, ...reps: number[]) =>
  reps.map((r, i) => serie({ reps: r, weight_value: peso, set_index: i + 1 }));

const dips = (añadido: number, ...reps: number[]) =>
  reps.map((r, i) =>
    serie({
      reps: r,
      weight_value: añadido,
      weight_unit: "BODYWEIGHT_PLUS",
      weight_basis: null,
      added_unit: "KG",
      set_index: i + 1,
    }),
  );

describe("§3.5 / §11.2 compareAppearances", () => {
  it("§3.5: mismo peso → compara reps totales", () => {
    const v = compareAppearances(kg(100, 8, 8), kg(100, 7, 7));
    expect(v.method).toBe("reps_totales");
    expect(v.category).toBe("mejor");
    expect(v.current).toBe(16);
    expect(v.previous).toBe(14);
  });

  it("§3.5: peso distinto → e1RM de la mejor serie (no reps totales)", () => {
    // Reps totales: 5 contra 15 sería «peor»; por e1RM de la mejor serie es «mejor».
    const v = compareAppearances(kg(110, 5), kg(100, 5, 5, 5));
    expect(v.method).toBe("e1rm");
    expect(v.category).toBe("mejor");
    expect(v.current).toBeCloseTo(110 * (1 + 5 / 30));
    expect(v.previous).toBeCloseTo(100 * (1 + 5 / 30));
  });

  it("§11.2: una serie de más de MAX_REPS_E1RM reps con peso distinto → sin comparación", () => {
    expect(MAX_REPS_E1RM).toBe(12);
    const v = compareAppearances(kg(110, 13), kg(100, 8));
    expect(v.category).toBe("sin_comparacion");
    expect(v.reason).toBe("fuera_rango_e1rm");
  });

  it("§3.5: unidad distinta → sin comparación (no se convierte)", () => {
    const lb = kg(100, 8).map((s) => ({ ...s, weight_unit: "LB" as const }));
    const v = compareAppearances(lb, kg(100, 8));
    expect(v.category).toBe("sin_comparacion");
    expect(v.reason).toBe("cambio_unidad");
  });

  it("§11.2: BODYWEIGHT_PLUS sin peso corporal → e1RM sobre el añadido solo: +30×8 contra +40×4 es «peor»", () => {
    const v = compareAppearances(dips(30, 8), dips(40, 4));
    expect(v.method).toBe("e1rm");
    expect(v.category).toBe("peor");
  });

  it("§11.2: BODYWEIGHT_PLUS con 77 de peso corporal en las dos → cuerpo + añadido: +30×8 contra +40×4 es «mejor»", () => {
    const v = compareAppearances(dips(30, 8), dips(40, 4), { actual: 77, previo: 77 });
    expect(v.method).toBe("e1rm");
    expect(v.category).toBe("mejor");
    expect(v.current).toBeCloseTo(107 * (1 + 8 / 30));
    expect(v.previous).toBeCloseTo(117 * (1 + 4 / 30));
  });

  it("§11.2: BODYWEIGHT_PLUS con peso corporal en una sola aparición → como sin él", () => {
    expect(compareAppearances(dips(30, 8), dips(40, 4), { actual: 77, previo: null }).category).toBe("peor");
    expect(compareAppearances(dips(30, 8), dips(40, 4), { actual: null, previo: 77 }).category).toBe("peor");
  });

  it("§11.2: en KG el peso corporal no cambia nada", () => {
    const sin = compareAppearances(kg(110, 5), kg(100, 5));
    const con = compareAppearances(kg(110, 5), kg(100, 5), { actual: 77, previo: 77 });
    expect(con).toEqual(sin);
  });
});
