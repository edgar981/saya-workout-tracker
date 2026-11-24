import { describe, expect, it } from "vitest";
import { esConsejo, respuestaConConsejo } from "./consejo";

describe("esConsejo", () => {
  it.each([
    "Deberías descansar",
    "deberia descansar",
    "Debes parar",
    "TE RECOMIENDO subir",
    "Recomiendo bajar",
    "Es recomendable parar",
    "Te sugiero otra",
    "Sugiero otra",
    "Intenta otra serie",
    "Intentar otra serie",
    "Considera bajar",
    "Considerar bajar",
    "Conviene bajar el peso",
    "Convendría bajar",
    "Sería bueno descargar",
    "Seria mejor parar",
    "Es mejor que pares",
    "Tienes que subir",
    "Hay que subir",
    "Prueba a subir",
    "Te toca pierna",
    "Hoy toca Day 3",
  ])("«%s» es consejo", (t) => {
    expect(esConsejo(t)).toBe(true);
  });

  it.each([
    "6 series",
    "Day 4 de hoy, abierta",
    "Incline Bench Press Wide Grip",
    "mejor",
    "3 mejor · 1 peor",
    "78,4 kg",
    "Semana 6 desde la última pausa",
  ])("«%s» no es consejo", (t) => {
    expect(esConsejo(t)).toBe(false);
  });

  it("sólo palabras enteras", () => {
    expect(esConsejo("Hay quesos")).toBe(false);
    expect(esConsejo("Reintentar")).toBe(false);
  });
});

describe("respuestaConConsejo", () => {
  const base = {
    estado: "respuesta" as const,
    cifra: "6",
    unidad: "series",
    desglose: [{ etiqueta: "Weighted Dips", valor: "3" }],
    fuente: "Day 4 de hoy, abierta",
  };
  it("limpia es falso", () => {
    expect(respuestaConConsejo(base)).toBe(false);
  });
  it("consejo sólo en una etiqueta del desglose", () => {
    expect(
      respuestaConConsejo({ ...base, desglose: [{ etiqueta: "Deberías descansar", valor: "3" }] }),
    ).toBe(true);
  });
  it("consejo en la fuente", () => {
    expect(respuestaConConsejo({ ...base, fuente: "Hoy toca Day 3" })).toBe(true);
  });
  it("sin_datos nunca es consejo", () => {
    expect(respuestaConConsejo({ estado: "sin_datos" })).toBe(false);
  });
});
