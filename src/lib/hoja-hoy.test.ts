import { describe, expect, it } from "vitest";

import { crearResorte, type Entorno } from "@/lib/barra";
import {
  alturaBaja,
  cierraDia,
  decidirSoltar,
  MEMORIA_RUEDA_HOJA,
  pintarHoja,
  puntosSpark,
  reclamaToque,
  reglaRuedaHoja,
  RESPUESTA_DIA,
  RESPUESTA_HOJA,
  seguirHoja,
  valorDia,
  type MemoriaRuedaHoja,
} from "@/lib/hoja-hoy";

describe("alturaBaja", () => {
  it("la primera tesela queda 16 px sobre la barra", () => {
    expect(alturaBaja(726, 400)).toBe(310);
  });
  it("nunca menos de 140", () => {
    expect(alturaBaja(726, 650)).toBe(140);
  });
});

describe("seguirHoja", () => {
  it("elástico por arriba de 0", () => {
    expect(seguirHoja(-100, 300)).toBeCloseTo(-46.48, 1);
  });
  it("elástico por debajo de Y", () => {
    expect(seguirHoja(400, 300)).toBeCloseTo(346.48, 1);
  });
  it("dentro del rango sigue al dedo", () => {
    expect(seguirHoja(120, 300)).toBe(120);
  });
});

describe("decidirSoltar", () => {
  it("lento: decide la proyección contra la mitad", () => {
    expect(decidirSoltar(100, 200, 300)).toEqual({ baja: true, amortiguacion: 1 });
    expect(decidirSoltar(100, 0, 300)).toEqual({ baja: false, amortiguacion: 1 });
  });
  it("golpe: decide el sentido", () => {
    expect(decidirSoltar(250, -400, 300)).toEqual({ baja: false, amortiguacion: 0.86 });
    expect(decidirSoltar(10, 500, 300)).toEqual({ baja: true, amortiguacion: 0.86 });
  });
});

describe("pintarHoja", () => {
  it("a media bajada", () => {
    expect(pintarHoja(150, 300)).toEqual({
      transform: "translate3d(0,150.00px,0)",
      opacidad: "0.500",
      oculta: false,
    });
  });
  it("casi en 0 no escribe nada", () => {
    expect(pintarHoja(0.005, 300)).toEqual({ transform: "", opacidad: "", oculta: false });
  });
  it("abajo, oculta", () => {
    const p = pintarHoja(300, 300);
    expect(p.opacidad).toBe("0.000");
    expect(p.oculta).toBe(true);
  });
  it("por encima de 0 sólo se traslada", () => {
    const p = pintarHoja(-20, 300);
    expect(p.transform).toBe("translate3d(0,-20.00px,0)");
    expect(p.opacidad).toBe("");
  });
});

describe("reclamaToque", () => {
  it("espera bajo el umbral", () => expect(reclamaToque(3, 4, false, 0)).toBe("espera"));
  it("hacia abajo en el tope es mío", () => expect(reclamaToque(0, 10, false, 0)).toBe("mia"));
  it("hacia arriba con la hoja arriba no", () => expect(reclamaToque(0, -10, false, 0)).toBe("muerto"));
  it("hacia arriba con la hoja abajo sí", () => expect(reclamaToque(0, -10, true, 0)).toBe("mia"));
  it("con scroll, no", () => expect(reclamaToque(0, 10, false, 5)).toBe("muerto"));
  it("más horizontal que vertical, no", () => expect(reclamaToque(10, 9, true, 0)).toBe("muerto"));
});

describe("reglaRuedaHoja", () => {
  const ev = (deltaY: number, ahora: number, baja = false, scrollY = 0) => ({
    deltaY,
    scrollY,
    baja,
    ahora,
  });
  it("tres golpes seguidos de −8 bajan", () => {
    let m: MemoriaRuedaHoja = MEMORIA_RUEDA_HOJA;
    const acciones: (string | null)[] = [];
    for (const t of [0, 16, 32]) {
      const r = reglaRuedaHoja(m, ev(-8, t));
      m = r.memoria;
      acciones.push(r.accion);
    }
    expect(acciones).toEqual([null, null, "bajar"]);
  });
  it("con más de 200 ms entre ellos, nunca baja", () => {
    let m: MemoriaRuedaHoja = MEMORIA_RUEDA_HOJA;
    for (const t of [0, 300, 600, 900]) {
      const r = reglaRuedaHoja(m, ev(-8, t));
      m = r.memoria;
      expect(r.accion).toBeNull();
    }
  });
  it("tras bajar, el bloqueo consume sin cambiar; a los 700 ms sube", () => {
    let m: MemoriaRuedaHoja = MEMORIA_RUEDA_HOJA;
    for (const t of [0, 16, 32]) m = reglaRuedaHoja(m, ev(-8, t)).memoria;
    const bloqueada = reglaRuedaHoja(m, ev(30, 100, true));
    expect(bloqueada.consume).toBe(true);
    expect(bloqueada.accion).toBeNull();
    const sube = reglaRuedaHoja(bloqueada.memoria, ev(30, 700, true));
    expect(sube.accion).toBe("subir");
  });
  it("con scroll y la hoja arriba, no consume", () => {
    const r = reglaRuedaHoja(MEMORIA_RUEDA_HOJA, ev(-8, 0, false, 10));
    expect(r.consume).toBe(false);
    expect(r.accion).toBeNull();
  });
});

describe("cierraDia", () => {
  it("pasa del 45 %", () => expect(cierraDia(200, 0, 400)).toBe(true));
  it("no llega", () => expect(cierraDia(100, 0, 400)).toBe(false));
  it("un golpe hacia abajo la cierra", () => expect(cierraDia(100, 400, 400)).toBe(true));
  it("hacia arriba no cierra", () => expect(cierraDia(300, -100, 400)).toBe(false));
});

describe("valorDia", () => {
  it("nunca", () => expect(valorDia(undefined, false, false)).toBe("nunca"));
  it("abierta manda", () => expect(valorDia(3, true, true)).toBe("abierta"));
  it("corto", () => {
    expect(valorDia(0, false, true)).toBe("hoy");
    expect(valorDia(5, false, true)).toBe("5 d");
  });
  it("largo", () => {
    expect(valorDia(1, false, false)).toBe("ayer");
    expect(valorDia(5, false, false)).toBe("hace 5 d");
  });
});

describe("puntosSpark", () => {
  it("dos valores", () => expect(puntosSpark([70, 80], 120, 26)).toBe("M0.0,24.0L120.0,2.0"));
  it("todos iguales", () =>
    expect(puntosSpark([5, 5, 5], 120, 26)).toBe("M0.0,24.0L60.0,24.0L120.0,24.0"));
  it("uno solo, nada", () => expect(puntosSpark([1], 120, 26)).toBeNull());
});

describe("los resortes de las hojas llegan sin cuadros", () => {
  function entornoFalso(oculto = false) {
    let ahora = 0;
    const timers: { cb: () => void; en: number }[] = [];
    const entorno: Entorno = {
      ahora: () => ahora,
      cuadro: () => null,
      cancelarCuadro: () => {},
      temporizador: (cb, ms) => {
        const t = { cb, en: ahora + ms };
        timers.push(t);
        return t;
      },
      cancelarTemporizador: (id) => {
        const i = timers.indexOf(id as (typeof timers)[number]);
        if (i >= 0) timers.splice(i, 1);
      },
      oculto: () => oculto,
    };
    return {
      entorno,
      timers,
      avanzar(ms: number) {
        ahora += ms;
        for (const t of [...timers]) {
          if (t.en <= ahora) {
            timers.splice(timers.indexOf(t), 1);
            t.cb();
          }
        }
      },
    };
  }

  it("la hoja de Hoy: la guardia de 1540 ms la termina", () => {
    const f = entornoFalso();
    // Sin cuadros, `ir` salta al instante: se prueba con un cuadro que nunca corre.
    f.entorno.cuadro = () => 1;
    let x = 0;
    let listo = 0;
    const r = crearResorte((y) => (x = y), { respuesta: RESPUESTA_HOJA }, f.entorno);
    r.ir(300, { listo: () => listo++ });
    expect(r.enMarcha()).toBe(true);
    f.avanzar(1539);
    expect(listo).toBe(0);
    f.avanzar(1);
    expect(x).toBe(300);
    expect(listo).toBe(1);
    expect(r.enMarcha()).toBe(false);
  });

  it("la hoja del día: la guardia de 1780 ms la termina", () => {
    const f = entornoFalso();
    f.entorno.cuadro = () => 1;
    let x = 400;
    let listo = 0;
    const r = crearResorte((y) => (x = y), { respuesta: RESPUESTA_DIA }, f.entorno);
    r.poner(400);
    r.ir(0, { listo: () => listo++ });
    f.avanzar(1779);
    expect(listo).toBe(0);
    f.avanzar(1);
    expect(x).toBe(0);
    expect(listo).toBe(1);
  });

  it("con la pestaña oculta, ir llega al destino sin guardia", () => {
    const f = entornoFalso(true);
    let x = 0;
    let listo = 0;
    const r = crearResorte((y) => (x = y), { respuesta: RESPUESTA_HOJA }, f.entorno);
    r.ir(300, { listo: () => listo++ });
    expect(x).toBe(300);
    expect(listo).toBe(1);
    expect(f.timers.length).toBe(0);
  });
});
