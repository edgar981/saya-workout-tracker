import { describe, expect, it } from "vitest";

import {
  agruparPorSemana,
  celdasDeSemana,
  diaCorto,
  escalaVolumen,
  filasHojaGrupo,
  geometriaBalance,
  signo,
  subtituloProgreso,
  textoSemana,
  type SesionDia,
} from "@/components/progress/semanas";
import type { SemanaBalance } from "@/lib/progress";

const fecha = (iso: string) => "f" + iso;

const sem = (lunes: string, net: number, sesiones = 1, deload = false): SemanaBalance => ({
  lunes,
  net,
  sesiones,
  deload,
});

describe("signo", () => {
  it("más, menos tipográfico y cero", () => {
    expect(signo(3)).toBe("+3");
    expect(signo(-4)).toBe("−4");
    expect(signo(-4).charCodeAt(0)).toBe(0x2212);
    expect(signo(0)).toBe("0");
  });
});

describe("geometriaBalance", () => {
  const ocho = [-4, 0, 6, 1, -1, 2, 3, 5].map((n, i) => sem(`2026-09-${String(7 + i).padStart(2, "0")}`, n));

  it("de −4 a +6 la escala es la de la maqueta", () => {
    const g = geometriaBalance(ocho);
    expect(g.k).toBe(11);
    expect(g.cero).toBe(68);
    expect(g.barras[2]).toMatchObject({ top: 2, alto: 66, negativo: false });
    expect(g.barras[0]).toMatchObject({ top: 68, alto: 44, negativo: true });
  });

  it("un neto 0 con sesiones da alto 2", () => {
    const g = geometriaBalance(ocho);
    expect(g.barras[1]).toMatchObject({ alto: 2, top: 66, hueco: false });
  });

  it("un hueco no tiene barra", () => {
    const g = geometriaBalance([sem("2026-09-07", 0, 0), sem("2026-09-14", 2)]);
    expect(g.barras[0].hueco).toBe(true);
    expect(g.barras[1].hueco).toBe(false);
  });

  it("con ocho semanas la tercera empieza en 25 % y mide 12,5 %", () => {
    const g = geometriaBalance(ocho);
    expect(g.barras[2].left).toBe("25.000");
    expect(g.barras[2].width).toBe("12.500");
  });

  it("con +12 la escala baja y nada sale de [0, 114]", () => {
    const g = geometriaBalance([sem("2026-09-07", 12), sem("2026-09-14", -4)]);
    expect(g.k).toBe(5.5);
    for (const b of g.barras) {
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.top + b.alto).toBeLessThanOrEqual(114);
    }
  });

  it("un negativo grande también encoge", () => {
    const g = geometriaBalance([sem("2026-09-07", -22)]);
    expect(g.k).toBe(2);
    expect(g.barras[0].top + g.barras[0].alto).toBe(112);
  });
});

describe("textoSemana", () => {
  it("singular, plural y descarga", () => {
    expect(textoSemana(sem("2026-11-09", 3, 1), fecha)).toBe("Semana del f2026-11-09 · 1 sesión");
    expect(textoSemana(sem("2026-11-09", 3, 3), fecha)).toBe("Semana del f2026-11-09 · 3 sesiones");
    expect(textoSemana(sem("2026-11-09", 3, 3, true), fecha)).toBe(
      "Semana del f2026-11-09 · 3 sesiones · descarga",
    );
  });
});

describe("subtituloProgreso", () => {
  it("vacío, una y varias", () => {
    expect(subtituloProgreso(0, null, fecha)).toBe("Sin sesiones cerradas");
    expect(subtituloProgreso(1, "2026-09-15", fecha)).toBe("1 sesión cerrada · desde el f2026-09-15");
    expect(subtituloProgreso(40, "2026-09-15", fecha)).toBe("40 sesiones cerradas · desde el f2026-09-15");
  });
});

describe("diaCorto", () => {
  it("día de la semana y número", () => {
    expect(diaCorto("2026-09-21")).toBe("Lun 21");
    expect(diaCorto("2026-11-08")).toBe("Dom 8");
  });
});

const s = (id: string, f: string, net: number, dia: string | null): SesionDia => ({
  id,
  fecha: f,
  net,
  routineDayId: dia,
});

describe("agruparPorSemana", () => {
  it("un domingo cae en la semana de su lunes y cada lista sale ordenada", () => {
    const g = agruparPorSemana([
      s("c", "2026-11-08", 1, "d1"),
      s("a", "2026-11-02", 1, "d1"),
      s("b", "2026-11-04", 1, "d2"),
      s("d", "2026-11-09", 1, "d1"),
    ]);
    expect(g["2026-11-02"].map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(g["2026-11-09"].map((x) => x.id)).toEqual(["d"]);
  });
});

describe("celdasDeSemana", () => {
  const dias = [
    { id: "d1", nombre: "Day 1" },
    { id: "d2", nombre: "Day 2" },
    { id: "d5", nombre: "Day 5" },
  ];

  it("una celda por día, en el orden de dias; sin sesión es vacía", () => {
    const c = celdasDeSemana(dias, [s("a", "2026-09-22", 1, "d2")], fecha);
    expect(c.map((x) => x.dia.id)).toEqual(["d1", "d2", "d5"]);
    expect(c[0].vacia).toBe(true);
    expect(c[1].vacia).toBeFalsy();
  });

  it("dos sesiones del mismo día: la primera por fecha", () => {
    const c = celdasDeSemana(
      dias,
      [s("tarde", "2026-09-24", 5, "d1"), s("pronto", "2026-09-22", 2, "d1")],
      fecha,
    );
    expect(c[0]).toMatchObject({ sessionId: "pronto", net: 2 });
  });

  it("una sesión sin día de rutina no tiene celda", () => {
    const c = celdasDeSemana(dias, [s("x", "2026-09-22", 3, null)], fecha);
    expect(c.every((x) => x.vacia)).toBe(true);
  });

  it("mut con net 0 y negativo, no con positivo; el aria", () => {
    const c = celdasDeSemana(
      dias,
      [s("a", "2026-09-21", 2, "d5"), s("b", "2026-09-22", 0, "d1"), s("c", "2026-09-23", -1, "d2")],
      fecha,
    );
    expect(c[2]).toMatchObject({ mut: false, texto: "+2", corta: "Lun 21", aria: "Day 5, Lun, f2026-09-21, balance +2" });
    expect(c[0]).toMatchObject({ mut: true, texto: "0" });
    expect(c[1]).toMatchObject({ mut: true, texto: "−1" });
  });
});

describe("escalaVolumen", () => {
  it("todos 0 → 1; si no, la mayor", () => {
    expect(escalaVolumen([{ tipica: 0 }, { tipica: 0 }])).toBe(1);
    expect(escalaVolumen([])).toBe(1);
    expect(escalaVolumen([{ tipica: 4 }, { tipica: 17.5 }])).toBe(17.5);
  });
});

describe("filasHojaGrupo", () => {
  const ap = (id: string, nombre: string, rol: "directo" | "indirecto", series: number) => ({
    exerciseId: id,
    nombre,
    rol,
    series,
  });
  const grupo = {
    tipica: 17.5,
    directas: 12,
    aportes: [
      ap("e1", "Dips", "directo", 7),
      ap("e2", "Press", "directo", 5),
      ap("e3", "A", "indirecto", 6),
      ap("e4", "B", "indirecto", 5),
    ],
  };

  it("directos primero y una fila que junta los indirectos", () => {
    const r = filasHojaGrupo(grupo, (id) => (id === "e1" ? "Subiendo" : null));
    expect(r.subtitulo).toBe("17,5 series por semana · 12 directas");
    expect(r.filas).toHaveLength(3);
    expect(r.filas[0]).toEqual({ t: "Dips", s: "Subiendo", v: "7" });
    expect(r.filas[1]).toEqual({ t: "Press", v: "5" });
    expect(r.filas[2]).toEqual({ t: "A · B (½ de 11)", v: "5,5" });
  });

  it("sin aportes no hay filas", () => {
    expect(filasHojaGrupo({ tipica: 0, directas: 0, aportes: [] }, () => null).filas).toEqual([]);
  });
});
