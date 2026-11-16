import { describe, expect, it } from "vitest";

import {
  AREAS,
  accionAtras,
  etiquetaDeRuta,
  indiceDeArea,
  nivelDeRuta,
  siguientePila,
} from "./navegacion";

describe("áreas", () => {
  it("existen Hoy y Cuerpo, en ese orden", () => {
    expect(AREAS.map((a) => a.etiqueta)).toEqual(["Hoy", "Cuerpo"]);
    expect(indiceDeArea("/")).toBe(0);
    expect(indiceDeArea("/cuerpo/")).toBe(1);
    expect(indiceDeArea("/historial")).toBeNull();
  });
});

describe("nivelDeRuta", () => {
  const casos: [string, "area" | "sesion" | "empujada"][] = [
    ["/", "area"],
    ["/cuerpo", "area"],
    ["/sesion", "sesion"],
    ["/sesion/cerrar", "sesion"],
    ["/historial", "empujada"],
    ["/historial/abc", "empujada"],
    ["/ejercicio/abc", "empujada"],
    ["/progreso", "empujada"],
    ["/ajustes", "empujada"],
    ["/mesociclos", "empujada"],
    ["/plantillas", "empujada"],
    ["/plantillas/d1", "empujada"],
    ["/catalogo", "empujada"],
    ["/catalogo/nuevo", "empujada"],
    ["/datos", "empujada"],
  ];
  it.each(casos)("%s es %s", (ruta, nivel) => {
    expect(nivelDeRuta(ruta)).toBe(nivel);
  });
  it.each(casos.filter(([r]) => r !== "/"))("%s con barra final es %s", (ruta, nivel) => {
    expect(nivelDeRuta(`${ruta}/`)).toBe(nivel);
  });
});

describe("etiquetaDeRuta", () => {
  const casos: [string, string][] = [
    ["/", "Hoy"],
    ["/cuerpo", "Cuerpo"],
    ["/historial", "Historial"],
    ["/historial/abc", "Sesión"],
    ["/ejercicio/abc", "Ejercicio"],
    ["/progreso", "Progreso"],
    ["/ajustes", "Ajustes"],
    ["/mesociclos", "Mesociclos"],
    ["/plantillas", "Plantillas"],
    ["/plantillas/d1", "Día"],
    ["/catalogo", "Catálogo"],
    ["/catalogo/nuevo", "Ejercicio nuevo"],
    ["/datos", "Datos"],
    ["/sesion", "Sesión"],
    ["/no-existe", "Hoy"],
  ];
  it.each(casos)("%s → %s", (ruta, etiqueta) => {
    expect(etiquetaDeRuta(ruta)).toBe(etiqueta);
  });
});

describe("accionAtras", () => {
  it("caso 1: el detalle abierto desde el cierre va a Hoy con replace y vacía", () => {
    expect(accionAtras("/historial/abc", "?desde=cierre", ["/sesion", "/historial/abc"])).toEqual({
      destino: "/",
      etiqueta: "Hoy",
      modo: "replace",
      vaciar: true,
    });
  });

  it("caso 1 no aplica sin el parámetro", () => {
    const a = accionAtras("/historial/abc", "", ["/cuerpo", "/historial", "/historial/abc"]);
    expect(a.destino).toBe("/historial");
    expect(a.modo).toBe("back");
  });

  describe("caso 2: padre fijo", () => {
    it("la anterior ES el padre → back, etiqueta del padre, vacía", () => {
      expect(accionAtras("/historial", "", ["/cuerpo", "/historial"])).toEqual({
        destino: "/cuerpo",
        etiqueta: "Cuerpo",
        modo: "back",
        vaciar: true,
      });
      expect(accionAtras("/progreso", "", ["/cuerpo", "/progreso"]).modo).toBe("back");
      expect(accionAtras("/plantillas/d1", "", ["/plantillas", "/plantillas/d1"])).toMatchObject({
        destino: "/plantillas",
        etiqueta: "Plantillas",
        modo: "back",
      });
      expect(accionAtras("/catalogo/nuevo", "", ["/catalogo", "/catalogo/nuevo"])).toMatchObject({
        destino: "/catalogo",
        modo: "back",
      });
    });

    it("la anterior es otra → push al padre", () => {
      expect(accionAtras("/historial", "", ["/", "/historial"])).toEqual({
        destino: "/cuerpo",
        etiqueta: "Cuerpo",
        modo: "push",
        vaciar: true,
      });
      expect(accionAtras("/progreso", "", ["/progreso"])).toMatchObject({
        destino: "/cuerpo",
        modo: "push",
      });
      expect(accionAtras("/plantillas/d1", "", ["/ajustes", "/plantillas/d1"])).toMatchObject({
        destino: "/plantillas",
        modo: "push",
      });
    });
  });

  describe("caso 3: la historia real", () => {
    it("Ejercicio abierto desde Sesión vuelve a Sesión", () => {
      expect(accionAtras("/ejercicio/e1", "", ["/", "/sesion", "/ejercicio/e1"])).toEqual({
        destino: "/sesion",
        etiqueta: "Sesión",
        modo: "back",
        vaciar: false,
      });
    });

    it("Ejercicio abierto desde el detalle vuelve al detalle", () => {
      expect(
        accionAtras("/ejercicio/e1", "", ["/cuerpo", "/historial", "/historial/s1", "/ejercicio/e1"]),
      ).toMatchObject({ destino: "/historial/s1", etiqueta: "Sesión", modo: "back" });
    });

    it("Ajustes desde Cuerpo vuelve a Cuerpo", () => {
      expect(accionAtras("/ajustes", "", ["/cuerpo", "/ajustes"])).toMatchObject({
        destino: "/cuerpo",
        etiqueta: "Cuerpo",
        modo: "back",
      });
    });
  });

  describe("caso 4: en frío", () => {
    const frio: [string, string, string][] = [
      ["/historial/abc", "/historial", "Historial"],
      ["/ejercicio/abc", "/historial", "Historial"],
      ["/ajustes", "/", "Hoy"],
      ["/mesociclos", "/ajustes", "Ajustes"],
      ["/plantillas", "/ajustes", "Ajustes"],
      ["/catalogo", "/ajustes", "Ajustes"],
      ["/datos", "/ajustes", "Ajustes"],
      ["/otra-cosa", "/", "Hoy"],
    ];
    it.each(frio)("%s → %s", (ruta, destino, etiqueta) => {
      expect(accionAtras(ruta, "", [ruta])).toEqual({
        destino,
        etiqueta,
        modo: "push",
        vaciar: true,
      });
    });
  });
});

describe("siguientePila", () => {
  it("push agrega", () => {
    expect(siguientePila(["/cuerpo"], "/historial", "push")).toEqual(["/cuerpo", "/historial"]);
  });
  it("push repetido no duplica", () => {
    expect(siguientePila(["/cuerpo", "/historial"], "/historial", "push")).toEqual([
      "/cuerpo",
      "/historial",
    ]);
  });
  it("pop que coincide quita la última", () => {
    expect(siguientePila(["/ajustes", "/plantillas", "/plantillas/d1"], "/plantillas", "pop")).toEqual([
      "/ajustes",
      "/plantillas",
    ]);
  });
  it("pop que no coincide deja sólo la ruta", () => {
    expect(siguientePila(["/cuerpo", "/historial"], "/ajustes", "pop")).toEqual(["/ajustes"]);
    expect(siguientePila(["/historial"], "/progreso", "pop")).toEqual(["/progreso"]);
  });
  it("reset deja sólo la ruta", () => {
    expect(siguientePila(["/ajustes", "/plantillas", "/plantillas/d1"], "/plantillas", "reset")).toEqual([
      "/plantillas",
    ]);
  });
  it("la raíz de un área limpia la historia, sea cual sea el modo", () => {
    expect(siguientePila(["/", "/historial"], "/cuerpo", "push")).toEqual(["/cuerpo"]);
    expect(siguientePila(["/", "/sesion"], "/", "push")).toEqual(["/"]);
    expect(siguientePila(["/cuerpo", "/historial"], "/cuerpo", "pop")).toEqual(["/cuerpo"]);
  });
  it("no muta la pila recibida", () => {
    const pila = ["/cuerpo"];
    siguientePila(pila, "/historial", "push");
    expect(pila).toEqual(["/cuerpo"]);
  });
});
