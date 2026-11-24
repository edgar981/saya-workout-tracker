import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// La ruta importa server-auth.ts (→ server-only, no instalado): se lee su texto.
const ruta = readFileSync(join(process.cwd(), "src/app/api/agente/route.ts"), "utf8");
const entorno = readFileSync(join(process.cwd(), ".env.example"), "utf8");
const dir = join(process.cwd(), "src/lib/agente");
const modulos = readdirSync(dir)
  .filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))
  .map((n) => [n, readFileSync(join(dir, n), "utf8")] as const);

describe("route.ts del agente", () => {
  it("runtime nodejs y force-dynamic", () => {
    expect(ruta).toContain('runtime = "nodejs"');
    expect(ruta).toContain('"force-dynamic"');
  });
  it("la sesión va primero", () => {
    const sesion = ruta.indexOf("comprobarAcceso(");
    expect(sesion).toBeGreaterThan(-1);
    for (const despues of ["req.text(", "ANTHROPIC_API_KEY", "atenderPedido("]) {
      expect(ruta.indexOf(despues)).toBeGreaterThan(sesion);
    }
  });
  it("401 «Sin sesión.»", () => {
    expect(ruta).toContain('"Sin sesión."');
    expect(ruta).toContain("status: 401");
  });
  it("sin console, sin NEXT_PUBLIC_, sólo POST", () => {
    expect(ruta).not.toContain("console.");
    expect(ruta).not.toContain("NEXT_PUBLIC_");
    expect(ruta).not.toMatch(/export\s+(async\s+)?function\s+GET\b/);
    expect(ruta).not.toMatch(/export\s+const\s+GET\b/);
  });
});

describe(".env.example", () => {
  it("tiene la llave del servidor, nunca con NEXT_PUBLIC_", () => {
    expect(entorno).toContain("ANTHROPIC_API_KEY=");
    expect(entorno.split("\n").some((l) => l.includes("NEXT_PUBLIC_ANTHROPIC"))).toBe(false);
  });
});

describe("src/lib/agente/ es puro", () => {
  it.each(["server-only", "process.env", "console."])("sin %s", (prohibido) => {
    for (const [nombre, texto] of modulos) {
      expect(texto.includes(prohibido), `${nombre} contiene ${prohibido}`).toBe(false);
    }
  });
});
