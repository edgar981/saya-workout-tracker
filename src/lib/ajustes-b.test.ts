import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Los textos que SAYA-CROMO-5B puso como los dibuja el censo (SAYA-19 B). Test
 * de fuente: lee los archivos como texto.
 */
const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

describe("Ajustes B (SAYA-19)", () => {
  it("catalogo-screen agrupa y arma «Tocar de nuevo: archivar»", () => {
    const f = leer("src/components/screens/catalogo-screen.tsx");
    expect(f).toContain("Tocar de nuevo: archivar");
    expect(f).toContain("agruparPorGrupo");
  });

  it("cuenta-panel pinta los renglones de la cuenta como Fila", () => {
    const f = leer("src/components/cuenta-panel.tsx");
    expect(f).not.toContain("Sesión iniciada:");
    expect(f).not.toContain("Passkeys en esta cuenta:");
    expect(f).toContain("Sesión iniciada");
    expect(f).toContain("Passkeys en esta cuenta");
  });

  it("la ruta de Ajustes carga sin SSR con su esqueleto", () => {
    const f = leer("src/app/ajustes/page.tsx");
    expect(f).toContain("ssr: false");
    expect(f).toContain("AjustesSkeleton");
  });

  it("ajustes-screen lee el chip y el resumen del catálogo", () => {
    const f = leer("src/components/screens/ajustes-screen.tsx");
    expect(f).toContain("chipRespaldo");
    expect(f).toContain("resumenCatalogo");
  });

  it("backup-panel usa chipRespaldo y ya no trae los íconos", () => {
    const f = leer("src/components/backup-panel.tsx");
    expect(f).toContain("chipRespaldo(state)");
    expect(f).not.toContain("CloudUpload");
    expect(f).not.toContain("RotateCw");
  });
});
