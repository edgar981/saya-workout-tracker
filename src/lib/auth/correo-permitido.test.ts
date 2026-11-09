import { describe, expect, it } from "vitest";
import { esCorreoPermitido } from "./correo-permitido";

describe("esCorreoPermitido", () => {
  const permitido = "edgar@example.com";

  it("acepta el mismo correo", () => {
    expect(esCorreoPermitido("edgar@example.com", permitido)).toBe(true);
  });

  it("ignora mayúsculas y espacios alrededor, en ambos lados", () => {
    expect(esCorreoPermitido("  Edgar@Example.COM  ", permitido)).toBe(true);
    expect(esCorreoPermitido("edgar@example.com", "  EDGAR@example.com ")).toBe(true);
  });

  it("rechaza otro correo", () => {
    expect(esCorreoPermitido("otro@example.com", permitido)).toBe(false);
    expect(esCorreoPermitido("edgar@example.com.mx", permitido)).toBe(false);
  });

  it("rechaza todo si la variable no está", () => {
    expect(esCorreoPermitido("edgar@example.com", undefined)).toBe(false);
    expect(esCorreoPermitido("edgar@example.com", null)).toBe(false);
  });

  it("rechaza todo si la variable está vacía o sólo tiene espacios", () => {
    expect(esCorreoPermitido("edgar@example.com", "")).toBe(false);
    expect(esCorreoPermitido("", "")).toBe(false);
    expect(esCorreoPermitido("   ", "   ")).toBe(false);
  });

  it("rechaza un correo vacío", () => {
    expect(esCorreoPermitido("", permitido)).toBe(false);
    expect(esCorreoPermitido("   ", permitido)).toBe(false);
    expect(esCorreoPermitido(undefined, permitido)).toBe(false);
  });
});
