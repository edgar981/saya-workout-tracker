import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * La fila de «Respaldar ahora» + «Restaurar del servidor» nunca se sale de la
 * caja (SAYA-12): el `Button` es `whitespace-nowrap` y los dos juntos piden más
 * que la caja a ancho de teléfono, así que la fila envuelve (`flex-wrap`) y no
 * se sale. Los botones son los del censo desde SAYA-19: «Respaldar ahora» en
 * cromo (`default`) y «Restaurar del servidor» como enlace de texto (`link`),
 * en su ancho natural. Test de fuente (vitest corre en `node`, sin DOM): lee el
 * panel como texto.
 */
const raiz = join(__dirname, "..", "..");
const panel = readFileSync(join(raiz, "src/components/backup-panel.tsx"), "utf8");

/** Clases del contenedor `<div className="…">` cuyo primer hijo es el botón «Respaldar ahora». */
function claseDeLaFila(): string {
  const texto = panel.indexOf("Respaldar ahora");
  expect(texto, "no se encontró el botón «Respaldar ahora»").toBeGreaterThan(-1);
  const boton = panel.lastIndexOf("<Button", texto);
  const div = panel.lastIndexOf("<div", boton);
  const m = panel.slice(div, boton).match(/^<div className="([^"]*)">\s*$/);
  expect(m, "el hijo anterior al botón no es el contenedor de la fila").not.toBeNull();
  return m![1];
}

describe("fila de botones del respaldo", () => {
  it("el contenedor puede acomodar a sus hijos (flex-wrap, flex-col o grid)", () => {
    const clases = claseDeLaFila().split(/\s+/);
    const acomoda =
      (clases.includes("flex") && clases.includes("flex-wrap")) ||
      clases.includes("flex-col") ||
      clases.includes("grid");
    expect(acomoda, `la fila es «${clases.join(" ")}» y no acomoda`).toBe(true);
  });

  it("el texto de los dos botones sigue igual", () => {
    expect(panel).toContain("Respaldar ahora");
    expect(panel).toContain("Respaldando…");
    expect(panel).toContain("Restaurar del servidor");
  });

  it("los botones son los del censo", () => {
    const abre = (texto: string) =>
      panel.slice(panel.lastIndexOf("<Button", panel.indexOf(texto)), panel.indexOf(texto));
    expect(abre("Respaldar ahora")).toContain('variant="default"');
    expect(abre("Restaurar del servidor")).toContain('variant="link"');
  });
});
