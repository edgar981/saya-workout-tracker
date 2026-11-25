import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Texto de los archivos, sin importar nada de la app (DECISIONES §15).
const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");

const sql = leer("prisma/migrations/2_dinero_tiempo/migration.sql");
const esquema = leer("prisma/schema.prisma");
const sw = leer("public/sw.js");

const NUEVAS = [
  "Cuenta",
  "SaldoCuenta",
  "Deuda",
  "SaldoDeuda",
  "Extracto",
  "Tema",
  "RegistroTiempo",
];
const AJENAS = [
  "Snapshot",
  "User",
  "Session",
  "Account",
  "Verification",
  "Passkey",
  "RateLimit",
];

const sentencias = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

describe("migración 2_dinero_tiempo", () => {
  it("sólo crea: tablas, índices y llaves foráneas con ON DELETE RESTRICT", () => {
    expect(sentencias.length).toBeGreaterThan(0);
    for (const s of sentencias) {
      expect(s).toMatch(/^(CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ALTER TABLE)\b/);
      if (s.startsWith("ALTER TABLE")) {
        expect(s).toContain("ADD CONSTRAINT");
        expect(s).toContain("FOREIGN KEY");
        expect(s).toContain("ON DELETE RESTRICT");
      }
    }
  });

  it("no borra, no renombra, no actualiza y no crea tipos", () => {
    for (const s of sentencias) {
      // «ON DELETE RESTRICT» es la regla de la llave foránea, no un DELETE.
      const sinRegla = s.replace(/ON DELETE RESTRICT/g, "");
      expect(sinRegla).not.toMatch(/\bDROP\b/);
      expect(sinRegla).not.toMatch(/\bTRUNCATE\b/);
      expect(sinRegla).not.toMatch(/\bDELETE\b/);
      expect(sinRegla).not.toContain('UPDATE "');
      expect(sinRegla).not.toMatch(/\bRENAME\b/);
      expect(sinRegla).not.toContain("CREATE TYPE");
    }
  });

  it("sólo nombra las siete tablas nuevas y crea las siete", () => {
    const nombradas: string[] = [];
    for (const s of sentencias) {
      for (const re of [
        /CREATE TABLE "([^"]+)"/g,
        /\bON "([^"]+)"/g,
        /ALTER TABLE "([^"]+)"/g,
        /REFERENCES "([^"]+)"/g,
      ]) {
        for (const m of s.matchAll(re)) nombradas.push(m[1]);
      }
    }
    expect(nombradas.length).toBeGreaterThan(0);
    for (const n of nombradas) expect(NUEVAS).toContain(n);

    const creadas = sentencias
      .map((s) => /^CREATE TABLE "([^"]+)"/.exec(s)?.[1])
      .filter((n): n is string => Boolean(n));
    expect([...creadas].sort()).toEqual([...NUEVAS].sort());
  });

  it("ninguna sentencia toca Snapshot ni las tablas de las cuentas", () => {
    for (const s of sentencias) {
      for (const ajena of AJENAS) expect(s).not.toContain(`"${ajena}"`);
    }
  });
});

describe("schema.prisma", () => {
  it("declara los siete modelos de Dinero y Tiempo y ningún enum", () => {
    for (const n of NUEVAS) {
      expect(esquema).toMatch(new RegExp(`^model ${n} \\{`, "m"));
    }
    expect(esquema).not.toMatch(/^enum\s/m);
  });
});

describe("service worker", () => {
  it("sube el cache a v7 y mete /dinero y /tiempo al shell junto a las nueve de antes", () => {
    expect(sw).toContain('const CACHE = "saya-shell-v7"');
    const bloque = /const APP_SHELL = \[([\s\S]*?)\];/.exec(sw)?.[1] ?? "";
    const entradas = [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    for (const e of [
      "/",
      "/sesion",
      "/sesion/cerrar",
      "/datos",
      "/plantillas",
      "/catalogo",
      "/historial",
      "/progreso",
      "/manifest.webmanifest",
      "/dinero",
      "/tiempo",
    ]) {
      expect(entradas).toContain(e);
    }
    expect(entradas).toHaveLength(11);
  });
});
