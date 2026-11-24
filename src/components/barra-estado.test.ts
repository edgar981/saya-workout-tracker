import { afterEach, describe, expect, it, vi } from "vitest";

/** Un elemento falso: lo que la barra toca, nada más. */
function elementoFalso() {
  const hijos = [{ style: { opacity: "" } }, { style: { opacity: "" } }];
  const atributos = new Set<string>();
  const el = {
    style: { transform: "" },
    children: hijos,
    inert: false,
    offsetHeight: 62,
    get offsetWidth() {
      return 390;
    },
    toggleAttribute(nombre: string, forzar?: boolean) {
      const poner = forzar ?? !atributos.has(nombre);
      if (poner) atributos.add(nombre);
      else atributos.delete(nombre);
      return poner;
    },
  };
  return { el, hijos, atributos, asHTML: el as unknown as HTMLElement };
}

async function cargar() {
  vi.resetModules();
  return import("./barra-estado");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("el store de la barra", () => {
  it("empieza oculta; ponerBarra «ahora» pinta recogida sin snap y avisa", async () => {
    const b = await cargar();
    expect(b.leerBarra()).toBe("oculta");
    const { el, hijos, atributos, asHTML } = elementoFalso();
    b.registrarBarra(asHTML);
    expect(atributos.has("data-oculta")).toBe(true);
    expect(el.inert).toBe(true);
    let avisos = 0;
    b.suscribirBarra(() => void avisos++);
    b.ponerBarra("recogida", { ahora: true });
    expect(b.leerBarra()).toBe("recogida");
    expect(el.style.transform).toBe("translate3d(0,0.00px,0) scale(0.8400)");
    expect(hijos.map((h) => h.style.opacity)).toEqual(["", ""]);
    expect(atributos.has("data-oculta")).toBe(false);
    expect(atributos.has("data-snap")).toBe(false);
    expect(el.inert).toBe(false);
    expect(avisos).toBe(1);
    b.ponerBarra("recogida", { ahora: true });
    expect(avisos).toBe(1);
  });

  it("conducir desde arriba y soltar", async () => {
    const b = await cargar();
    const { el, hijos, asHTML } = elementoFalso();
    b.registrarBarra(asHTML);
    b.empezarConducir(true);
    expect(b.conduciendo()).toBe(true);
    b.conducirBarra(0.5);
    expect(el.style.transform).toBe("translate3d(0,49.00px,0) scale(0.9200)");
    expect(hijos.map((h) => h.style.opacity)).toEqual(["0.500", "0.500"]);
    expect(b.leerBarra()).toBe("oculta");
    b.soltarBarra(true);
    expect(b.conduciendo()).toBe(false);
    expect(b.leerBarra()).toBe("llena");
    expect(el.style.transform).toBe("translate3d(0,0.00px,0) scale(1.0000)");
    b.empezarConducir(false);
    b.soltarBarra(false);
    expect(b.leerBarra()).toBe("oculta");
  });

  it("desde llena, lo de antes es oculta", async () => {
    const b = await cargar();
    const { asHTML } = elementoFalso();
    b.registrarBarra(asHTML);
    b.ponerBarra("llena", { ahora: true });
    b.empezarConducir(true);
    b.conducirBarra(0.2);
    b.soltarBarra(false);
    expect(b.leerBarra()).toBe("oculta");
  });

  it("arribaBarraLlena", async () => {
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("getComputedStyle", () => ({ bottom: "12px" }));
    const b = await cargar();
    expect(b.arribaBarraLlena()).toBe(726);
    const { asHTML } = elementoFalso();
    b.registrarBarra(asHTML);
    expect(b.arribaBarraLlena()).toBe(726);
    vi.stubGlobal("innerHeight", 900);
    expect(b.arribaBarraLlena()).toBe(826);
    const sin = await cargar();
    expect(sin.arribaBarraLlena()).toBe(900 - 74);
  });

  it("movimientoReducido es falso sin window", async () => {
    const b = await cargar();
    expect(b.movimientoReducido()).toBe(false);
  });
});
