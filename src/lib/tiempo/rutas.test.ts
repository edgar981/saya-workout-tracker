import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Las rutas importan server-auth.ts (→ server-only, no instalado): se lee su texto.
const leer = (r: string) => readFileSync(join(process.cwd(), r), "utf8");

const RUTAS = [
  ["src/app/api/tiempo/route.ts", ["GET"]],
  ["src/app/api/tiempo/temas/route.ts", ["POST"]],
  ["src/app/api/tiempo/registros/route.ts", ["POST"]],
] as const;

/** El texto de cada función exportada, de su `export` al siguiente (o al final). */
function funciones(texto: string): string[] {
  const inicios = [...texto.matchAll(/export\s+async\s+function\s+\w+/g)].map((m) => m.index!);
  return inicios.map((i, k) => texto.slice(i, inicios[k + 1] ?? texto.length));
}

describe.each(RUTAS)("%s", (archivo, metodos) => {
  const texto = leer(archivo);
  const cuerpos = funciones(texto);

  it("runtime nodejs y force-dynamic", () => {
    expect(texto).toContain('runtime = "nodejs"');
    expect(texto).toContain('dynamic = "force-dynamic"');
  });

  it("exporta sólo los métodos esperados", () => {
    const nombres = [...texto.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
    expect(nombres).toEqual([...metodos]);
  });

  it("la sesión va antes de leer el cuerpo, la query o tocar el almacén", () => {
    for (const f of cuerpos) {
      const sesion = f.indexOf("comprobarAcceso(");
      expect(sesion).toBeGreaterThan(-1);
      for (const despues of ["req.json(", "req.text(", "searchParams", "almacen", "prisma."]) {
        const i = f.indexOf(despues);
        if (i !== -1) expect(i, `${despues} antes que comprobarAcceso`).toBeGreaterThan(sesion);
      }
    }
  });

  it("401 «Sin sesión.»", () => {
    for (const f of cuerpos) {
      expect(f).toContain('"Sin sesión."');
      expect(f).toContain("status: 401");
    }
  });

  it("sin console, sin NEXT_PUBLIC_", () => {
    expect(texto).not.toContain("console.");
    expect(texto).not.toContain("NEXT_PUBLIC_");
  });
});

describe("los POST", () => {
  it.each(RUTAS.filter(([, m]) => m[0] === "POST").map(([a]) => a))(
    "%s: el origen antes de leer el cuerpo, y el tope",
    (archivo) => {
      for (const f of funciones(leer(archivo))) {
        const origen = f.indexOf("origenPermitido(");
        expect(origen).toBeGreaterThan(-1);
        expect(f.indexOf("req.text(")).toBeGreaterThan(origen);
        expect(f).toContain("status: 403");
        expect(f).toContain("status: 413");
        expect(f).toContain("MAX_CUERPO_TIEMPO_BYTES");
        expect(f.indexOf("content-length")).toBeLessThan(f.indexOf("req.text("));
      }
    },
  );
});

describe("el módulo puro y el adaptador", () => {
  it("servidor.ts no importa prisma, server-only ni next, ni escribe en consola", () => {
    const t = leer("src/lib/tiempo/servidor.ts");
    for (const p of ["prisma", "server-only", "next/", "console.", "process.env"]) {
      expect(t.includes(p), p).toBe(false);
    }
  });
  it("almacen.ts no atrapa errores ni escribe en consola", () => {
    const t = leer("src/app/api/tiempo/almacen.ts");
    expect(t).not.toContain("catch");
    expect(t).not.toContain("console.");
  });
});
