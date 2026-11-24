import { describe, expect, it } from "vitest";

import {
  EPS_BARRA,
  agregarMuestra,
  asentado,
  crearResorte,
  destinoDe,
  ejeDe,
  pastillaAlSoltar,
  pastillaArrastre,
  pintarBarra,
  reglaRueda,
  reglaScroll,
  reglaTiron,
  resorteEn,
  terminarResortes,
  velocidad,
  type Entorno,
  type Movimiento,
  type Resorte,
} from "./barra";

/** La integración de la maqueta: Euler semi-implícito, k = (2π/r)², c = 4π·ζ/r. */
function euler(m: Required<Movimiento>, hasta: number, dt: number) {
  const k = (2 * Math.PI) ** 2 / m.respuesta ** 2;
  const c = (4 * Math.PI * m.amortiguacion) / m.respuesta;
  let x = m.x0;
  let v = m.v0;
  const pasos = Math.round(hasta / dt);
  const xs: number[] = [x];
  for (let i = 0; i < pasos; i++) {
    v += (-k * (x - m.destino) - c * v) * dt;
    x += v * dt;
    xs.push(x);
  }
  return xs;
}

describe("resorteEn", () => {
  const casos: Required<Movimiento>[] = [
    { x0: 0, v0: 0, destino: 1, respuesta: 0.32, amortiguacion: 1 },
    { x0: 1, v0: 0, destino: 0, respuesta: 0.3, amortiguacion: 1 },
    { x0: 0, v0: 5, destino: 1, respuesta: 0.35, amortiguacion: 0.86 },
    { x0: 300, v0: -3000, destino: 0, respuesta: 0.36, amortiguacion: 0.86 },
  ];
  for (const m of casos) {
    it(`sigue a la integración fina: ${m.x0}→${m.destino} r ${m.respuesta} ζ ${m.amortiguacion}`, () => {
      const dt = 1 / 4000;
      const xs = euler(m, 1, dt);
      const tope = 0.005 * Math.abs(m.x0 - m.destino);
      for (let i = 0; i < xs.length; i += 40) {
        expect(Math.abs(resorteEn(m, i * dt).x - xs[i])).toBeLessThanOrEqual(tope);
      }
    });
  }

  it("valor fijo", () => {
    const { x } = resorteEn({ x0: 0, v0: 0, destino: 1, respuesta: 0.32 }, 0.1);
    expect(x).toBeCloseTo(0.584, 3);
  });

  it("en t = 0 devuelve x0 y v0; con t grande, el destino", () => {
    for (const m of casos) {
      const a = resorteEn(m, 0);
      expect(a.x).toBeCloseTo(m.x0, 9);
      expect(a.v).toBeCloseTo(m.v0, 9);
      const z = resorteEn(m, 30);
      expect(z.x).toBeCloseTo(m.destino, 6);
    }
  });

  it("los tiempos de asentamiento de la cuenta del orquestador caben en la guardia", () => {
    const tiempo = (m: Movimiento, eps: number) => {
      for (let t = 0; t < 5; t += 0.001) {
        const e = resorteEn(m, t);
        if (asentado(e.x, e.v, m.destino, eps)) return t;
      }
      return Infinity;
    };
    const mostrar = tiempo({ x0: 0, v0: 0, destino: 1, respuesta: 0.32 }, EPS_BARRA);
    expect(mostrar).toBeGreaterThan(0.35);
    expect(mostrar).toBeLessThan(1.38);
    const hoja = tiempo({ x0: 300, v0: 0, destino: 0, respuesta: 0.36 }, 0.3);
    expect(hoja).toBeLessThan(1.54);
  });
});

/** Un entorno con el reloj a mano, cuadros en una cola y temporizadores en una lista. */
function entornoFalso() {
  let t = 1000;
  let id = 0;
  let oculto = false;
  const cuadros = new Map<number, () => void>();
  const temporizadores = new Map<number, { cb: () => void; ms: number }>();
  const env: Entorno = {
    ahora: () => t,
    cuadro: (cb) => {
      cuadros.set(++id, cb);
      return id;
    },
    cancelarCuadro: (i) => void cuadros.delete(i as number),
    temporizador: (cb, ms) => {
      temporizadores.set(++id, { cb, ms });
      return id;
    },
    cancelarTemporizador: (i) => void temporizadores.delete(i as number),
    oculto: () => oculto,
  };
  return {
    env,
    avanzar: (ms: number) => void (t += ms),
    correrCuadros() {
      const cs = [...cuadros.values()];
      cuadros.clear();
      for (const c of cs) c();
    },
    pedidos: () => cuadros.size,
    guardias: () => [...temporizadores.values()].map((g) => g.ms),
    dispararGuardias() {
      const gs = [...temporizadores.values()];
      temporizadores.clear();
      for (const g of gs) g.cb();
    },
    ocultar: (v: boolean) => void (oculto = v),
  };
}

describe("crearResorte", () => {
  it("mueve x como resorteEn y llama listo una vez al asentarse", () => {
    const f = entornoFalso();
    let pintado = 0;
    let listos = 0;
    const r = crearResorte((x) => void (pintado = x), { respuesta: 0.32, eps: EPS_BARRA }, f.env);
    r.ir(1, { listo: () => void listos++ });
    expect(r.enMarcha()).toBe(true);
    expect(f.guardias()).toEqual([1380]);
    f.avanzar(100);
    f.correrCuadros();
    expect(pintado).toBeCloseTo(resorteEn({ x0: 0, v0: 0, destino: 1, respuesta: 0.32 }, 0.1).x, 9);
    f.avanzar(3000);
    f.correrCuadros();
    expect(r.x).toBe(1);
    expect(r.enMarcha()).toBe(false);
    expect(listos).toBe(1);
    expect(f.pedidos()).toBe(0);
    expect(f.guardias()).toEqual([]);
  });

  it("sin cuadros, la guardia lo deja en el destino y llama listo", () => {
    const f = entornoFalso();
    let listos = 0;
    const r = crearResorte(() => {}, { respuesta: 0.32, eps: EPS_BARRA }, f.env);
    r.ir(1, { listo: () => void listos++ });
    f.dispararGuardias();
    expect(r.x).toBe(1);
    expect(r.v).toBe(0);
    expect(listos).toBe(1);
  });

  it("con la pestaña oculta salta al destino sin pedir cuadros", () => {
    const f = entornoFalso();
    f.ocultar(true);
    let listos = 0;
    const r = crearResorte(() => {}, { respuesta: 0.32 }, f.env);
    r.ir(5, { listo: () => void listos++ });
    expect(r.x).toBe(5);
    expect(f.pedidos()).toBe(0);
    expect(listos).toBe(1);
  });

  it("con movimiento reducido salta al destino", () => {
    const f = entornoFalso();
    const r = crearResorte(() => {}, { respuesta: 0.32, reducido: () => true }, f.env);
    r.ir(2);
    expect(r.x).toBe(2);
    expect(f.pedidos()).toBe(0);
    expect(r.enMarcha()).toBe(false);
  });

  it("poner fija x sin velocidad; parar conserva donde va", () => {
    const f = entornoFalso();
    const r = crearResorte(() => {}, { respuesta: 0.32 }, f.env);
    r.poner(3);
    expect(r.x).toBe(3);
    expect(r.destino).toBe(3);
    r.ir(10);
    f.avanzar(50);
    r.parar();
    expect(r.enMarcha()).toBe(false);
    expect(r.x).toBeGreaterThan(3);
    expect(r.x).toBeLessThan(10);
  });
});

describe("terminarResortes", () => {
  it("deja a los resortes en marcha en su destino y llama sus listo", () => {
    const f = entornoFalso();
    const a = crearResorte(() => {}, { respuesta: 0.32 }, f.env);
    const b = crearResorte(() => {}, { respuesta: 0.3 }, f.env);
    let listos = 0;
    a.ir(1, { listo: () => void listos++ });
    b.ir(7, { listo: () => void listos++ });
    terminarResortes();
    expect(a.x).toBe(1);
    expect(b.x).toBe(7);
    expect(listos).toBe(2);
    expect(a.enMarcha() || b.enMarcha()).toBe(false);
  });

  it("si un listo arranca otro resorte, también queda en su destino", () => {
    const f = entornoFalso();
    const a = crearResorte(() => {}, { respuesta: 0.32 }, f.env);
    const c: Resorte = crearResorte(() => {}, { respuesta: 0.36 }, f.env);
    let listoC = 0;
    a.ir(1, { listo: () => c.ir(9, { listo: () => void listoC++ }) });
    terminarResortes();
    expect(c.x).toBe(9);
    expect(c.enMarcha()).toBe(false);
    expect(listoC).toBe(1);
  });
});

describe("reglaScroll", () => {
  const base = { y: 100, max: 2000, ahora: 10_000, ultimoCambio: 0 };
  it("subir más de 24 px con la barra oculta la recoge", () => {
    const r = reglaScroll({ y0: 130, acc: 0 }, { ...base, y: 100, estado: "oculta" });
    expect(r.poner).toBe("recogida");
    expect(r.memoria).toEqual({ y0: 100, acc: 0 });
  });
  it("bajar más de 12 px con y sobre 40 la oculta", () => {
    expect(reglaScroll({ y0: 100, acc: 0 }, { ...base, y: 120, estado: "recogida" }).poner).toBe("oculta");
  });
  it("con y bajo 40, nada", () => {
    expect(reglaScroll({ y0: 10, acc: 0 }, { ...base, y: 30, estado: "recogida" }).poner).toBeNull();
  });
  it("dentro de los 450 ms del último cambio, nada", () => {
    const e = { ...base, ahora: 10_000, ultimoCambio: 9_700 };
    expect(reglaScroll({ y0: 100, acc: 0 }, { ...e, y: 140, estado: "recogida" }).poner).toBeNull();
  });
  it("un cambio de sentido reinicia la suma", () => {
    const r = reglaScroll({ y0: 100, acc: 10 }, { ...base, y: 95, estado: "recogida" });
    expect(r.memoria.acc).toBe(-5);
    expect(r.poner).toBeNull();
  });
  it("y < 0, y > max o sin movimiento: nada, y la memoria sigue a y", () => {
    expect(reglaScroll({ y0: 0, acc: 0 }, { ...base, y: -30, estado: "oculta" })).toEqual({
      memoria: { y0: -30, acc: 0 },
      poner: null,
    });
    expect(reglaScroll({ y0: 1900, acc: 0 }, { ...base, y: 2100, estado: "recogida" }).poner).toBeNull();
    expect(reglaScroll({ y0: 100, acc: 5 }, { ...base, y: 100, estado: "recogida" }).memoria).toEqual({
      y0: 100,
      acc: 5,
    });
  });
  it("con la barra llena, nada", () => {
    expect(reglaScroll({ y0: 300, acc: 0 }, { ...base, y: 100, estado: "llena" }).poner).toBeNull();
    expect(reglaScroll({ y0: 100, acc: 0 }, { ...base, y: 300, estado: "llena" }).poner).toBeNull();
  });
});

describe("reglaRueda", () => {
  const e = { scrollTop: 0, ultimoCambio: 0, estado: "oculta" as const };
  it("tres eventos de −8 seguidos recogen la barra", () => {
    let m = { wa: 0, tUlt: 0 };
    const puestas: (string | null)[] = [];
    for (const ahora of [10_000, 10_050, 10_100]) {
      const r = reglaRueda(m, { ...e, deltaY: -8, ahora });
      m = r.memoria;
      puestas.push(r.poner);
    }
    expect(puestas).toEqual([null, null, "recogida"]);
  });
  it("con una pausa de más de 200 ms entre ellos, no", () => {
    let m = { wa: 0, tUlt: 0 };
    let poner: string | null = null;
    for (const ahora of [10_000, 10_300, 10_600]) {
      const r = reglaRueda(m, { ...e, deltaY: -8, ahora });
      m = r.memoria;
      poner = r.poner ?? poner;
    }
    expect(poner).toBeNull();
  });
  it("con scrollTop > 0, no", () => {
    let m = { wa: 0, tUlt: 0 };
    for (const ahora of [10_000, 10_050, 10_100]) {
      const r = reglaRueda(m, { ...e, scrollTop: 50, deltaY: -8, ahora });
      expect(r.poner).toBeNull();
      m = r.memoria;
    }
  });
});

describe("reglaTiron", () => {
  it("25 px desde el tope con la barra oculta la recoge; 20 px, no; sin ty0, no", () => {
    expect(reglaTiron(100, 125, "oculta")).toBe("recogida");
    expect(reglaTiron(100, 120, "oculta")).toBeNull();
    expect(reglaTiron(null, 300, "oculta")).toBeNull();
    expect(reglaTiron(100, 200, "recogida")).toBeNull();
  });
});

describe("pintarBarra y destinoDe", () => {
  it("los cuatro casos de la maqueta", () => {
    expect(pintarBarra(0, 0, false)).toEqual({ ty: 98, escala: 0.84, opacidad: 0, oculta: true });
    expect(pintarBarra(1, 0, false)).toMatchObject({ ty: 0, escala: 0.84, opacidad: null, oculta: false });
    expect(pintarBarra(1, 1, false).escala).toBe(1);
    const r = pintarBarra(0.5, 0, true);
    expect(r.ty).toBe(0);
    expect(r.opacidad).toBe(0.5);
  });
  it("destinoDe", () => {
    expect(destinoDe("oculta")).toEqual({ mostrar: 0, tamano: null });
    expect(destinoDe("recogida")).toEqual({ mostrar: 1, tamano: 0 });
    expect(destinoDe("llena")).toEqual({ mostrar: 1, tamano: 1 });
  });
});

describe("los arrastres", () => {
  it("velocidad: una muestra vieja da cero; dos a 10 ms y 5 px dan 500 px/s", () => {
    expect(velocidad([{ x: 0, y: 0, t: 0 }, { x: 50, y: 0, t: 10 }], 200)).toEqual({ vx: 0, vy: 0 });
    expect(velocidad([{ x: 0, y: 0, t: 100 }, { x: 5, y: 0, t: 110 }], 115)).toEqual({ vx: 500, vy: 0 });
    expect(velocidad([{ x: 0, y: 0, t: 100 }], 101)).toEqual({ vx: 0, vy: 0 });
  });
  it("agregarMuestra guarda las seis últimas", () => {
    let ms: ReturnType<typeof agregarMuestra> = [];
    for (let i = 0; i < 9; i++) ms = agregarMuestra(ms, { x: i, y: 0, t: i });
    expect(ms.map((m) => m.x)).toEqual([3, 4, 5, 6, 7, 8]);
  });
  it("ejeDe: null bajo el umbral, después el eje mayor", () => {
    expect(ejeDe(3, 4, 10)).toBeNull();
    expect(ejeDe(12, 3, 10)).toBe("x");
    expect(ejeDe(2, -14, 10)).toBe("y");
  });
  it("pastillaAlSoltar con velocidad alta salta una pestaña y nunca sale de [0, n − 1]", () => {
    expect(pastillaAlSoltar(0.3, 600, 150, 4)).toBeGreaterThanOrEqual(1);
    for (const vx of [-1e6, -600, 0, 600, 1e6]) {
      for (const x of [-0.5, 0, 1.2, 3, 3.6]) {
        const i = pastillaAlSoltar(x, vx, 100, 4);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThanOrEqual(3);
      }
    }
  });
  it("pastillaArrastre es elástica en los bordes", () => {
    expect(pastillaArrastre(0, 50, 100, 2)).toBeCloseTo(0.5, 9);
    expect(pastillaArrastre(0, -100, 100, 2)).toBeLessThan(0);
    expect(pastillaArrastre(0, -100, 100, 2)).toBeGreaterThan(-1);
    expect(pastillaArrastre(1, 100, 100, 2)).toBeGreaterThan(1);
    expect(pastillaArrastre(1, 100, 100, 2)).toBeLessThan(2);
  });
});
