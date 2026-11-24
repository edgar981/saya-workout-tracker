import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELO_POR_DEFECTO, modeloDe } from "./modelo";

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.(ts|tsx|js|jsx|css)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("modeloDe", () => {
  it("sin variable o sólo espacios, el valor por defecto", () => {
    expect(modeloDe({})).toBe(MODELO_POR_DEFECTO);
    expect(modeloDe({ ANTHROPIC_MODEL: "  " })).toBe(MODELO_POR_DEFECTO);
    expect(modeloDe({ ANTHROPIC_MODEL: undefined })).toBe(MODELO_POR_DEFECTO);
  });
  it("recorta el valor de la variable", () => {
    expect(modeloDe({ ANTHROPIC_MODEL: " claude-sonnet-9 " })).toBe("claude-sonnet-9");
  });
  it("el valor por defecto es de la familia sonnet y no termina en una fecha", () => {
    expect(MODELO_POR_DEFECTO.startsWith("claude-sonnet-")).toBe(true);
    expect(MODELO_POR_DEFECTO).not.toMatch(/\d{8}$/);
  });
  it("sólo modelo.ts nombra un modelo en src/", () => {
    const raiz = join(process.cwd(), "src");
    const con = archivos(raiz)
      .filter((f) => readFileSync(f, "utf8").includes('"claude-'))
      .map((f) => relative(process.cwd(), f).split("\\").join("/"));
    expect(con).toEqual(["src/lib/agente/modelo.ts"]);
  });
});
