import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** SAYA-R2-3: lo que Hoy y su hoja ya no dicen y lo que sí llevan (texto fuente; vitest corre en node). */
const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");
const home = leer("src/components/screens/home-screen.tsx");
const dia = leer("src/components/day-preview-sheet.tsx");
const css = leer("src/app/globals.css");

describe("SAYA-R2-3 · fuentes", () => {
  it("Hoy y la hoja del día no conservan lo viejo", () => {
    for (const [nombre, fuente] of [
      ["home-screen.tsx", home],
      ["day-preview-sheet.tsx", dia],
    ] as const) {
      for (const malo of [
        "Tus áreas",
        "Lo último que anotaste",
        "Sin sesiones",
        "Nunca has hecho este día",
        "Empezar este día la cierra",
        "requestAnimationFrame",
        "toLocaleDateString",
      ]) {
        expect(fuente.includes(malo), `${nombre} contiene «${malo}»`).toBe(false);
      }
    }
  });

  it("home-screen.tsx conduce la barra y pinta la rejilla", () => {
    for (const bien of [
      "empezarConducir",
      "conducirBarra",
      "soltarBarra",
      "arribaBarraLlena",
      "conduciendo",
      "Bajar la hoja",
      "Subir la hoja",
      "data-tirable",
      'className="bento"',
    ]) {
      expect(home.includes(bien), `home-screen.tsx no contiene «${bien}»`).toBe(true);
    }
  });

  it("day-preview-sheet.tsx", () => {
    for (const bien of ["ref={panelRef}", "bg-panel-solido", "crearResorte", "textoBotonDia"]) {
      expect(dia.includes(bien), `day-preview-sheet.tsx no contiene «${bien}»`).toBe(true);
    }
  });

  it("globals.css lleva el bloque y no vuelve a declarar .pane ni .toast", () => {
    const i = css.indexOf("/* SAYA-R2-3");
    expect(i).toBeGreaterThan(-1);
    const bloque = css.slice(i);
    for (const bien of [".bento", ".grip", ".hoja[data-tirable]::after", ".dstrip"]) {
      expect(bloque.includes(bien), `falta ${bien}`).toBe(true);
    }
    expect(/\.pane\s*\{/.test(bloque)).toBe(false);
    expect(/\.toast\s*\{/.test(bloque)).toBe(false);
  });
});
