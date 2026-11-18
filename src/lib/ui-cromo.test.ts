import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Arreglos de SAYA-CROMO-3.W. Los de clases se afirman sobre lo que el `Button`
 * entrega (`cn` fusiona como en el componente); los de texto leen la fuente
 * (vitest corre en `node`, sin DOM).
 */
const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

const clasesPx = (c: string) => c.split(/\s+/).filter((x) => /^px-/.test(x));

describe("enlace de texto (variante link)", () => {
  it("el enlace deja px-0 como único relleno horizontal, con y sin tamaño", () => {
    expect(clasesPx(cn(buttonVariants({ variant: "link" })))).toEqual(["px-0"]);
    expect(clasesPx(cn(buttonVariants({ variant: "link", size: "sm" })))).toEqual(["px-0"]);
  });

  it("el botón por defecto conserva px-[22px]", () => {
    expect(cn(buttonVariants({}))).toContain("px-[22px]");
  });
});

describe("campo grande", () => {
  const fuente = leer("src/components/ui/input.tsx");

  it("el <input> de Campo no lleva h-full y conserva self-stretch", () => {
    expect(fuente).not.toContain("h-full");
    expect(fuente).toContain('"self-stretch"');
  });
});

describe("textos para lectores de pantalla", () => {
  it("session-screen no trae los textos nuevos del spec y conserva el del tronco", () => {
    const f = leer("src/components/screens/session-screen.tsx");
    expect(f).not.toContain("Navegación de la sesión");
    expect(f).not.toContain("Buscar ejercicio");
    expect(f).toContain("Agregar ejercicio del catálogo");
  });

  it("substitute-picker no trae «Ejercicio de esta sesión»", () => {
    expect(leer("src/components/session/substitute-picker.tsx")).not.toContain(
      "Ejercicio de esta sesión",
    );
  });
});
