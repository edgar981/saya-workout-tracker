import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** SAYA-R2-3.W: los siete arreglos del revisor (texto fuente; vitest corre en node). */
const raiz = join(__dirname, "..", "..");
const leer = (ruta: string) => readFileSync(join(raiz, ruta), "utf8");
const home = leer("src/components/screens/home-screen.tsx");
const nav = leer("src/components/nav-bar.tsx");
const orbe = leer("src/components/agente/orbe.tsx");
const shell = leer("src/components/app-shell.tsx");
const css = leer("src/app/globals.css");
const tarjeta = leer("src/components/session/exercise-card.tsx");

describe("SAYA-R2-3.W · arreglos", () => {
  it("un segundo dedo no suelta el arrastre de la hoja", () => {
    const ini = home.indexOf("const alEmpezarToque");
    const fin = home.indexOf("toque = {", ini);
    expect(ini).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(ini);
    expect(home.slice(ini, fin)).not.toContain("toque = null");
  });

  it("la flecha en el borde de la barra no hace nada", () => {
    const ini = nav.indexOf("function alTeclado");
    const cuerpo = nav.slice(ini, nav.indexOf("function alBajar", ini));
    const salida = cuerpo.indexOf("i === activo");
    expect(salida).toBeGreaterThan(-1);
    expect(salida).toBeLessThan(cuerpo.indexOf("tocar(i)"));
  });

  it("el orbe es cliente", () => {
    expect(orbe.startsWith('"use client";')).toBe(true);
  });

  it("el fundido de área también quita el atributo al limpiar", () => {
    expect(shell.split('removeAttribute("data-entra")').length - 1).toBeGreaterThanOrEqual(3);
  });

  it("no queda .wnote", () => {
    expect(css).not.toContain(".wnote");
  });

  it("la cabeza va a 8 px de relleno propio", () => {
    const m = css.match(/\.cabeza \{[^}]*\}/);
    expect(m).not.toBeNull();
    expect(m![0]).toContain("padding: 82px 8px 0");
  });

  it("escribir no corre dos veces a la vez", () => {
    const ini = tarjeta.indexOf("const escribir = async");
    const cuerpo = tarjeta.slice(ini, tarjeta.indexOf("const confirmar", ini));
    const guarda = cuerpo.indexOf("escribiendo.current");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(cuerpo.indexOf("await"));
    expect(cuerpo).toMatch(/finally \{\s*escribiendo\.current = false;/);
  });
});
