import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** SAYA-R2-6: la hoja se prueba por su texto fuente (vitest corre en `node`, sin DOM). */
const raiz = join(__dirname, "..", "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

describe("hoja del agente", () => {
  const hoja = leer("src/components/agente/hoja.tsx");

  it.each([
    "Pregúntale a tus datos",
    "Escribe una pregunta",
    '"Pregunta"',
    '"Preguntar"',
    "Pensando…",
    "Otra pregunta",
    "No se pudo responder.",
    "Reintentar",
    "No encuentro datos para eso.",
    "alAbrirAgente",
    "Gotas",
    '"/api/agente"',
    "navigator.onLine",
  ])("contiene %s", (s) => {
    expect(hoja).toContain(s);
  });

  it.each(["Sale de", "Tus datos no se tocaron", "BloqueError", "NEXT_PUBLIC_", "anthropic"])(
    "no contiene %s",
    (s) => {
      expect(hoja).not.toContain(s);
    },
  );

  it("la línea de fuente se quitó", () => {
    expect(hoja).not.toContain(".fuente");
    expect(hoja).not.toContain("fila-s");
    expect(hoja).toContain("Otra pregunta");
  });

  it("no importa db.ts", () => {
    expect(hoja).not.toMatch(/from\s+["']@\/lib\/db\/db["']/);
  });

  it("las lecturas de Dexie no escriben", () => {
    const l = leer("src/lib/db/agente.ts");
    for (const s of [".put(", ".add(", ".update(", ".delete(", "bulk", '"rw"']) {
      expect(l).not.toContain(s);
    }
  });

  it("el CSS trae su bloque con movimiento reducido", () => {
    const css = leer("src/app/globals.css");
    const i = css.indexOf("/* SAYA-R2-6");
    expect(i).toBeGreaterThan(-1);
    expect(css.slice(i)).toContain("prefers-reduced-motion");
  });

  it("las reglas de la píldora van fuera de toda @layer, como las del orbe", () => {
    const css = leer("src/app/globals.css");
    const ini = css.indexOf("/* SAYA-R2-6.W: fuera de capa, como el orbe */");
    expect(ini).toBeGreaterThan(-1);
    let profundidad = 0;
    for (const c of css.slice(0, ini)) {
      if (c === "{") profundidad++;
      else if (c === "}") profundidad--;
    }
    expect(profundidad).toBe(0);
    const fin = css.indexOf(".ag-pensando .liq i:nth-child(4)", ini);
    expect(fin).toBeGreaterThan(ini);
    const bloque = css.slice(ini, fin);
    expect(bloque).not.toContain("@layer");
    expect(bloque).toContain("brightness(0.58)");
    expect(bloque).toContain("3.2s");
  });

  it("el shell la monta una vez", () => {
    const shell = leer("src/components/app-shell.tsx");
    expect(shell).toContain('import { HojaAgente } from "@/components/agente/hoja";');
    expect(shell.match(/<HojaAgente \/>/g)).toHaveLength(1);
  });
});
