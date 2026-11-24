import { describe, expect, it } from "vitest";

import { validarPedido, type FilaCuerpo, type FilaSerie } from "@/lib/agente/contrato";
import {
  EJEMPLOS,
  elegirFilas,
  normalizar,
  periodoDe,
  temaDe,
  type DatosCuerpo,
} from "@/lib/agente/filas";
import type {
  Exercise,
  RoutineDay,
  Session,
  SessionExercise,
  SetLog,
} from "@/lib/db/types";

const HOY = "2026-03-18"; // miércoles

describe("periodoDe", () => {
  it.each([
    ["¿Cuántas series llevo esta semana?", "2026-03-16", "2026-03-18"],
    ["¿Cuántas sesiones hice la semana pasada?", "2026-03-09", "2026-03-15"],
    ["¿Cuánto pesé este mes?", "2026-03-01", "2026-03-18"],
    ["¿Y el mes pasado?", "2026-02-01", "2026-02-28"],
    ["¿Qué hice ayer?", "2026-03-17", "2026-03-17"],
    ["¿Qué hice hoy?", "2026-03-18", "2026-03-18"],
    ["¿Cuántas series de pecho?", "2026-02-19", "2026-03-18"],
    ["¿CUÁNTAS series ESTA SEMANA?", "2026-03-16", "2026-03-18"],
    ["Semana pasada", "2026-03-09", "2026-03-15"],
  ])("%s", (q, desde, hasta) => {
    expect(periodoDe(q, HOY)).toEqual({ desde, hasta });
  });
});

describe("temaDe", () => {
  const lista = [
    { id: "a", nombre: "Incline Bench Press" },
    { id: "b", nombre: "Incline Bench Press Wide Grip" },
  ];
  it("grupo, peso, sesiones", () => {
    expect(temaDe("¿Cuántas series de pecho llevo esta semana?", [])).toEqual({
      tipo: "grupo",
      grupo: "pecho",
    });
    expect(temaDe("¿Cuánto pesé este mes?", [])).toEqual({ tipo: "peso" });
    expect(temaDe("¿Cuántas sesiones hice la semana pasada?", [])).toEqual({ tipo: "sesiones" });
  });
  it("el nombre más largo gana", () => {
    expect(temaDe("¿Cuántas series de Incline Bench Press Wide Grip hice?", lista)).toEqual({
      tipo: "ejercicio",
      id: "b",
    });
    expect(temaDe("¿Y el incline bench press?", lista)).toEqual({ tipo: "ejercicio", id: "a" });
  });
  it("grupo con tilde y sin tilde, e id", () => {
    expect(temaDe("¿y el bíceps?", [])).toEqual({ tipo: "grupo", grupo: "biceps" });
    expect(temaDe("¿y los hombros?", [])).toEqual({ tipo: "grupo", grupo: "hombros" });
    expect(temaDe("¿y mis isquios?", [])).toEqual({ tipo: "grupo", grupo: "isquios" });
  });
  it("series en general y sin tema", () => {
    expect(temaDe("¿Cuántas series hice?", [])).toEqual({ tipo: "series" });
    expect(temaDe("¿Cuánto gasté?", [])).toBeNull();
    expect(temaDe("¿Cuántas horas trabajé?", [])).toBeNull();
  });
  it("normalizar", () => {
    expect(normalizar("  ¿Cuántas   SERIES?  ")).toBe("cuantas series");
  });
});

// ── Datos inventados ─────────────────────────────────────────────────────────
const ej = (id: string, nombre: string, grupos: Exercise["grupos"]): Exercise => ({
  id,
  nombre,
  unit_type: "KG",
  weight_basis: "TOTAL",
  added_unit: null,
  stack_label: null,
  laterality_default: "BILATERAL",
  grupos,
  activo: true,
}) as Exercise;

const ejercicios: Exercise[] = [
  ej("e1", "Incline Bench Press Wide Grip", { pecho: "directo" }),
  ej("e2", "Weighted Dips", { pecho: "directo", triceps: "indirecto" }),
  ej("e3", "Sentadilla Libre", { cuadriceps: "directo" }),
];
const dias: RoutineDay[] = [{ id: "d4", nombre: "Day 4", orden: 4, mesociclo_id: "m1" }];

const ses = (p: Partial<Session> & Pick<Session, "id" | "fecha">): Session => ({
  routine_day_id: "d4",
  iniciada_en: `${p.fecha}T10:00:00Z`,
  cerrada_en: null,
  activa: 0,
  nota: null,
  tag_ids: [],
  ...p,
});
const ap = (id: string, session_id: string, exercise_id: string, orden: number): SessionExercise => ({
  id,
  session_id,
  routine_slot_id: null,
  exercise_id,
  orden_visual: orden,
  orden_ejecucion: null,
  creado_en: "2026-03-18T10:00:00Z",
  nota: null,
});
const st = (
  id: string,
  session_exercise_id: string,
  set_index: number,
  reps: number,
  unit: SetLog["weight_unit"] = "KG",
): SetLog =>
  ({
    id,
    session_exercise_id,
    set_index,
    segment_index: 0,
    reps,
    weight_value: 50,
    weight_unit: unit,
    weight_basis: "TOTAL",
    added_unit: null,
    side: null,
    es_extra: false,
  }) as SetLog;
const tres = (pref: string, a: string) => [st(`${pref}1`, a, 1, 8), st(`${pref}2`, a, 2, 8), st(`${pref}3`, a, 3, 8)];

function datos(extra: Partial<DatosCuerpo> = {}): DatosCuerpo {
  return {
    sesiones: [
      ses({ id: "s4", fecha: HOY, activa: 1 }),
      ses({ id: "s0", fecha: "2026-03-10", cerrada_en: "2026-03-10T11:00:00Z" }),
    ],
    apariciones: [
      ap("a2", "s4", "e2", 2),
      ap("a1", "s4", "e1", 1),
      ap("a3", "s4", "e3", 3),
      ap("a0", "s0", "e1", 1),
    ],
    sets: [...tres("x1", "a1"), ...tres("x2", "a2"), ...tres("x3", "a3"), ...tres("x0", "a0")],
    ejercicios,
    dias,
    pesos: [
      { id: "p1", fecha: "2026-03-05", valor: 80, unidad: "KG" },
      { id: "p0", fecha: "2026-02-05", valor: 81, unidad: "KG" },
    ],
    ...extra,
  };
}

const valido = (filas: FilaCuerpo[]) =>
  expect(validarPedido({ pregunta: "¿?", hoy: HOY, filas }).ok).toBe(true);

describe("elegirFilas", () => {
  it("pecho esta semana: las dos filas del Day 4, abierta", () => {
    const filas = elegirFilas("¿Cuántas series de pecho llevo esta semana?", HOY, datos());
    expect(filas).toHaveLength(2);
    const [a, b] = filas as FilaSerie[];
    expect(a.ejercicio).toBe("Incline Bench Press Wide Grip");
    expect(b.ejercicio).toBe("Weighted Dips");
    expect(b.indirectos).toEqual(["Tríceps"]);
    expect(b.directos).toEqual(["Pecho"]);
    for (const f of filas as FilaSerie[]) {
      expect(f.abierta).toBe(true);
      expect(f.series).toBe(3);
      expect(f.sesion).toBe("Day 4");
    }
    valido(filas);
  });

  it("una aparición con todas las reps en 0 no sale", () => {
    const d = datos();
    d.sets = d.sets.map((s) => (s.session_exercise_id === "a2" ? { ...s, reps: 0 } : s));
    expect(elegirFilas("series de pecho esta semana", HOY, d)).toHaveLength(1);
  });

  it("una sesión ni cerrada ni activa no sale", () => {
    const d = datos({ sesiones: [ses({ id: "s4", fecha: HOY, activa: 0, cerrada_en: null })] });
    expect(elegirFilas("series de pecho esta semana", HOY, d)).toEqual([]);
  });

  it("KG y LB en una aparición dan dos filas", () => {
    const d = datos();
    d.sets = [st("k1", "a1", 1, 8, "KG"), st("l1", "a1", 2, 8, "LB"), st("l2", "a1", 3, 8, "LB")];
    const filas = elegirFilas("series de pecho esta semana", HOY, d) as FilaSerie[];
    expect(filas.map((f) => [f.unidad, f.series])).toEqual([
      ["KG", 1],
      ["LB", 2],
    ]);
    valido(filas);
  });

  it("peso: sólo FilaPeso del periodo", () => {
    const filas = elegirFilas("¿Cuánto pesé este mes?", HOY, datos());
    expect(filas).toEqual([{ tipo: "peso", fecha: "2026-03-05", valor: 80, unidad: "KG" }]);
    valido(filas);
  });

  it("sesiones: FilaSesion bien contadas; sin día, «Sesión libre»", () => {
    const d = datos();
    d.sesiones = d.sesiones.map((s) => (s.id === "s0" ? { ...s, routine_day_id: null } : s));
    const filas = elegirFilas("¿Cuántas sesiones hice este mes?", HOY, d);
    expect(filas).toEqual([
      { tipo: "sesion", fecha: "2026-03-10", sesion: "Sesión libre", abierta: false, ejercicios: 1, series: 3 },
      { tipo: "sesion", fecha: HOY, sesion: "Day 4", abierta: true, ejercicios: 3, series: 9 },
    ]);
    valido(filas);
  });

  it("ejercicio y series en general", () => {
    const e = elegirFilas("Weighted Dips este mes", HOY, datos()) as FilaSerie[];
    expect(e.map((f) => f.ejercicio)).toEqual(["Weighted Dips"]);
    const todas = elegirFilas("¿Cuántas series este mes?", HOY, datos());
    expect(todas).toHaveLength(4);
    valido(todas);
  });

  it("sin tema → []", () => {
    expect(elegirFilas("¿Cuánto gasté?", HOY, datos())).toEqual([]);
  });
});

describe("EJEMPLOS", () => {
  it("las tres de Cuerpo, con tema y periodo propios", () => {
    expect(EJEMPLOS).toEqual([
      "¿Cuántas series de pecho llevo esta semana?",
      "¿Cuánto pesé este mes?",
      "¿Cuántas sesiones hice la semana pasada?",
    ]);
    const defecto = periodoDe("nada", HOY);
    for (const q of EJEMPLOS) {
      expect(temaDe(q, [])).not.toBeNull();
      expect(periodoDe(q, HOY)).not.toEqual(defecto);
    }
  });
});
