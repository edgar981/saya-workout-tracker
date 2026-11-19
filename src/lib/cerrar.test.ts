import { describe, expect, it } from "vitest";

import { unidadPorDefecto } from "@/lib/cerrar";
import type { PesoRegistro } from "@/lib/cuerpo";

const p = (fecha: string, valor: number, unidad: "KG" | "LB"): PesoRegistro => ({
  fecha,
  valor,
  unidad,
});

describe("unidadPorDefecto", () => {
  it("sin pesos es KG", () => {
    expect(unidadPorDefecto([])).toBe("KG");
  });

  it("un solo peso en LB es LB", () => {
    expect(unidadPorDefecto([p("2026-11-01", 170, "LB")])).toBe("LB");
  });

  it("gana el más reciente por fecha aunque la tabla esté desordenada (LB)", () => {
    expect(
      unidadPorDefecto([
        p("2026-11-10", 170, "LB"),
        p("2026-11-01", 78, "KG"),
        p("2026-11-05", 77, "KG"),
      ]),
    ).toBe("LB");
  });

  it("gana el más reciente por fecha aunque la tabla esté desordenada (KG)", () => {
    expect(
      unidadPorDefecto([
        p("2026-11-10", 78, "KG"),
        p("2026-11-01", 170, "LB"),
        p("2026-11-05", 169, "LB"),
      ]),
    ).toBe("KG");
  });

  it("en un empate de fecha gana el que está después en la tabla", () => {
    expect(unidadPorDefecto([p("2026-11-10", 78, "KG"), p("2026-11-10", 170, "LB")])).toBe("LB");
  });
});
