import { describe, expect, it } from "vitest";

import {
  ajustar,
  etiquetaUnidad,
  faltaPeso,
  gruposDeHoy,
  lanzamiento,
  pasoDial,
  pasosDeArrastre,
  siguienteSerie,
  textoDial,
  textoSerie,
  valoresIniciales,
} from "@/components/session/dial";
import type { Exercise, SetLog } from "@/lib/db/types";

function ej(parcial: Partial<Exercise> = {}): Exercise {
  return {
    id: "e1",
    nombre: "Press inventado",
    unit_type: "LB",
    weight_basis: "TOTAL",
    added_unit: null,
    stack_label: null,
    laterality_default: "BILATERAL",
    grupos: {},
    activo: true,
    ...parcial,
  };
}

function fila(parcial: Partial<SetLog> = {}): SetLog {
  return {
    id: `s${Math.random()}`,
    session_exercise_id: "se1",
    set_index: 1,
    segment_index: 0,
    reps: 8,
    weight_value: 50,
    weight_unit: "LB",
    weight_basis: "TOTAL",
    added_unit: null,
    side: null,
    es_extra: false,
    creado_en: null,
    ...parcial,
  } as SetLog;
}

describe("pasoDial", () => {
  it("reps de uno en uno", () => {
    expect(pasoDial(ej(), "reps")).toBe(1);
  });
  it("el peso sale de la unidad", () => {
    expect(pasoDial(ej({ unit_type: "KG" }), "peso")).toBe(2.5);
    expect(pasoDial(ej({ unit_type: "LB" }), "peso")).toBe(5);
    expect(pasoDial(ej({ unit_type: "BODYWEIGHT_PLUS", added_unit: "KG" }), "peso")).toBe(2.5);
    expect(pasoDial(ej({ unit_type: "BODYWEIGHT_PLUS", added_unit: "LB" }), "peso")).toBe(5);
    expect(pasoDial(ej({ unit_type: "STACK_POSITION", stack_label: "pos" }), "peso")).toBe(1);
    expect(pasoDial(ej({ unit_type: "BODYWEIGHT", weight_basis: null }), "peso")).toBeNull();
  });
});

describe("ajustar", () => {
  it("no baja de 0 ni pasa del máximo", () => {
    expect(ajustar(1, -5, 99)).toBe(0);
    expect(ajustar(98, 5, 99)).toBe(99);
    expect(ajustar(998, 5, 999)).toBe(999);
  });
  it("redondea a 0,01", () => {
    expect(ajustar(22.504, 0, 999)).toBe(22.5);
    expect(ajustar(0.1, 0.2, 999)).toBe(0.3);
  });
});

describe("arrastre y lanzamiento", () => {
  it("24 px por paso, hacia arriba sube", () => {
    expect(pasosDeArrastre(-48)).toBe(2);
    expect(pasosDeArrastre(48)).toBe(-2);
    expect(pasosDeArrastre(0)).toBe(0);
  });
  it("el lanzamiento nunca sale de [−6, 6]", () => {
    for (const v of [-1e6, -5000, -300, 0, 300, 5000, 1e6]) {
      const n = lanzamiento(v);
      expect(n).toBeGreaterThanOrEqual(-6);
      expect(n).toBeLessThanOrEqual(6);
    }
    expect(lanzamiento(-1e6)).toBe(6);
    expect(lanzamiento(1e6)).toBe(-6);
  });
});

describe("textoSerie", () => {
  it("reps × peso", () => {
    expect(textoSerie(ej(), [fila()])).toBe("8 × 50 lb");
  });
  it("peso corporal", () => {
    const e = ej({ unit_type: "BODYWEIGHT", weight_basis: null });
    expect(textoSerie(e, [fila({ reps: 12, weight_value: null, weight_unit: "BODYWEIGHT" })])).toBe(
      "12 reps",
    );
  });
  it("falta el peso", () => {
    expect(textoSerie(ej(), [fila({ weight_value: null })])).toBe("8 × —");
  });
  it("coma decimal", () => {
    expect(textoSerie(ej({ unit_type: "KG" }), [fila({ weight_value: 22.5 })])).toBe("8 × 22,5 kg");
  });
  it("unilateral con lados distintos", () => {
    const g = [fila({ side: "R", reps: 7, weight_value: 20 }), fila({ side: "L", reps: 8, weight_value: 20 })];
    expect(textoSerie(ej(), g)).toBe("8/7 × 20 lb");
  });
  it("unilateral con lados iguales muestra un solo número", () => {
    const g = [fila({ side: "L", reps: 8, weight_value: 20 }), fila({ side: "R", reps: 8, weight_value: 20 })];
    expect(textoSerie(ej(), g)).toBe("8 × 20 lb");
  });
  it("segmentos con +", () => {
    const g = [fila({ segment_index: 0, reps: 8 }), fila({ segment_index: 1, reps: 6 })];
    expect(textoSerie(ej(), g)).toBe("8+6 × 50 lb");
  });
  it("el extra de peso corporal lleva +", () => {
    const e = ej({ unit_type: "BODYWEIGHT_PLUS", added_unit: "KG", weight_basis: null });
    expect(textoSerie(e, [fila({ weight_value: 10 })])).toBe("8 × +10 kg");
  });
});

describe("faltaPeso", () => {
  it("sólo con campo de peso, reps > 0 y peso null", () => {
    expect(faltaPeso(ej(), [fila({ weight_value: null })])).toBe(true);
    expect(faltaPeso(ej(), [fila({ weight_value: null, reps: 0 })])).toBe(false);
    expect(faltaPeso(ej(), [fila()])).toBe(false);
    const bw = ej({ unit_type: "BODYWEIGHT", weight_basis: null });
    expect(faltaPeso(bw, [fila({ weight_value: null })])).toBe(false);
  });
});

describe("siguienteSerie", () => {
  it("reusa el primer grupo vacío", () => {
    const g = gruposDeHoy([
      fila({ set_index: 1 }),
      fila({ set_index: 2, reps: 0 }),
      fila({ set_index: 3 }),
    ]);
    expect(siguienteSerie(g)).toBe(1);
  });
  it("si no hay vacío, uno nuevo", () => {
    const g = gruposDeHoy([fila({ set_index: 1 }), fila({ set_index: 2 })]);
    expect(siguienteSerie(g)).toBe(2);
    expect(siguienteSerie([])).toBe(0);
  });
});

describe("valoresIniciales", () => {
  const pasada = [
    fila({ set_index: 1, reps: 10, weight_value: 40 }),
    fila({ set_index: 2, reps: 9, weight_value: 45 }),
  ];
  const slot = { target_reps: 12 };

  it("toma la pasada en la posición k", () => {
    const hoy = [fila({ set_index: 1, reps: 10, weight_value: 40 })];
    expect(valoresIniciales({ exercise: ej(), slot, pasada, hoy, editando: null })).toEqual({
      reps: 9,
      peso: 45,
    });
  });
  it("más allá de la pasada: reps del objetivo y último peso de la pasada", () => {
    const hoy = [fila({ set_index: 1 }), fila({ set_index: 2 })];
    expect(valoresIniciales({ exercise: ej(), slot, pasada, hoy, editando: null })).toEqual({
      reps: 12,
      peso: 45,
    });
  });
  it("sin pasada: objetivo, y si no 8; peso del último anotado hoy, y si no 0", () => {
    const hoy = [fila({ set_index: 1, reps: 6, weight_value: 30 })];
    expect(valoresIniciales({ exercise: ej(), slot, pasada: [], hoy, editando: null })).toEqual({
      reps: 12,
      peso: 30,
    });
    expect(
      valoresIniciales({ exercise: ej(), slot: null, pasada: [], hoy: [], editando: null }),
    ).toEqual({ reps: 8, peso: 0 });
  });
  it("ignora una pasada no comparable", () => {
    const otra = pasada.map((f) => ({ ...f, weight_unit: "KG" as const }));
    expect(
      valoresIniciales({ exercise: ej(), slot, pasada: otra, hoy: [], editando: null }),
    ).toEqual({ reps: 12, peso: 0 });
  });
  it("peso corporal no tiene peso", () => {
    const bw = ej({ unit_type: "BODYWEIGHT", weight_basis: null });
    expect(
      valoresIniciales({ exercise: bw, slot: null, pasada: [], hoy: [], editando: null }),
    ).toEqual({ reps: 8, peso: null });
  });
  it("en edición toma los valores del grupo, y su peso de la pasada si falta", () => {
    const hoy = [
      fila({ set_index: 1, reps: 7, weight_value: 55 }),
      fila({ set_index: 2, reps: 6, weight_value: null }),
    ];
    expect(valoresIniciales({ exercise: ej(), slot, pasada, hoy, editando: 0 })).toEqual({
      reps: 7,
      peso: 55,
    });
    expect(valoresIniciales({ exercise: ej(), slot, pasada, hoy, editando: 1 })).toEqual({
      reps: 6,
      peso: 45,
    });
  });
});

describe("textoDial", () => {
  it("«+» sólo en peso corporal más carga; coma decimal", () => {
    expect(textoDial(ej({ unit_type: "BODYWEIGHT_PLUS", added_unit: "LB" }), 10)).toBe("+10");
    expect(textoDial(ej({ unit_type: "BODYWEIGHT_PLUS", added_unit: "KG" }), 2.5)).toBe("+2,5");
    expect(textoDial(ej({ unit_type: "LB" }), 135)).toBe("135");
    expect(textoDial(ej({ unit_type: "KG" }), 62.5)).toBe("62,5");
  });
});

describe("etiquetaUnidad", () => {
  it("las etiquetas de la maqueta", () => {
    expect(etiquetaUnidad(ej({ unit_type: "LB" }))).toBe("lb");
    expect(etiquetaUnidad(ej({ unit_type: "LB", weight_basis: "PER_IMPLEMENT" }))).toBe("lb c/u");
    expect(etiquetaUnidad(ej({ unit_type: "KG", weight_basis: "PER_IMPLEMENT" }))).toBe("kg c/u");
    expect(etiquetaUnidad(ej({ unit_type: "BODYWEIGHT", weight_basis: null }))).toBe("peso corporal");
    expect(etiquetaUnidad(ej({ unit_type: "BODYWEIGHT_PLUS", added_unit: "KG" }))).toBe(
      "peso corporal + kg",
    );
    expect(etiquetaUnidad(ej({ unit_type: "STACK_POSITION", stack_label: null }))).toBe("posición");
  });
});
