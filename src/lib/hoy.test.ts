import { describe, expect, it } from "vitest";

import { resumirPeso } from "@/lib/cuerpo";
import type { SetLine } from "@/lib/history-format";
import {
  estadoSesion,
  fechaCabeza,
  fechaDiaMes,
  fechaUltimaVez,
  lineaCierre,
  lineaCompacta,
  lineaProgreso,
  lineaSesionTesela,
  subtituloHoy,
  subtituloPesoHoy,
  textoBotonDia,
} from "@/lib/hoy";

const linea = (p: Partial<SetLine>): SetLine => ({
  setIndex: 1,
  repsText: "8",
  total: null,
  weightText: "+10 kg",
  isBodyweight: false,
  esExtra: false,
  gap: null,
  ...p,
});

describe("fechaCabeza", () => {
  it("un martes de noviembre", () => {
    expect(fechaCabeza(new Date(2026, 10, 10))).toBe("Martes 10 de noviembre");
  });
  it("un día de un dígito", () => {
    expect(fechaCabeza(new Date(2026, 8, 5))).toBe("Sábado 5 de septiembre");
  });
});

describe("subtituloHoy", () => {
  it("con semana", () => {
    expect(subtituloHoy("Mesociclo 2", 2)).toBe("Mesociclo 2 · semana 2");
  });
  it("sin semana", () => {
    expect(subtituloHoy("Mesociclo 1", null)).toBe("Mesociclo 1");
  });
  it("sin mesociclo", () => {
    expect(subtituloHoy(null, null)).toBeNull();
  });
});

describe("estadoSesion", () => {
  const ahora = new Date(2026, 10, 10, 12, 0, 0);
  it("a 30 segundos: recién empezada", () => {
    const ini = new Date(ahora.getTime() - 30_000).toISOString();
    expect(estadoSesion(ini, ahora)).toBe("Sesión abierta · recién empezada");
  });
  it("a 41 minutos", () => {
    const ini = new Date(ahora.getTime() - 41 * 60_000).toISOString();
    expect(estadoSesion(ini, ahora)).toBe("Sesión abierta · hace 41 min");
  });
  it("a 3 horas", () => {
    const ini = new Date(ahora.getTime() - 3 * 3_600_000).toISOString();
    expect(estadoSesion(ini, ahora)).toBe("Sesión abierta · hace 3 h");
  });
  it("ayer", () => {
    const ini = new Date(2026, 10, 9, 20, 0, 0).toISOString();
    expect(estadoSesion(ini, ahora)).toBe("Sesión abierta · ayer");
  });
});

describe("lineaProgreso", () => {
  it("con total", () => {
    expect(lineaProgreso(4, 5, 10)).toBe("4 / 5 hechos · 10 series");
  });
  it("sin total", () => {
    expect(lineaProgreso(0, 0, 10)).toBe("10 series");
  });
  it("una serie", () => {
    expect(lineaProgreso(0, 0, 1)).toBe("1 serie");
  });
});

describe("subtituloPesoHoy", () => {
  const fecha = (iso: string) => `f:${iso}`;
  it("con un registro", () => {
    const r = resumirPeso([{ fecha: "2026-11-09", valor: 78.4, unidad: "KG" }])!;
    expect(subtituloPesoHoy(r, fecha)).toBe("f:2026-11-09");
  });
  it("con varios, con el signo menos real", () => {
    const r = resumirPeso([
      { fecha: "2026-09-15", valor: 79.6, unidad: "KG" },
      { fecha: "2026-11-09", valor: 78.4, unidad: "KG" },
    ])!;
    expect(subtituloPesoHoy(r, fecha)).toBe("f:2026-11-09 · −1,2 kg desde el f:2026-09-15");
  });
});

describe("lineaCompacta", () => {
  it("mismo peso", () => {
    const ls = [8, 7, 6].map((n, i) => linea({ setIndex: i + 1, repsText: String(n) }));
    expect(lineaCompacta(ls)).toBe("8, 7, 6 × +10 kg");
  });
  it("peso corporal: sólo las reps", () => {
    const ls = [8, 7].map((n) =>
      linea({ repsText: String(n), weightText: "peso corporal", isBodyweight: true }),
    );
    expect(lineaCompacta(ls)).toBe("8, 7");
  });
  it("pesos distintos: cada serie entera", () => {
    const ls = [
      linea({ repsText: "8", weightText: "170 lb" }),
      linea({ repsText: "6", weightText: "165 lb" }),
    ];
    expect(lineaCompacta(ls)).toBe("8 × 170 lb, 6 × 165 lb");
  });
  it("una sola serie", () => {
    expect(lineaCompacta([linea({ repsText: "10", weightText: "40 kg" })])).toBe("10 × 40 kg");
  });
  it("una línea L/R", () => {
    expect(lineaCompacta([linea({ repsText: "6L / 7R", weightText: "20 kg" })])).toBe(
      "6L / 7R × 20 kg",
    );
  });
  it("sin líneas", () => {
    expect(lineaCompacta([])).toBe("");
  });
});

describe("lineaCierre", () => {
  it("con total", () => {
    expect(lineaCierre({ dia: "Day 4", hace: "hace 41 min", hechos: 4, total: 5, series: 10 })).toBe(
      "Day 4 · hace 41 min · 4 de 5 ejercicios · 10 series",
    );
  });
  it("sin total", () => {
    expect(lineaCierre({ dia: "Day 4", hace: "hace 41 min", hechos: 0, total: 0, series: 10 })).toBe(
      "Day 4 · hace 41 min · 10 series",
    );
  });
  it("una serie", () => {
    expect(lineaCierre({ dia: "Day 4", hace: "hace 41 min", hechos: 0, total: 0, series: 1 })).toBe(
      "Day 4 · hace 41 min · 1 serie",
    );
  });
  it("sin día", () => {
    expect(lineaCierre({ dia: null, hace: "ayer", hechos: 0, total: 0, series: 3 })).toBe(
      "Sesión libre · ayer · 3 series",
    );
  });
});

describe("SAYA-R2-3: fechas y textos de las teselas", () => {
  it("fechaDiaMes", () => {
    expect(fechaDiaMes("2026-11-09")).toBe("9 nov");
  });
  it("fechaUltimaVez", () => {
    expect(fechaUltimaVez("2026-11-05")).toBe("Jue, 5 nov");
    expect(fechaUltimaVez("2026-11-04")).toBe("Mié, 4 nov");
    expect(fechaUltimaVez("2026-11-07")).toBe("Sáb, 7 nov");
    expect(fechaUltimaVez("2026-09-15")).toBe("Mar, 15 sep");
  });
  it("lineaSesionTesela", () => {
    expect(lineaSesionTesela("Day 1", 10)).toBe("Day 1 · 10 series");
    expect(lineaSesionTesela("Day 1", 1)).toBe("Day 1 · 1 serie");
  });
  it("textoBotonDia", () => {
    expect(textoBotonDia({ mismoDia: true, abierta: "Day 1", nombreDia: "Day 1" })).toBe(
      "Continuar donde ibas →",
    );
    expect(textoBotonDia({ mismoDia: false, abierta: "Day 1", nombreDia: "Day 2" })).toBe(
      "Cerrar Day 1 y empezar Day 2",
    );
    expect(textoBotonDia({ mismoDia: false, abierta: null, nombreDia: "Day 2" })).toBe(
      "Empezar Day 2",
    );
  });
});
