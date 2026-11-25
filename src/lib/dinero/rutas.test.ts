import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Las rutas importan server-auth.ts (→ server-only, no instalado): se lee su texto.
const leer = (r: string) => readFileSync(join(process.cwd(), r), "utf8");

const RUTAS = [
  ["src/app/api/dinero/cuentas/route.ts", ["GET", "POST"]],
  ["src/app/api/dinero/deudas/route.ts", ["GET", "POST"]],
  ["src/app/api/dinero/saldos/route.ts", ["POST"]],
  ["src/app/api/dinero/extractos/route.ts", ["POST"]],
  ["src/app/api/dinero/exportar/route.ts", ["GET"]],
] as const;

/** El texto de cada función exportada, con su nombre, de su `export` al siguiente (o al final). */
function funciones(texto: string): { nombre: string; texto: string }[] {
  const inicios = [...texto.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => ({
    i: m.index!,
    nombre: m[1],
  }));
  return inicios.map((x, k) => ({
    nombre: x.nombre,
    texto: texto.slice(x.i, inicios[k + 1]?.i ?? texto.length),
  }));
}

describe.each(RUTAS)("%s", (archivo, metodos) => {
  const texto = leer(archivo);
  const cuerpos = funciones(texto);

  it("runtime nodejs y force-dynamic", () => {
    expect(texto).toContain('runtime = "nodejs"');
    expect(texto).toContain('dynamic = "force-dynamic"');
  });

  it("exporta sólo los métodos esperados", () => {
    expect(cuerpos.map((f) => f.nombre)).toEqual([...metodos]);
  });

  it("la sesión va antes de leer el cuerpo o tocar el almacén", () => {
    for (const f of cuerpos) {
      const sesion = f.texto.indexOf("comprobarAcceso(");
      expect(sesion, f.nombre).toBeGreaterThan(-1);
      for (const despues of ["req.json(", "req.text(", "almacen", "prisma."]) {
        const i = f.texto.indexOf(despues);
        if (i !== -1) expect(i, `${f.nombre}: ${despues} antes que comprobarAcceso`).toBeGreaterThan(sesion);
      }
    }
  });

  it("401 «Sin sesión.»", () => {
    for (const f of cuerpos) {
      expect(f.texto, f.nombre).toContain('"Sin sesión."');
      expect(f.texto, f.nombre).toContain("status: 401");
    }
  });

  it("sin console, sin NEXT_PUBLIC_", () => {
    expect(texto).not.toContain("console.");
    expect(texto).not.toContain("NEXT_PUBLIC_");
  });
});

describe("los POST", () => {
  const posts = RUTAS.flatMap(([a]) =>
    funciones(leer(a))
      .filter((f) => f.nombre === "POST")
      .map((f) => [a, f.texto] as const),
  );

  it("hay un POST por ruta que lo declara", () => {
    expect(posts).toHaveLength(4);
  });

  it.each(posts)("%s: el origen antes de leer el cuerpo, y el tope", (_archivo, f) => {
    const origen = f.indexOf("origenPermitido(");
    expect(origen).toBeGreaterThan(-1);
    expect(f.indexOf("req.text(")).toBeGreaterThan(origen);
    expect(f).toContain("status: 403");
    expect(f).toContain("status: 413");
    expect(f).toContain("MAX_CUERPO_DINERO_BYTES");
    expect(f.indexOf("content-length")).toBeLessThan(f.indexOf("req.text("));
  });
});

describe("el módulo puro y el adaptador", () => {
  it("servidor.ts no importa prisma, server-only ni next, ni escribe en consola", () => {
    const t = leer("src/lib/dinero/servidor.ts");
    for (const p of ["prisma", "server-only", "next/", "console.", "process.env"]) {
      expect(t.includes(p), p).toBe(false);
    }
  });
  it("almacen.ts no atrapa errores ni escribe en consola", () => {
    const t = leer("src/app/api/dinero/almacen.ts");
    expect(t).not.toContain("catch");
    expect(t).not.toContain("console.");
  });
  it("todo() lee los saldos y los extractos por anotado_en ascendente", () => {
    const t = leer("src/app/api/dinero/almacen.ts");
    const desde = t.indexOf("todo:");
    const hasta = t.indexOf("]);", t.indexOf("$transaction", desde));
    expect(desde).toBeGreaterThan(-1);
    expect(hasta).toBeGreaterThan(desde);
    const cuerpo = t.slice(desde, hasta);
    for (const modelo of ["saldoCuenta", "saldoDeuda", "extracto"]) {
      const linea = cuerpo.split("\n").filter((l) => l.includes(`prisma.${modelo}.findMany`));
      expect(linea.length, modelo).toBe(1);
      expect(linea[0], modelo).toContain('orderBy: { anotado_en: "asc" }');
    }
  });
});
