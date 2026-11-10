import { describe, expect, it } from "vitest";
import { accesoPermitido } from "./acceso";

const PERMITIDO = "edgar@example.com";

describe("accesoPermitido", () => {
  it("sesión con el correo permitido: entra", () => {
    expect(accesoPermitido(PERMITIDO, PERMITIDO)).toBe(true);
  });

  it("sesión con el correo permitido escrito con otras mayúsculas: entra", () => {
    expect(accesoPermitido("Edgar@Example.COM", PERMITIDO)).toBe(true);
  });

  it("sesión con otro correo: no entra", () => {
    expect(accesoPermitido("otro@example.com", PERMITIDO)).toBe(false);
  });

  it("sin sesión: no entra", () => {
    expect(accesoPermitido(undefined, PERMITIDO)).toBe(false);
    expect(accesoPermitido(null, undefined)).toBe(false);
  });

  it("sesión con el correo permitido pero sin variable de correo permitido: no entra", () => {
    expect(accesoPermitido(PERMITIDO, undefined)).toBe(false);
    expect(accesoPermitido(PERMITIDO, "")).toBe(false);
  });
});
