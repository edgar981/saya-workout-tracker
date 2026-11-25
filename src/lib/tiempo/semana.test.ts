import { describe, expect, it } from "vitest";

import {
  desdeParaLeer,
  escalaTemas,
  escalaTesela,
  etiquetaRegistro,
  formatoHM,
  lineaDiferencia,
  partesHM,
  porcentajeDe,
  rangoSemana,
  resumen,
  sumarDias,
  type DatosTiempo,
  type RegistroTiempoDto,
} from "./semana";

const HOY = "2026-11-10";
const d = (n: number) => sumarDias(HOY, n);

const LG = "11111111-1111-4111-8111-111111111111";
const EN = "22222222-2222-4222-8222-222222222222";
const AWS = "33333333-3333-4333-8333-333333333333";

let n = 0;
function reg(tema: string, minutos: number, dia: number): RegistroTiempoDto {
  n += 1;
  return {
    id: `r${n}`,
    tema_id: tema,
    minutos,
    fecha: d(dia),
    anotado_en: new Date(Date.UTC(2026, 10, 10, 12, 0)).toISOString(),
  };
}

function ejemplo(): DatosTiempo {
  const registros = [
    reg(LG, 50, 0),
    reg(EN, 45, -1),
    reg(LG, 90, -2),
    reg(EN, 45, -4),
    reg(LG, 60, -5),
  ];
  for (let k = 1; k <= 4; k++) {
    registros.push(reg(LG, 170, -7 * k), reg(EN, 150, -7 * k), reg(AWS, 115, -7 * k));
  }
  return {
    temas: [
      { id: LG, nombre: "Agentes con LangGraph" },
      { id: EN, nombre: "Inglés B2 · conversación" },
      { id: AWS, nombre: "Certificación AWS SAA" },
    ],
    registros,
    primer_registro: d(-34),
  };
}

describe("resumen con los datos de la maqueta", () => {
  const r = resumen(ejemplo(), HOY);
  it("la semana suma 290 y la típica es 435", () => {
    expect(r.minutos).toBe(290);
    expect(r.tipica).toBe(435);
    expect(formatoHM(r.minutos)).toBe("4 h 50 min");
    expect(formatoHM(r.tipica!)).toBe("7 h 15 min");
    expect(lineaDiferencia(r.minutos, r.tipica)).toBe("↓ 2 h 25 min");
  });
  it("AWS se muestra con 0 y típica 115", () => {
    const aws = r.temas.find((t) => t.id === AWS);
    expect(aws).toMatchObject({ minutos: 0, tipica: 115 });
  });
  it("ordena por minutos, luego típica, luego nombre", () => {
    expect(r.temas.map((t) => t.id)).toEqual([LG, EN, AWS]);
    expect(r.temas[0]).toMatchObject({ minutos: 200, tipica: 170 });
    expect(r.temas[1]).toMatchObject({ minutos: 90, tipica: 150 });
  });
  it("la escala de los temas es 220", () => {
    expect(escalaTemas(r.temas)).toBeCloseTo(220);
  });
  it("lee desde hoy − 34", () => {
    expect(desdeParaLeer(HOY)).toBe(d(-34));
  });
});

describe("la típica", () => {
  it("una ventana que termina antes de primer_registro no cuenta", () => {
    const datos = ejemplo();
    datos.primer_registro = d(-20); // las ventanas 3 (fin −21) y 4 (fin −28) quedan fuera
    datos.registros = datos.registros.filter((x) => x.fecha >= d(-20));
    const r = resumen(datos, HOY);
    expect(r.tipica).toBe(435);
  });
  it("las ventanas que cuentan entran aunque sumen 0", () => {
    const datos: DatosTiempo = {
      temas: [{ id: LG, nombre: "A" }],
      registros: [reg(LG, 70, -7)],
      primer_registro: d(-14),
    };
    // ventanas 1 y 2 cuentan: 70 y 0 → 35
    expect(resumen(datos, HOY).tipica).toBe(35);
  });
  it("sin ventanas, la típica es null y no hay diferencia", () => {
    const datos: DatosTiempo = {
      temas: [{ id: LG, nombre: "A" }],
      registros: [reg(LG, 30, 0)],
      primer_registro: d(0),
    };
    const r = resumen(datos, HOY);
    expect(r.minutos).toBe(30);
    expect(r.tipica).toBeNull();
    expect(lineaDiferencia(r.minutos, r.tipica)).toBeNull();
    expect(resumen({ temas: [], registros: [], primer_registro: null }, HOY).tipica).toBeNull();
  });
  it("sin diferencia si son iguales; ↑ si va por encima", () => {
    expect(lineaDiferencia(60, 60)).toBeNull();
    expect(lineaDiferencia(120, 60)).toBe("↑ 1 h");
  });
});

describe("formatos", () => {
  it("formatoHM", () => {
    expect(formatoHM(0)).toBe("0 min");
    expect(formatoHM(45)).toBe("45 min");
    expect(formatoHM(60)).toBe("1 h");
    expect(formatoHM(290)).toBe("4 h 50 min");
  });
  it("partesHM", () => {
    expect(partesHM(290)).toEqual([
      { n: "4", u: "h" },
      { n: "50", u: "min" },
    ]);
    expect(partesHM(0)).toEqual([{ n: "0", u: "min" }]);
  });
  it("rangoSemana en el mismo mes y entre dos meses", () => {
    expect(rangoSemana("2026-11-10")).toBe("4 – 10 nov");
    expect(rangoSemana("2026-11-03")).toBe("28 oct – 3 nov");
  });
});

describe("etiquetaRegistro", () => {
  it("hoy, con la hora local de anotado_en", () => {
    const local = new Date(2026, 10, 10, 7, 10);
    expect(etiquetaRegistro({ fecha: HOY, anotado_en: local.toISOString() }, HOY)).toBe("Hoy, 7:10");
  });
  it("otro día, con la hora si el día local coincide", () => {
    const local = new Date(2026, 10, 9, 21, 15);
    expect(etiquetaRegistro({ fecha: "2026-11-09", anotado_en: local.toISOString() }, HOY)).toBe(
      "9 nov, 21:15",
    );
  });
  it("sin hora si el día local de anotado_en no es la fecha", () => {
    const local = new Date(2026, 10, 10, 8, 0);
    expect(etiquetaRegistro({ fecha: "2026-11-05", anotado_en: local.toISOString() }, HOY)).toBe(
      "5 nov",
    );
  });
});

describe("escalas", () => {
  it("de la tesela, con y sin típica", () => {
    expect(escalaTesela(290, 435)).toBeCloseTo(500.25);
    expect(escalaTesela(100, null)).toBeCloseTo(115);
  });
  it("con escala 0 el ancho es 0", () => {
    expect(porcentajeDe(0, 0)).toBe(0);
    expect(porcentajeDe(50, 100)).toBe(50);
    expect(porcentajeDe(500, 100)).toBe(100);
    expect(escalaTemas([])).toBe(0);
  });
});
