import { describe, expect, it, vi } from "vitest";

import { abrirAgente, alAbrirAgente } from "./abrir";

describe("abrirAgente", () => {
  it("dos oyentes reciben un abrirAgente(); tras la baja de uno, sólo el otro", () => {
    const a = vi.fn();
    const b = vi.fn();
    const bajaA = alAbrirAgente(a);
    const bajaB = alAbrirAgente(b);
    abrirAgente();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    bajaA();
    abrirAgente();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    bajaB();
  });

  it("sin oyentes no falla", () => {
    expect(() => abrirAgente()).not.toThrow();
  });
});
