import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * «Archivar» del Catálogo va en rojo siempre (spec de SAYA-CROMO-5, sección 7):
 * desarmado «Archivar», armado «Tocar de nuevo», con `className="danger"` fijo.
 * Test de fuente (vitest corre en `node`, sin DOM).
 */
const raiz = join(__dirname, "..", "..");
const catalogo = readFileSync(join(raiz, "src/components/screens/catalogo-screen.tsx"), "utf8");

describe("Catálogo: el botón «Archivar»", () => {
  it("no condiciona el rojo a que esté armado", () => {
    expect(catalogo).not.toContain('armed ? "danger"');
  });

  it("lleva className=\"danger\" fijo y conserva sus dos textos", () => {
    expect(catalogo).toContain('className="danger"');
    expect(catalogo).toContain("Archivar");
    expect(catalogo).toContain("Tocar de nuevo");
  });
});
