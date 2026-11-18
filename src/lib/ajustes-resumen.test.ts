import { describe, expect, it } from "vitest";

import { contar, filtrarPorNombre, rangoMesociclo, resumenDia } from "./ajustes-resumen";

const fmt = (iso: string) => iso;

describe("ajustes-resumen", () => {
  it("contar pone singular con 1 y plural con lo demás", () => {
    expect(contar(1, "día", "días")).toBe("1 día");
    expect(contar(5, "día", "días")).toBe("5 días");
    expect(contar(0, "ejercicio", "ejercicios")).toBe("0 ejercicios");
  });

  it("rangoMesociclo sin inicio", () => {
    expect(rangoMesociclo(null, null, fmt)).toBe("sin fecha de inicio");
    expect(rangoMesociclo(null, "2026-12-14", fmt)).toBe("sin fecha de inicio");
  });

  it("rangoMesociclo con fin", () => {
    expect(rangoMesociclo("2026-11-02", "2026-12-14", fmt)).toBe("2026-11-02 – 2026-12-14");
  });

  it("rangoMesociclo sin fin dice desde el", () => {
    expect(rangoMesociclo("2026-11-02", null, fmt)).toBe("desde el 2026-11-02");
  });

  it("resumenDia con uno, con dos, con más de dos y sin nombres", () => {
    expect(resumenDia(["Pull Up"])).toBe("1 ejercicio · Pull Up");
    expect(resumenDia(["Pull Up", "Pull Down"])).toBe("2 ejercicios · Pull Up, Pull Down");
    expect(resumenDia(["Pull Up", "Pull Down", "Row", "Curl"])).toBe(
      "4 ejercicios · Pull Up, Pull Down…",
    );
    expect(resumenDia([])).toBe("0 ejercicios");
  });

  it("filtrarPorNombre ignora mayúsculas y espacios", () => {
    const lista = [{ nombre: "Pull Up" }, { nombre: "Curl" }];
    expect(filtrarPorNombre(lista, "  PULL ")).toEqual([{ nombre: "Pull Up" }]);
    expect(filtrarPorNombre(lista, "")).toBe(lista);
    expect(filtrarPorNombre(lista, "zzz")).toEqual([]);
  });
});
