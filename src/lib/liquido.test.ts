import { describe, expect, it } from "vitest";

import {
  CUADRO_REDUCIDO,
  FS,
  VS,
  avanceTiempo,
  crearContadorPaneles,
  debeDibujar,
  esRutaSesion,
  tamanoRender,
  topeFps,
} from "./liquido";

describe("tamanoRender", () => {
  it("375 × 709 CSS a DPR 2 da 375 × 709", () => {
    expect(tamanoRender(375, 709, 2)).toEqual({ ancho: 375, alto: 709 });
  });
  it("a DPR 3 el factor es el mismo (tope de DPR 2)", () => {
    expect(tamanoRender(375, 709, 3)).toEqual({ ancho: 375, alto: 709 });
  });
  it("a DPR 1 es la mitad", () => {
    expect(tamanoRender(375, 709, 1)).toEqual({ ancho: 188, alto: 355 });
  });
  it("mínimo de 2 px por lado", () => {
    expect(tamanoRender(0, 0, 2)).toEqual({ ancho: 2, alto: 2 });
    expect(tamanoRender(1, 3, 1)).toEqual({ ancho: 2, alto: 2 });
  });
});

describe("topeFps", () => {
  it("30 en las rutas normales", () => {
    expect(topeFps("/")).toBe(30);
    expect(topeFps("/ajustes")).toBe(30);
    expect(topeFps("/historial/abc")).toBe(30);
  });
  it("20 en /sesion y /sesion/cerrar, con o sin barra final", () => {
    expect(topeFps("/sesion")).toBe(20);
    expect(topeFps("/sesion/")).toBe(20);
    expect(topeFps("/sesion/cerrar")).toBe(20);
    expect(topeFps("/sesion/cerrar/")).toBe(20);
  });
  it("no confunde otra ruta que empiece igual", () => {
    expect(esRutaSesion("/sesiones")).toBe(false);
    expect(topeFps("/sesion/otra")).toBe(30);
  });
});

describe("debeDibujar", () => {
  it("a 30 fps el intervalo es 1000/30 − 2 ms", () => {
    const umbral = 1000 / 30 - 2;
    expect(debeDibujar(100 + umbral, 100, 30)).toBe(true);
    expect(debeDibujar(100 + umbral - 0.01, 100, 30)).toBe(false);
  });
  it("a 20 fps el intervalo es 48 ms", () => {
    expect(debeDibujar(148, 100, 20)).toBe(true);
    expect(debeDibujar(147.9, 100, 20)).toBe(false);
  });
  it("el primer cuadro siempre se dibuja", () => {
    expect(debeDibujar(0, -Infinity, 30)).toBe(true);
  });
});

describe("avanceTiempo", () => {
  it("avanza con dt hasta 100 ms y no más", () => {
    expect(avanceTiempo(16)).toBe(16);
    expect(avanceTiempo(100)).toBe(100);
    expect(avanceTiempo(60_000)).toBe(100);
  });
  it("un dt negativo no retrocede", () => {
    expect(avanceTiempo(-5)).toBe(0);
  });
});

describe("cuadro de movimiento reducido", () => {
  it("T = 5 y S = 0", () => {
    expect(CUADRO_REDUCIDO).toEqual({ T: 5, S: 0 });
  });
});

describe("contador de paneles", () => {
  it("abre, abre, cierra, cierra: solo reanuda al último cierre", () => {
    const c = crearContadorPaneles();
    expect(c.hold()).toBe(false);
    c.abrir();
    c.abrir();
    expect(c.cuenta()).toBe(2);
    expect(c.hold()).toBe(true);
    c.cerrar();
    expect(c.cuenta()).toBe(1);
    expect(c.hold()).toBe(true);
    c.cerrar();
    expect(c.cuenta()).toBe(0);
    expect(c.hold()).toBe(false);
  });
  it("un cierre de más no queda negativo", () => {
    const c = crearContadorPaneles();
    c.cerrar();
    expect(c.cuenta()).toBe(0);
    c.abrir();
    expect(c.cuenta()).toBe(1);
  });
  it("avisa a quien se suscribe, y deja de avisar al darse de baja", () => {
    const c = crearContadorPaneles();
    let avisos = 0;
    const baja = c.suscribir(() => {
      avisos += 1;
    });
    c.abrir();
    c.cerrar();
    expect(avisos).toBe(2);
    baja();
    c.abrir();
    expect(avisos).toBe(2);
  });
});

describe("texto del shader", () => {
  it("FS declara los tres uniformes R, T y S", () => {
    expect(FS).toMatch(/uniform vec2 R;/);
    expect(FS).toMatch(/uniform float T;/);
    expect(FS).toMatch(/uniform float S;/);
  });
  it("VS declara el atributo p", () => {
    expect(VS).toMatch(/attribute vec2 p;/);
  });
});
