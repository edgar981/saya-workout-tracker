import { describe, expect, it } from "vitest";
import { MINIMO_CONTRASENA, textoDeError } from "./errores";

describe("textoDeError", () => {
  it("correo o contraseña incorrectos", () => {
    expect(
      textoDeError({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password", status: 401, statusText: "Unauthorized" }),
    ).toBe("Correo o contraseña incorrectos.");
  });

  it("la cuenta ya existe", () => {
    expect(
      textoDeError({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists. Use another email.", status: 422 }),
    ).toBe("Esa cuenta ya existe: entra con la contraseña.");
  });

  it("el registro rechazado por el hook (403 sin código)", () => {
    expect(textoDeError({ message: "El registro está cerrado.", status: 403, statusText: "Forbidden" })).toBe(
      "Ese correo no puede tener cuenta.",
    );
  });

  it("un 403 con código propio no es el hook", () => {
    expect(textoDeError({ code: "INVALID_ORIGIN", message: "Invalid origin", status: 403 })).toBe(
      "No se pudo: Invalid origin",
    );
  });

  it("contraseña demasiado corta, con el mínimo medido", () => {
    expect(MINIMO_CONTRASENA).toBe(8);
    expect(textoDeError({ code: "PASSWORD_TOO_SHORT", message: "Password too short", status: 400 })).toBe(
      "La contraseña es muy corta: mínimo 8 caracteres.",
    );
  });

  it("límite de intentos (429 sin código)", () => {
    expect(
      textoDeError({ message: "Too many requests. Please try again later.", status: 429, statusText: "Too Many Requests" }),
    ).toBe("Demasiados intentos: espera unos segundos.");
  });

  it("passkey cancelado, al entrar y al agregar", () => {
    const textos = ["AUTH_CANCELLED", "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "ERROR_CEREMONY_ABORTED"].map((code) =>
      textoDeError({ code, message: "Auth cancelled", status: 400, statusText: "BAD_REQUEST" }),
    );
    expect(textos).toEqual(["Se canceló el passkey.", "Se canceló el passkey.", "Se canceló el passkey."]);
  });

  it("sin red: fetch lanza un TypeError", () => {
    expect(textoDeError(new TypeError("Failed to fetch"))).toBe("Sin señal.");
    expect(textoDeError(new TypeError("Load failed"))).toBe("Sin señal.");
  });

  it("cualquier otro, con y sin mensaje", () => {
    expect(textoDeError({ code: "FAILED_TO_CREATE_USER", message: "Failed to create user", status: 422 })).toBe(
      "No se pudo: Failed to create user",
    );
    expect(textoDeError({ status: 500 })).toBe("No se pudo.");
    expect(textoDeError(null)).toBe("No se pudo.");
  });
});
