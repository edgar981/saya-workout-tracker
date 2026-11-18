import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Arreglos del revisor sobre SAYA-CROMO-4. Tests de fuente (vitest corre en
 * `node`, sin DOM): leen los archivos como texto.
 */
const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

describe("SAYA-CROMO-4.W", () => {
  it("el texto sin series va en la cabecera del detalle, no debajo", () => {
    const f = leer("src/components/screens/session-detail-screen.tsx");
    expect(f).not.toContain("l-s mt-2.5");
    expect(f).toContain("No realizado.");
    expect(f).toContain("Se empezó, sin series registradas.");
  });

  it("la leyenda de la línea de Ejercicio no depende de hayLinea", () => {
    const f = leer("src/components/screens/ejercicio-screen.tsx");
    expect(f).toContain("Cada punto: el promedio");
    expect(f).not.toMatch(/hayLinea\s*\?\s*"Cada punto: el promedio/);
  });

  it("«vs {fecha}» no lleva el separador « · »", () => {
    const f = leer("src/components/history/verdict-badge.tsx");
    expect(f).not.toContain("· vs");
  });
});
