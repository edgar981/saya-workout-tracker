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

  it("el shell la monta una vez", () => {
    const shell = leer("src/components/app-shell.tsx");
    expect(shell).toContain('import { HojaAgente } from "@/components/agente/hoja";');
    expect(shell.match(/<HojaAgente \/>/g)).toHaveLength(1);
  });
});
