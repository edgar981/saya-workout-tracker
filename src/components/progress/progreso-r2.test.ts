import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
});
