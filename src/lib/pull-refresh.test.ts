import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** SAYA-R2-7: el CSS se prueba por su texto fuente (vitest corre en `node`, sin DOM). */
const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

/** El cuerpo de la primera regla `selector {` dentro de `@layer base`. */
function regla(selector: string): string {
  const capa = css.indexOf("@layer base");
  expect(capa).toBeGreaterThan(-1);
  const ini = css.indexOf(`\n  ${selector} {`, capa);
  expect(ini).toBeGreaterThan(-1);
  return css.slice(ini, css.indexOf("}", ini));
}

/** El cuerpo de una regla de nivel raíz `selector {`. */
function reglaRaiz(selector: string): string {
  const ini = css.indexOf(`\n${selector} {`);
  expect(ini).toBeGreaterThan(-1);
  return css.slice(ini, css.indexOf("}", ini));
}

describe("pull-to-refresh del navegador", () => {
  it("html lleva overscroll-behavior-y: none", () => {
    expect(regla("html")).toContain("overscroll-behavior-y: none");
  });
  it("body conserva overscroll-behavior-y: contain", () => {
    expect(regla("body")).toContain("overscroll-behavior-y: contain");
  });
  it("ni html ni body llevan touch-action", () => {
    expect(regla("html")).not.toContain("touch-action");
    expect(regla("body")).not.toContain("touch-action");
  });
  it(".grip y .dia-hoja .grab siguen con touch-action: none", () => {
    expect(reglaRaiz(".grip")).toContain("touch-action: none");
    expect(reglaRaiz(".dia-hoja .grab")).toContain("touch-action: none");
  });
});
