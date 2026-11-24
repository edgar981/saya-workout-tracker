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
    "Te recomendaría descansar",
    "Recomendamos parar",
    "Sugeriría bajar",
    "Deberían bajar",
    "Debe descansar",
    "Tendrías que subir",
    "Habría que bajar",
    "Te aconsejo parar",
    "Es aconsejable",
    "Considere bajar",
    "Intente otra",
    "Podrías subir",
    "Lo ideal sería parar",
    "Es buena idea descansar",
    "Vale la pena bajar",
    "Necesitas descansar",
    "Procura dormir",
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
    "Subiste 2,5 kg desde octubre",
    "Bajó 1,2 kg",
    "Haces 4 series de pecho",
    "Deadlift",
    "Día de descanso",
    "Sin registrar",
    "Hechas en 3 sesiones",
    "Evitado",
    "Aumentó 3 series",
    "El peso sube 0,4 kg",
    "El volumen aumenta 3 series",
    "Saya descansa 2 días por semana",
    "Agrega 2 series esta semana",
    "El press añade 2,5 kg",
    "La rutina evita el lunes",
  ])("«%s» no es consejo", (t) => {
    expect(esConsejo(t)).toBe(false);
  });

  it("los imperativos que son también tercera persona no se atrapan con palabras", () => {
    expect(esConsejo("Sube de 78 a 79")).toBe(false);
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
  };
  it("limpia es falso", () => {
    expect(respuestaConConsejo(base)).toBe(false);
  });
  it("consejo sólo en una etiqueta del desglose", () => {
    expect(
      respuestaConConsejo({ ...base, desglose: [{ etiqueta: "Deberías descansar", valor: "3" }] }),
    ).toBe(true);
  });
  it("consejo en la cifra, en la unidad o en una etiqueta se detecta", () => {
    expect(respuestaConConsejo({ ...base, cifra: "Deberías descansar" })).toBe(true);
    expect(respuestaConConsejo({ ...base, unidad: "Hoy toca Day 3" })).toBe(true);
    expect(
      respuestaConConsejo({ ...base, desglose: [{ etiqueta: "Te recomiendo parar", valor: "3" }] }),
    ).toBe(true);
  });
  it("una clave «fuente» de más no se mira", () => {
    expect(respuestaConConsejo({ ...base, fuente: "Hoy toca Day 3" } as typeof base)).toBe(false);
  });
  it("sin_datos nunca es consejo", () => {
    expect(respuestaConConsejo({ estado: "sin_datos" })).toBe(false);
  });
});
