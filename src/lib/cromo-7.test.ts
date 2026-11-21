import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Dos contenedores de Sesión con nombre para lectores de pantalla (SAYA-CROMO-7):
 * la barra de abajo y el grupo del ejercicio en «Cambiar». Test de fuente
 * (vitest corre en `node`, sin DOM): lee los dos componentes como texto.
 */
const raiz = join(__dirname, "..", "..");
const pantalla = readFileSync(join(raiz, "src/components/screens/session-screen.tsx"), "utf8");
const panel = readFileSync(join(raiz, "src/components/session/substitute-picker.tsx"), "utf8");

/** Cada aparición de `marca` va seguida de `aria-label=` antes del `>` que cierra la etiqueta. */
function todoConNombre(texto: string, marca: string): void {
  let desde = 0;
  let n = 0;
  for (;;) {
    const i = texto.indexOf(marca, desde);
    if (i === -1) break;
    n += 1;
    const resto = texto.slice(i);
    const cierre = resto.indexOf(">");
    expect(resto.slice(0, cierre), `${marca} sin aria-label`).toContain("aria-label=");
    desde = i + marca.length;
  }
  expect(n, `no hay ${marca}`).toBeGreaterThan(0);
}

describe("SAYA-CROMO-7: nombres para lectores de pantalla", () => {
  it("la barra de abajo de Sesión se llama Sesión", () => {
    expect(pantalla).toContain('<nav aria-label="Sesión" className="sbot">');
  });

  it("todo nav de Sesión tiene nombre", () => {
    todoConNombre(pantalla, "<nav");
  });

  it("el grupo del ejercicio en Cambiar tiene nombre", () => {
    expect(panel).toContain('role="radiogroup" aria-label="Ejercicio en esta sesión"');
  });

  it("todo radiogroup de Cambiar tiene nombre", () => {
    todoConNombre(panel, 'role="radiogroup"');
  });
});
