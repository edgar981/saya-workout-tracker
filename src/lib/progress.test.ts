import { describe, it, expect } from "vitest";
import type { SetLog } from "@/lib/db/types";
import {
  claveComparable,
  evaluarProgreso,
  lunesDe,
  marcaDeAparicion,
  pesoCorporalEn,
  type Aparicion,
} from "@/lib/progress";
import { epley } from "@/lib/verdict";

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

const dips = (añadido: number | null, ...reps: number[]) =>
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

describe("§11 lunesDe", () => {
  it("§11.6: un domingo da su lunes", () => {
    expect(lunesDe("2026-11-08")).toBe("2026-11-02"); // domingo
  });
  it("§11.6: un lunes se da a sí mismo", () => {
    expect(lunesDe("2026-11-02")).toBe("2026-11-02");
  });
  it("§11.6: mitad de semana y cruce de mes", () => {
    expect(lunesDe("2026-11-04")).toBe("2026-11-02");
    expect(lunesDe("2026-11-01")).toBe("2026-10-26"); // domingo
  });
});

describe("§11.2 pesoCorporalEn", () => {
  const pesos = [
    { fecha: "2026-11-01", valor: 77, unidad: "KG" as const },
    { fecha: "2026-11-05", valor: 78, unidad: "KG" as const },
  ];
  it("§11.2: antes del primer registro, el primero", () => {
    expect(pesoCorporalEn(pesos, "2026-08-01", "KG")).toBe(77);
  });
  it("§11.2: el registro del mismo día cuenta", () => {
    expect(pesoCorporalEn(pesos, "2026-11-05", "KG")).toBe(78);
    expect(pesoCorporalEn(pesos, "2026-11-04", "KG")).toBe(77);
  });
  it("§11.2 / D5: sin registros en esa unidad → null (no se convierte)", () => {
    expect(pesoCorporalEn(pesos, "2026-11-05", "LB")).toBeNull();
  });
});

describe("§11.1 marcaDeAparicion", () => {
  it("§11.1: promedio de las dos mejores series (e1RM en carga variable)", () => {
    const m = marcaDeAparicion(kg(100, 5, 3, 10));
    expect(m).toBeCloseTo((epley(100, 10) + epley(100, 5)) / 2);
  });

  it("§11.1: en unilateral, por lado y luego el promedio de los lados", () => {
    const sets = [
      ...[1, 2].map((i) => serie({ reps: 5, side: "L", set_index: i })),
      ...[1, 2].map((i) => serie({ reps: 10, side: "R", set_index: i })),
    ];
    // Por lado: L = e1RM(5), R = e1RM(10); promedio de lados. Juntas, las dos
    // mejores serían las dos de R.
    expect(marcaDeAparicion(sets)).toBeCloseTo((epley(100, 5) + epley(100, 10)) / 2);
  });

  it("§11.1: en carga variable una serie de más de MAX_REPS_E1RM no cuenta", () => {
    expect(marcaDeAparicion(kg(100, 13, 5))).toBeCloseTo(epley(100, 5));
    expect(marcaDeAparicion(kg(100, 13))).toBeNull();
  });

  it("§11.1: BODYWEIGHT_PLUS con peso corporal → carga = cuerpo + añadido; una serie sin peso tecleado no cuenta", () => {
    const sets = [...dips(30, 8, 5), ...dips(null, 20)];
    expect(marcaDeAparicion(sets, 77)).toBeCloseTo((epley(107, 8) + epley(107, 5)) / 2);
  });

  it("§11.1: BODYWEIGHT_PLUS sin peso corporal → factor de Epley sin peso y sin tope", () => {
    expect(marcaDeAparicion(dips(30, 15))).toBeCloseTo(1 + 15 / 30);
  });
});

describe("§11.2 claveComparable", () => {
  it("§11.2: con peso corporal, dos añadidos distintos comparan", () => {
    expect(claveComparable(dips(30, 8), 77)).toBe(claveComparable(dips(40, 4), 77));
  });
  it("§11.2: sin peso corporal, dos añadidos distintos no comparan", () => {
    expect(claveComparable(dips(30, 8))).not.toBe(claveComparable(dips(40, 4)));
  });
  it("§11.2: la lateralidad observada separa claves", () => {
    const uni = [serie({ reps: 8, side: "L" })];
    expect(claveComparable(uni)).not.toBe(claveComparable(kg(100, 8)));
  });
});

describe("§11.4 evaluarProgreso (orden de la tabla)", () => {
  const HOY = "2026-11-08";
  const ap = (fecha: string, peso: number, extra: Partial<Aparicion> = {}): Aparicion => ({
    fecha,
    sets: kg(peso, 5),
    deload: false,
    pesoCorporal: null,
    ...extra,
  });
  // Semanal, la última hace 6 días respecto a HOY.
  const FECHAS = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"];

  it("§11.4: sin registros — nunca se hizo", () => {
    expect(evaluarProgreso([], HOY).estado).toBe("sin_registros");
  });

  it("§11.4: sin registrar — la más reciente tiene más de 14 días (gana sobre pocos datos y sobre subiendo)", () => {
    expect(evaluarProgreso([ap("2026-10-01", 100)], HOY).estado).toBe("sin_registrar");
    const subiendoViejo = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"].map((f, i) =>
      ap(f, 100 + 5 * i),
    );
    expect(evaluarProgreso(subiendoViejo, HOY).estado).toBe("sin_registrar");
    // 14 días exactos todavía no es «más de 14».
    expect(evaluarProgreso([ap("2026-10-25", 100)], "2026-11-08").estado).toBe("pocos_datos");
  });

  it("§11.4: pocos datos — menos de 4 comparables (gana sobre subiendo)", () => {
    const r = evaluarProgreso(FECHAS.slice(1).map((f, i) => ap(f, 100 + 5 * i)), HOY);
    expect(r.estado).toBe("pocos_datos");
    expect(r.puntos).toHaveLength(3);
  });

  it("§11.4: subiendo — mejor marca en alguna de las 2 últimas; cambio = últimas vs primeras", () => {
    const r = evaluarProgreso(FECHAS.map((f, i) => ap(f, 100 + 5 * i)), HOY);
    expect(r.estado).toBe("subiendo");
    const m = (w: number) => epley(w, 5);
    expect(r.cambio).toBeCloseTo((m(110) + m(115)) / 2 / ((m(100) + m(105)) / 2) - 1);
  });

  it("§11.4: por debajo — promedio de las 2 últimas ≤ 97% de la mejor marca", () => {
    const r = evaluarProgreso(
      [ap(FECHAS[0], 100), ap(FECHAS[1], 110), ap(FECHAS[2], 100), ap(FECHAS[3], 100)],
      HOY,
    );
    expect(r.estado).toBe("por_debajo");
    expect(r.mejor?.fecha).toBe(FECHAS[1]);
    expect(r.cambio).toBeCloseTo(epley(100, 5) / epley(110, 5) - 1);
  });

  it("§11.4: estancado — lo demás; semanas desde la mejor marca", () => {
    const r = evaluarProgreso(
      [ap(FECHAS[0], 110), ap(FECHAS[1], 100), ap(FECHAS[2], 109), ap(FECHAS[3], 109)],
      HOY,
    );
    expect(r.estado).toBe("estancado");
    expect(r.semanasSinMejorar).toBe(Math.floor(27 / 7)); // 12 oct → 8 nov
  });

  it("§11.3: un empate no es mejor marca (la fecha es la de la primera)", () => {
    const r = evaluarProgreso(
      [ap(FECHAS[0], 110), ap(FECHAS[1], 100), ap(FECHAS[2], 100), ap(FECHAS[3], 110)],
      HOY,
    );
    expect(r.mejor?.fecha).toBe(FECHAS[0]);
  });

  it("§11.2: una sesión con el tag de descarga queda fuera de la línea", () => {
    const normales = FECHAS.map((f, i) => ap(f, 100 + 5 * i));
    // La descarga es a otra unidad: si entrara, volvería incomparable todo lo anterior.
    const descarga: Aparicion = {
      fecha: "2026-11-04",
      sets: kg(50, 5).map((s) => ({ ...s, weight_unit: "LB" as const })),
      deload: true,
      pesoCorporal: null,
    };
    const r = evaluarProgreso([...normales, descarga], HOY);
    expect(r.deload).toBe(1);
    expect(r.puntos).toHaveLength(4);
    expect(r.otraCarga).toBe(0);
    expect(r.estado).toBe("subiendo");
  });
});
