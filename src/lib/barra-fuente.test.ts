import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * SAYA-R2-2: lo que no se puede importar (CSS, componentes) se lee como texto:
 * vitest corre en `node`, sin DOM.
 */
const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

describe("SAYA-R2-2 · fuente", () => {
  const css = leer("src/app/globals.css");

  it("globals.css ya no trae la navegación de arriba y trae la barra de abajo", () => {
    expect(css).not.toContain(".tabs");
    expect(css).not.toContain(".tind");
    expect(css).not.toContain("@keyframes estira");
    for (const t of ["/* SAYA-R2-2", ".navg[data-oculta]", ".bbar", ".orbb", "--floatsh"]) {
      expect(css).toContain(t);
    }
  });

  it("la regla .navg no tiene opacity", () => {
    const m = /\n\.navg \{([^}]*)\}/.exec(css);
    expect(m).not.toBeNull();
    expect(m![1]).not.toContain("opacity");
  });

  it("nav-bar.tsx pinta una tablist de iconos con el orbe", () => {
    const src = leer("src/components/nav-bar.tsx");
    for (const t of ['role="tablist"', 'aria-label="Áreas"', 'role="tab"', "registrarBarra", "Orbe"]) {
      expect(src).toContain(t);
    }
    expect(src).not.toContain("{area.etiqueta}");
  });

  it("orbe.tsx", () => {
    const src = leer("src/components/agente/orbe.tsx");
    for (const t of ['aria-label="Pregúntale a tus datos"', "abrirAgente", 'className="liq"']) {
      expect(src).toContain(t);
    }
  });

  it("barra-estado.ts termina los resortes al cambiar la visibilidad", () => {
    const src = leer("src/components/barra-estado.ts");
    expect(src).toContain("visibilitychange");
    expect(src).toContain("terminarResortes");
  });

  it("barra.ts no importa react ni lee window", () => {
    const src = leer("src/lib/barra.ts");
    expect(src).not.toMatch(/from ["']react["']/);
    expect(src).not.toMatch(/\bwindow\b/);
  });
});
