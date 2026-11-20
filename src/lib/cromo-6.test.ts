import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * SAYA-CROMO-6: el tronco igual a la maqueta en lo que ya traía distinto
 * (SAYA-20 A). Filas sueltas en Ajustes y Catálogo, sin chevron en las filas del
 * catálogo, enlaces de texto en 500 14px. Lo que no se puede importar
 * (pantallas, CSS) se lee como texto: vitest corre en `node`, sin DOM.
 */
const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

describe("SAYA-CROMO-6", () => {
  it("el enlace mide como .tl", () => {
    for (const size of [undefined, "sm"] as const) {
      const clase = cn(buttonVariants({ variant: "link", size }));
      const piezas = clase.split(/\s+/);
      expect(piezas).toContain("text-sm");
      expect(piezas).toContain("font-medium");
      expect(piezas).toContain("min-h-11");
      expect(piezas).not.toContain("font-semibold");
      expect(piezas).not.toContain("text-[15px]");
      expect(piezas).not.toContain("min-h-12");
    }
  });

  it("Ajustes y Catálogo sin caja en las filas", () => {
    expect(leer("src/components/screens/ajustes-screen.tsx")).not.toContain("rounded-[20px]");
    const catalogo = leer("src/components/screens/catalogo-screen.tsx");
    expect(catalogo.split("rounded-[20px]").length - 1).toBe(1);
  });

  it("las filas del catálogo no llevan chevron", () => {
    expect(leer("src/components/screens/catalogo-screen.tsx")).toContain("chevron={false}");
  });

  it("globals.css da a .tl 500 14px", () => {
    const css = leer("src/app/globals.css");
    const i = css.indexOf(".tl {");
    expect(i).toBeGreaterThan(-1);
    const regla = css.slice(i, css.indexOf("}", i));
    expect(regla).toContain("font-size: 14px");
    expect(regla).toContain("font-weight: 500");
  });
});
