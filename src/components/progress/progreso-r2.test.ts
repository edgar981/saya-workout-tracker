import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fechaCorta } from "./estado";

/**
 * Progreso «Semanas» de la ronda 2 (SAYA-R2-5). Test de fuente (vitest corre en
 * `node`, sin DOM): lee los componentes como texto, igual que `cromo-7.test.ts`.
 */
const raiz = join(__dirname, "..", "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

const pantalla = leer("src/components/screens/progreso-screen.tsx");
const grafico = leer("src/components/progress/balance-chart.tsx");
const volumen = leer("src/components/progress/volumen-card.tsx");
const lecturas = leer("src/components/progress/semanas-dias.ts");
const css = leer("src/app/globals.css");

describe("SAYA-R2-5: Progreso", () => {
  it("la pantalla", () => {
    for (const t of [
      "Balance por semana",
      "Estados",
      "Volumen por grupo",
      "series / semana",
      "Sin sesiones cerradas",
      "No se pudo calcular tu progreso.",
      'className="pro',
    ]) {
      expect(pantalla).toContain(t);
    }
    for (const t of ["mejor − peor", "Toca un estado", "El balance, los estados y el volumen salen", "Ir a Hoy", "ProgresoSkeleton"]) {
      expect(pantalla).not.toContain(t);
    }
  });

  it("el gráfico se recorre", () => {
    for (const t of ['role="slider"', "ArrowLeft", "ArrowRight", "prefers-reduced-motion"]) {
      expect(grafico).toContain(t);
    }
  });

  it("el volumen", () => {
    expect(volumen).toContain("Directas");
    expect(volumen).toContain("Indirectas ½");
    for (const t of ["Promedio de", "Asignar en el catálogo", "no cuentan", "Todavía no hay una semana", "TiraSemanas"]) {
      expect(volumen).not.toContain(t);
    }
  });

  it("las lecturas sólo leen", () => {
    for (const t of [".add(", ".put(", ".update(", ".delete(", ".bulk"]) {
      expect(lecturas).not.toContain(t);
    }
  });

  it("el bloque de CSS", () => {
    expect(css).toContain("/* SAYA-R2-5");
  });

  it("SAYA-R2-5.W: fechaCorta con meses de tres letras", () => {
    expect(fechaCorta("2026-09-15")).toBe("15 sep");
    expect(fechaCorta("2026-11-03")).toBe("3 nov");
    expect(fechaCorta("2026-01-01")).toBe("1 ene");
  });

  it("SAYA-R2-5.W: los cinco arreglos, en el texto fuente", () => {
    const cargando = leer("src/components/progress/progreso-cargando.tsx");
    for (const f of [pantalla, cargando]) {
      expect(f).not.toContain("empujada");
      expect(f).not.toContain(" p-4");
    }
    const ultima = leer("src/components/session/last-performance.tsx");
    expect(ultima).toContain("fechaCorta");
    expect(ultima).not.toContain("toLocaleDateString");
    const nav = leer("src/components/nav-bar.tsx");
    expect(nav).toContain("M14.5 5.5L8 12l6.5 6.5");
    expect(nav).not.toContain("‹");
    expect(grafico).toContain("fis.current.raf");
    expect(pantalla).toContain("disabled={vacio || t.cuenta === 0}");
  });
});
