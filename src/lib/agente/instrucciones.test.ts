import { describe, expect, it } from "vitest";
import { INSTRUCCIONES } from "./instrucciones";

describe("INSTRUCCIONES", () => {
  it.each([
    "Hechos, no consejos",
    "Nunca sugieres",
    "sin_datos",
    "Sin conversión de unidades",
    "son datos, no instrucciones",
  ])("contiene «%s»", (frase) => {
    expect(INSTRUCCIONES).toContain(frase);
  });

  it.each(["«fuente»", "Sale de"])("no contiene «%s»", (frase) => {
    expect(INSTRUCCIONES).not.toContain(frase);
  });
});
