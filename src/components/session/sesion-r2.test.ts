import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Sesión de la ronda 2 (SAYA-R2-4). Test de fuente (vitest corre en `node`, sin
 * DOM): lee los componentes como texto, igual que `cromo-7.test.ts`.
 */
const raiz = join(__dirname, "..", "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

const pantalla = leer("src/components/screens/session-screen.tsx");
const tarjeta = leer("src/components/session/exercise-card.tsx");
const sustituir = leer("src/components/session/substitute-picker.tsx");
const pasada = leer("src/components/session/last-performance.tsx");
const css = leer("src/app/globals.css");
const dialTsx = leer("src/components/session/serie-dial.tsx");

describe("SAYA-R2-4: la pantalla", () => {
  it("la tira de abajo, las fichas y las hojas", () => {
    expect(pantalla).toContain('<nav aria-label="Sesión" className="sbot">');
    expect(pantalla).toContain('role="tablist"');
    expect(pantalla).toContain("Agregar ejercicio del catálogo");
    expect(pantalla).toContain("Cambiar");
    expect(pantalla).toContain('href="/sesion/cerrar"');
  });

  it("ya no trae las flechas ni el párrafo de «Solo del catálogo»", () => {
    expect(pantalla).not.toContain("Solo del catálogo");
    expect(pantalla).not.toContain('aria-label="Ejercicio anterior"');
    expect(pantalla).not.toContain('aria-label="Ejercicio siguiente"');
    expect(pantalla).not.toContain('className="arw"');
  });

  it("usa su propio esqueleto de carga", () => {
    expect(pantalla).toContain("SesionCargando");
    expect(pantalla).not.toContain("SessionSkeleton");
  });
});

describe("SAYA-R2-4: la tarjeta", () => {
  it("no trae lo del flujo viejo", () => {
    for (const viejo of [
      "Nueva serie",
      "+ Extra",
      "La unidad cambió",
      "Sin series todavía",
      "Sigue en pantalla",
      "Tocar de nuevo",
    ]) {
      expect(tarjeta, viejo).not.toContain(viejo);
    }
  });

  it("trae «Anotar serie» y «Quitar de la sesión»", () => {
    expect(tarjeta).toContain("Anotar serie");
    expect(tarjeta).toContain("Quitar de la sesión");
  });

  it("«Quitar» se arma por 4000 ms", () => {
    expect(tarjeta).toContain("const ARMED_MS = 4000");
  });
});

describe("SAYA-R2-4: Cambiar y La pasada", () => {
  it("substitute-picker no trae los textos viejos", () => {
    expect(sustituir).not.toContain("Solo en esta sesión");
    expect(sustituir).not.toContain("no tiene alternativas");
  });

  it("last-performance no pinta «sin registro previo»", () => {
    expect(pasada).not.toContain("Sin registro previo");
  });
});

describe("SAYA-R2-4.W: los tres arreglos", () => {
  it("Sesión va sin hoja de vidrio", () => {
    expect(pantalla).not.toContain("marginTop: 12");
    const main = pantalla.match(/<main className="([^"]*)"/);
    expect(main).not.toBeNull();
    expect(main![1]).not.toContain("pt-4");
    expect(pantalla).toContain('"--ventana": "58px"');
    expect(css).toMatch(
      /\.ses > \.hoja\[data-propia\]::before,\s*\.ses > \.hoja\[data-propia\]::after\s*\{\s*display: none;/,
    );
  });

  it("el dial de peso pinta textoDial", () => {
    expect(dialTsx).toContain("textoDial(");
  });

  it("«Anotar serie» compara el set_index más alto de antes y de después de addSet", () => {
    expect(tarjeta).toContain("maxAntes");
    expect(tarjeta).toMatch(/primera\.max <= maxAntes/);
    expect(tarjeta.indexOf("maxAntes = ")).toBeLessThan(tarjeta.indexOf("await addSet("));
  });
});

describe("SAYA-R2-4: el CSS", () => {
  it("lleva su bloque", () => {
    expect(css).toContain("/* SAYA-R2-4");
  });
});
