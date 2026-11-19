import { describe, expect, it } from "vitest";

import {
  agruparPorGrupo,
  chipRespaldo,
  contar,
  filtrarPorNombre,
  rangoMesociclo,
  resumenCatalogo,
  resumenDia,
  resumenMesociclos,
  resumenPlantillas,
} from "./ajustes-resumen";
import type { Exercise } from "./db/types";

type Grupos = NonNullable<Exercise["grupos"]>;

const fmt = (iso: string) => iso;

describe("ajustes-resumen", () => {
  it("resumenMesociclos sin mesociclos, con activo y sin activo", () => {
    expect(resumenMesociclos(0, null)).toBeUndefined();
    expect(resumenMesociclos(0, "Mesociclo 2")).toBeUndefined();
    expect(resumenMesociclos(2, "Mesociclo 2")).toBe("2 · activo Mesociclo 2");
    expect(resumenMesociclos(2, null)).toBe("2");
  });

  it("resumenPlantillas sin activo y con uno o varios días", () => {
    expect(resumenPlantillas(5, null)).toBeUndefined();
    expect(resumenPlantillas(1, "Mesociclo 2")).toBe("1 día · Mesociclo 2");
    expect(resumenPlantillas(5, "Mesociclo 2")).toBe("5 días · Mesociclo 2");
  });

  it("agruparPorGrupo usa el primer directo, deja Sin grupo al final y salta los vacíos", () => {
    const lista: { n: string; grupos?: Grupos }[] = [
      { n: "sin-nada" },
      { n: "curl", grupos: { biceps: "directo", antebrazo: "indirecto" } },
      { n: "solo-indirecto", grupos: { pecho: "indirecto" } },
      { n: "press", grupos: { triceps: "directo", pecho: "directo" } },
      { n: "curl-2", grupos: { biceps: "directo" } },
      { n: "vacio", grupos: {} },
    ];
    const r = agruparPorGrupo(lista);
    expect(r.map((g) => g.grupo)).toEqual(["Pecho", "Bíceps", "Sin grupo"]);
    expect(r[0].ejercicios.map((e) => e.n)).toEqual(["press"]);
    expect(r[1].ejercicios.map((e) => e.n)).toEqual(["curl", "curl-2"]);
    expect(r[2].ejercicios.map((e) => e.n)).toEqual(["sin-nada", "solo-indirecto", "vacio"]);
    expect(agruparPorGrupo([])).toEqual([]);
  });

  it("resumenCatalogo con y sin grupos", () => {
    expect(resumenCatalogo(32, 11)).toBe("32 ejercicios · 11 grupos");
    expect(resumenCatalogo(1, 1)).toBe("1 ejercicio · 1 grupo");
    expect(resumenCatalogo(3, 0)).toBe("3 ejercicios");
  });

  it("chipRespaldo con error, pendiente y al día", () => {
    expect(chipRespaldo({ pending: true, lastError: "x" })).toEqual({ label: "Falló", cls: "ko" });
    expect(chipRespaldo({ pending: true, lastError: null })).toEqual({
      label: "Pendiente",
      cls: "text-ink",
    });
    expect(chipRespaldo({ pending: false, lastError: "x" })).toEqual({ label: "Al día", cls: "" });
    expect(chipRespaldo({ pending: false, lastError: undefined })).toEqual({
      label: "Al día",
      cls: "",
    });
  });

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
