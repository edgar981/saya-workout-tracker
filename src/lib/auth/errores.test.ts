import { describe, expect, it } from "vitest";
import { MENSAJE_NO_SE_PUDO, esSinRed } from "./errores";

describe("errores de la cuenta", () => {
  it("el texto único", () => {
    expect(MENSAJE_NO_SE_PUDO).toBe("No se pudo.");
  });

  it("sin red: los tres mensajes de fetch caído", () => {
    expect(esSinRed(new TypeError("Failed to fetch"))).toBe(true);
    expect(esSinRed(new TypeError("Load failed"))).toBe(true);
    expect(esSinRed(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
  });

  it("un error con status no es sin red", () => {
    expect(esSinRed({ message: "Failed to fetch", status: 500 })).toBe(false);
  });

  it("un TypeError con otro mensaje no es sin red", () => {
    expect(esSinRed(new TypeError("x is not a function"))).toBe(false);
  });

  it("algo que no es un objeto no es sin red", () => {
    expect(esSinRed(null)).toBe(false);
    expect(esSinRed(undefined)).toBe(false);
    expect(esSinRed("Failed to fetch")).toBe(false);
  });
});
