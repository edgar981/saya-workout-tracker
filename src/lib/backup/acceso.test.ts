import { describe, expect, it } from "vitest";
import { accesoPermitido } from "./acceso";

const PERMITIDO = "edgar@example.com";

describe("accesoPermitido", () => {
  it("sesión con el correo permitido y sin token: entra", () => {
    expect(accesoPermitido(PERMITIDO, PERMITIDO, false)).toBe(true);
  });

  it("sesión con el correo permitido escrito con otras mayúsculas: entra", () => {
    expect(accesoPermitido("Edgar@Example.COM", PERMITIDO, false)).toBe(true);
  });

  it("sesión con otro correo y sin token: no entra", () => {
    expect(accesoPermitido("otro@example.com", PERMITIDO, false)).toBe(false);
  });

  it("sesión con otro correo y con token: entra por el token", () => {
    expect(accesoPermitido("otro@example.com", PERMITIDO, true)).toBe(true);
  });

  it("sin sesión y con token: entra", () => {
    expect(accesoPermitido(undefined, PERMITIDO, true)).toBe(true);
    expect(accesoPermitido(null, undefined, true)).toBe(true);
  });

  it("sin sesión y sin token: no entra", () => {
    expect(accesoPermitido(undefined, PERMITIDO, false)).toBe(false);
    expect(accesoPermitido(null, undefined, false)).toBe(false);
  });

  it("sesión con el correo permitido pero sin variable de correo permitido, sin token: no entra", () => {
    expect(accesoPermitido(PERMITIDO, undefined, false)).toBe(false);
    expect(accesoPermitido(PERMITIDO, "", false)).toBe(false);
  });

  it("sesión con el correo permitido pero sin variable de correo permitido, con token: entra por el token", () => {
    expect(accesoPermitido(PERMITIDO, undefined, true)).toBe(true);
  });
});
