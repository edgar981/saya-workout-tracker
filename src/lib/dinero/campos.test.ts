import { describe, expect, it } from "vitest";

import {
  cierreValido,
  cuotasTotalValidas,
  diaPagoValido,
  fechaCampo,
  fechaLimiteValida,
  fechaValida,
  formatearPesos,
  formatearTasa,
  interesesValidos,
  pesosPositivosValidos,
  pesosValidos,
  soloDigitos,
  tasaValida,
  ultimos4Validos,
} from "./campos";

describe("formatearPesos", () => {
  it("puntos de miles", () => {
    expect(formatearPesos("1180000", 7)).toEqual({ texto: "1.180.000", cursor: 9 });
    expect(formatearPesos("999", 3)).toEqual({ texto: "999", cursor: 3 });
    expect(formatearPesos("", 0)).toEqual({ texto: "", cursor: 0 });
  });
  it("sólo dígitos y sin ceros a la izquierda", () => {
    expect(formatearPesos("a1b2", 4).texto).toBe("12");
    expect(formatearPesos("0012", 4)).toEqual({ texto: "12", cursor: 2 });
    // Un solo «0» se queda: 0 es un valor.
    expect(formatearPesos("0", 1)).toEqual({ texto: "0", cursor: 1 });
    expect(formatearPesos("000", 3)).toEqual({ texto: "0", cursor: 1 });
    expect(formatearPesos("05", 2)).toEqual({ texto: "5", cursor: 1 });
  });
  it("a lo más 13 dígitos", () => {
    expect(formatearPesos("12345678901234", 14).texto).toBe("1.234.567.890.123");
  });
  it("el cursor sigue al mismo dígito", () => {
    // «1.234» con un 5 tecleado tras el «1»: «15.234» → cursor después del «5».
    expect(formatearPesos("15.234", 2)).toEqual({ texto: "15.234", cursor: 2 });
    // «1.2345» (un 5 al final) → «12.345»: el cursor, al final.
    expect(formatearPesos("1.2345", 6)).toEqual({ texto: "12.345", cursor: 6 });
    // Un dígito tecleado en medio: «1.2|34» + 9 → «1.29|34» → «12.934», cursor tras el 9.
    expect(formatearPesos("1.294", 4)).toEqual({ texto: "1.294", cursor: 4 });
    expect(formatearPesos("12.9340", 4)).toEqual({ texto: "129.340", cursor: 3 });
    // El cursor al principio se queda al principio.
    expect(formatearPesos("1234", 0)).toEqual({ texto: "1.234", cursor: 0 });
  });
});

describe("formatearTasa y soloDigitos", () => {
  it("la tasa con coma", () => {
    expect(formatearTasa("15.2")).toBe("15,2");
    expect(formatearTasa("15,2")).toBe("15,2");
    expect(formatearTasa("1234")).toBe("123");
    expect(formatearTasa("12,345")).toBe("12,34");
    expect(formatearTasa("1,2,3")).toBe("1,23");
    expect(formatearTasa("a1b")).toBe("1");
    expect(formatearTasa("")).toBe("");
    expect(formatearTasa("12,")).toBe("12,");
    expect(formatearTasa(",5")).toBe(",5");
  });
  it("soloDigitos", () => {
    expect(soloDigitos("a1b2c3", 2)).toBe("12");
    expect(soloDigitos("12 34", 4)).toBe("1234");
    expect(soloDigitos("", 3)).toBe("");
  });
});

describe("validaciones", () => {
  it("tasa", () => {
    for (const t of ["", "0", "0,0", "26,4", "200", "15,25"]) expect(tasaValida(t), t).toBe(true);
    for (const t of ["201", "15,255", "-1", "x", ","]) expect(tasaValida(t), t).toBe(false);
  });
  it("pesos mayores que 0", () => {
    for (const t of ["", "1", "1.180.000"]) expect(pesosPositivosValidos(t), t).toBe(true);
    for (const t of ["0", "1.18", "x"]) expect(pesosPositivosValidos(t), t).toBe(false);
  });
  it("pesos de 0 en adelante", () => {
    for (const t of ["", "0", "312.000"]) expect(pesosValidos(t), t).toBe(true);
    expect(pesosValidos("1.5")).toBe(false);
  });
  it("intereses: 0 es un valor, vacío no", () => {
    expect(interesesValidos("0")).toBe(true);
    expect(interesesValidos("57.900")).toBe(true);
    expect(interesesValidos("")).toBe(false);
    expect(interesesValidos("x")).toBe(false);
  });
  it("últimos 4", () => {
    for (const t of ["", "0000", "7730"]) expect(ultimos4Validos(t), t).toBe(true);
    for (const t of ["123", "12345", "12a4"]) expect(ultimos4Validos(t), t).toBe(false);
  });
  it("número de cuotas y día de pago", () => {
    for (const t of ["", "1", "48", "600"]) expect(cuotasTotalValidas(t), t).toBe(true);
    for (const t of ["0", "601", "1.5"]) expect(cuotasTotalValidas(t), t).toBe(false);
    for (const t of ["", "1", "25", "31"]) expect(diaPagoValido(t), t).toBe(true);
    for (const t of ["0", "32", "x"]) expect(diaPagoValido(t), t).toBe(false);
  });
  it("fechas", () => {
    expect(fechaValida("2026-10-30")).toBe(true);
    expect(fechaValida("2024-02-29")).toBe(true);
    expect(fechaValida("2026-02-30")).toBe(false);
    expect(fechaValida("30/10/2026")).toBe(false);
    expect(cierreValido("2026-11-25", "2026-11-25")).toBe(true);
    expect(cierreValido("2026-11-26", "2026-11-25")).toBe(false);
    expect(cierreValido("", "2026-11-25")).toBe(true);
    expect(fechaLimiteValida("2026-11-15", "2026-10-30")).toBe(true);
    expect(fechaLimiteValida("2026-10-30", "2026-10-30")).toBe(true);
    expect(fechaLimiteValida("2026-10-29", "2026-10-30")).toBe(false);
    expect(fechaLimiteValida("2026-10-29", "")).toBe(true);
    expect(fechaLimiteValida("", "2026-10-30")).toBe(true);
  });
  it("fechaCampo", () => {
    expect(fechaCampo("2026-10-30")).toBe("30 oct 2026");
    expect(fechaCampo("2025-03-05")).toBe("5 mar 2025");
  });
});
