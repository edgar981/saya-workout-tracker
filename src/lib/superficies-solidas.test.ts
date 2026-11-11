import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Las superficies que flotan sobre todo (la hoja del día, el panel, el aviso)
 * son SÓLIDAS: su fondo es un token opaco. Desde Cromo `--surface` es un velo
 * translúcido, pensado para tarjetas sobre la hoja esmerilada; en un cajón
 * flotante deja leer el contenido de atrás. Test de fuente (vitest corre en
 * `node`, sin DOM): lee el CSS y el componente como texto y no repite ningún
 * valor de color.
 */
const raiz = join(__dirname, "..", "..");
const css = readFileSync(join(raiz, "src/app/globals.css"), "utf8");
const hoja = readFileSync(join(raiz, "src/components/day-preview-sheet.tsx"), "utf8");

/** Cuerpo de la regla `.<clase> { … }` (la primera que aparezca). */
function regla(clase: string): string {
  const m = css.match(new RegExp(`\\.${clase}\\s*\\{([^}]*)\\}`));
  expect(m, `no hay regla .${clase} en globals.css`).not.toBeNull();
  return m![1];
}

/** El token `--x` que consume el `background` de la regla. */
function tokenDeFondo(clase: string): string {
  const m = regla(clase).match(/background:\s*var\((--[\w-]+)\)\s*;/);
  expect(m, `.${clase} debe tener background: var(--token)`).not.toBeNull();
  return m![1];
}

/** El valor con que `:root` declara el token. */
function valorEnRoot(token: string): string {
  const m = css.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, "m"));
  expect(m, `${token} no está declarado`).not.toBeNull();
  return m![1].trim();
}

/** Opaco = hex de 6 dígitos o rgb(...) de tres canales; nunca rgba/oklab/alfa. */
function esOpaco(valor: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(valor) || /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(valor);
}

/** La utilidad de Tailwind (`bg-<nombre>`) que `@theme inline` liga al token. */
function utilidadDe(token: string): string {
  const m = css.match(new RegExp(`--color-([\\w-]+):\\s*var\\(${token}\\)`));
  expect(m, `@theme inline no liga ningún --color-* a ${token}`).not.toBeNull();
  return `bg-${m![1]}`;
}

/** El className del contenedor de la hoja (el div con ref={panelRef}). */
function claseDeLaHoja(): string {
  const m = hoja.match(/ref=\{panelRef\}[\s\S]*?className="([^"]*)"/);
  expect(m, "no se encontró el contenedor de la hoja").not.toBeNull();
  return m![1];
}

describe("superficies sólidas", () => {
  const panel = tokenDeFondo("pane");
  const aviso = tokenDeFondo("toast");

  it(".pane y .toast consumen cada uno un token, y son distintos", () => {
    expect(panel).not.toBe(aviso);
  });

  it.each([
    ["panel", panel],
    ["aviso", aviso],
  ])("el token del %s existe y es opaco (alfa 1)", (_nombre, token) => {
    expect(esOpaco(valorEnRoot(token))).toBe(true);
  });

  it("ningún valor sólido está escrito dos veces en globals.css", () => {
    for (const token of [panel, aviso]) {
      const valor = valorEnRoot(token);
      const veces = css.split(valor).length - 1;
      expect(veces, `${valor} aparece ${veces} veces`).toBe(1);
    }
  });

  it("la hoja del día consume la utilidad del panel sólido", () => {
    expect(claseDeLaHoja().split(/\s+/)).toContain(utilidadDe(panel));
  });

  it("la hoja del día ya no usa un fondo translúcido ni desenfoque", () => {
    const clases = claseDeLaHoja().split(/\s+/);
    expect(clases).not.toContain("bg-surface");
    expect(clases).not.toContain("bg-card");
    expect(clases).not.toContain("bg-surface-2");
    expect(clases.some((c) => /backdrop/.test(c))).toBe(false);
  });
});
