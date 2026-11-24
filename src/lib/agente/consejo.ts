import type { RespuestaAgente } from "./contrato";

const FORMAS = [
  "deberias",
  "deberia",
  "debes",
  "te recomiendo",
  "recomiendo",
  "recomendable",
  "te sugiero",
  "sugiero",
  "intenta",
  "intentar",
  "considera",
  "considerar",
  "conviene",
  "convendria",
  "seria bueno",
  "seria mejor",
  "es mejor que",
  "tienes que",
  "hay que",
  "prueba a",
  "te toca",
  "hoy toca",
  "recomendaria",
  "recomendamos",
  "recomendar",
  "sugeriria",
  "sugerimos",
  "sugerir",
  "aconsejo",
  "te aconsejo",
  "aconsejable",
  "aconsejaria",
  "aconsejar",
  "deberian",
  "debe",
  "deben",
  "deberas",
  "tendrias que",
  "tendras que",
  "habria que",
  "podrias",
  "necesitas",
  "necesitarias",
  "lo ideal",
  "buena idea",
  "vale la pena",
  "procura",
  "evitar",
  "considere",
  "intente",
  "intentes",
  "haz",
  "manten",
  "enfocate",
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const PATRON = new RegExp(
  `(?<![a-z0-9])(?:${FORMAS.map((f) => f.replace(/ /g, "\\s+")).join("|")})(?![a-z0-9])`,
);

/** Una forma de consejo como palabras enteras, sin importar tildes ni mayúsculas. «mejor» sola no lo es. */
export function esConsejo(texto: string): boolean {
  return PATRON.test(normalizar(texto));
}

export function respuestaConConsejo(r: RespuestaAgente): boolean {
  if (r.estado === "sin_datos") return false;
  const textos = [
    r.cifra,
    r.unidad,
    ...r.desglose.flatMap((d) => [d.etiqueta, d.valor]),
  ];
  return textos.some(esConsejo);
}
