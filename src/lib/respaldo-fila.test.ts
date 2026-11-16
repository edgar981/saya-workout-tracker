import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * La fila de «Respaldar ahora» + «Restaurar del servidor» nunca se sale de la
 * caja: el `Button` es `whitespace-nowrap` y los dos juntos piden ~394 px, más
 * que la caja a ancho de teléfono. Test de fuente (vitest corre en `node`, sin
 * DOM): lee el panel como texto y afirma que el contenedor de los dos botones
 * puede acomodarlos (`flex-wrap`) y que cada botón crece sobre su base natural
 * (`flex-auto`) para llenar la línea cuando se apilan.
 */
const raiz = join(__dirname, "..", "..");
const panel = readFileSync(join(raiz, "src/components/backup-panel.tsx"), "utf8");

/** Clases del contenedor `<div className="…">` cuyo primer hijo es el botón «Respaldar ahora». */
function claseDeLaFila(): string {
  const icono = panel.indexOf("<CloudUpload />");
  expect(icono, "no se encontró el botón «Respaldar ahora»").toBeGreaterThan(-1);
  const boton = panel.lastIndexOf("<Button", icono);
  const div = panel.lastIndexOf("<div", boton);
  const m = panel.slice(div, boton).match(/^<div className="([^"]*)">\s*$/);
  expect(m, "el hijo anterior al botón no es el contenedor de la fila").not.toBeNull();
  return m![1];
}

/** Las clases del `<Button …>` que contiene el texto dado. */
function claseDelBoton(texto: string): string {
  const i = panel.indexOf(texto);
  expect(i, `no está el texto «${texto}»`).toBeGreaterThan(-1);
  const apertura = panel.lastIndexOf("<Button", i);
  const m = panel.slice(apertura, i).match(/className="([^"]*)"/);
  expect(m, `el botón de «${texto}» no tiene className`).not.toBeNull();
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

  it("los dos botones crecen sobre su base natural (flex-auto)", () => {
    expect(claseDelBoton("Respaldar ahora").split(/\s+/)).toContain("flex-auto");
    expect(claseDelBoton("Restaurar del servidor").split(/\s+/)).toContain("flex-auto");
  });

  it("el texto de los dos botones sigue igual", () => {
    expect(panel).toContain("Respaldar ahora");
    expect(panel).toContain("Respaldando…");
    expect(panel).toContain("Restaurar del servidor");
  });

  it("los botones conservan variante y tamaño", () => {
    const abre = (texto: string) =>
      panel.slice(panel.lastIndexOf("<Button", panel.indexOf(texto)), panel.indexOf(texto));
    expect(abre("Respaldar ahora")).toContain('variant="outline" size="sm"');
    expect(abre("Restaurar del servidor")).toContain('variant="ghost" size="sm"');
  });
});
