import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parsePeso } from "./peso";

const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

/** La función local que tenía close-screen.tsx (parsedWeight), copiada tal cual. */
function parsedWeightOriginal(weight: string): number | null {
  const cleaned = weight.replace(",", ".").replace(/[^\d.]/g, "");
  if (cleaned === "") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

describe("parsePeso", () => {
  const casos: [string, number | null][] = [
    ["78,4", 78.4],
    ["78.4", 78.4],
    [" 78,4 kg", 78.4],
    ["", null],
    ["abc", null],
    ["0", 0],
  ];

  it.each(casos)("%j -> %j", (texto, esperado) => {
    expect(parsePeso(texto)).toBe(esperado);
  });

  it("da lo mismo que la función local que tenía el cierre", () => {
    for (const [texto] of casos) {
      expect(parsePeso(texto)).toBe(parsedWeightOriginal(texto));
    }
  });
});

describe("una sola regla de lectura", () => {
  it("close-screen.tsx ya no define su propia lectura y importa parsePeso", () => {
    const fuente = leer("src/components/screens/close-screen.tsx");
    expect(fuente).not.toMatch(/Number\.parseFloat/);
    expect(fuente).not.toMatch(/replace\(\/\[\^\\d\.\]/);
    expect(fuente).toMatch(/import\s*\{[^}]*\bparsePeso\b[^}]*\}\s*from\s*"@\/lib\/peso"/);
  });

  it("peso-sheet.tsx usa parsePeso", () => {
    const fuente = leer("src/components/peso-sheet.tsx");
    expect(fuente).toMatch(/import\s*\{[^}]*\bparsePeso\b[^}]*\}\s*from\s*"@\/lib\/peso"/);
  });
});

describe("anotarPeso", () => {
  it("escribe con bodyweightLogs.add y no con put/update", () => {
    const fuente = leer("src/lib/db/queries.ts");
    const inicio = fuente.indexOf("export async function anotarPeso");
    expect(inicio).toBeGreaterThan(-1);
    const resto = fuente.slice(inicio);
    const fin = resto.indexOf("\n}\n");
    const cuerpo = resto.slice(0, fin);
    expect(cuerpo).toMatch(/bodyweightLogs\.add\(/);
    expect(cuerpo).not.toMatch(/\.put\(/);
    expect(cuerpo).not.toMatch(/\.update\(/);
  });
});
