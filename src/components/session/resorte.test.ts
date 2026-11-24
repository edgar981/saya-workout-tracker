import { describe, expect, it } from "vitest";

import { dampingDe, destinoPager, goma, proyectar, resorte } from "@/components/session/resorte";

describe("resorte", () => {
  it("llega quieto al destino y no se pasa con damping 1", () => {
    let x = 0;
    let v = 0;
    let maximo = 0;
    let quieto = false;
    for (let i = 0; i < 600 && !quieto; i += 1) {
      const p = resorte(x, v, 100, 1 / 60, { damping: 1, response: 0.35 });
      x = p.x;
      v = p.v;
      quieto = p.quieto;
      maximo = Math.max(maximo, x);
    }
    expect(quieto).toBe(true);
    expect(x).toBe(100);
    expect(v).toBe(0);
    expect(maximo).toBeLessThanOrEqual(100.5);
  });

  it("topa dt en 0,064 s: un salto enorme no explota", () => {
    const p = resorte(0, 0, 100, 10);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(p.x).toBeLessThan(100.5);
  });

  it("un resorte que rebota (damping 0,86) también termina quieto", () => {
    let x = 0;
    let v = 2000;
    let quieto = false;
    for (let i = 0; i < 900 && !quieto; i += 1) {
      const p = resorte(x, v, 0, 1 / 60, { damping: 0.86, response: 0.3 });
      x = p.x;
      v = p.v;
      quieto = p.quieto;
    }
    expect(quieto).toBe(true);
    expect(x).toBe(0);
  });
});

describe("proyectar y goma", () => {
  it("proyectar(1000) ≈ 499", () => {
    expect(proyectar(1000)).toBeCloseTo(499, 0);
  });

  it("goma crece menos que lineal y nunca supera d", () => {
    const d = 375;
    expect(goma(0, d)).toBe(0);
    expect(goma(50, d)).toBeLessThan(50);
    expect(goma(100, d) / 100).toBeLessThan(goma(50, d) / 50);
    expect(goma(1_000_000, d)).toBeLessThan(d);
    expect(goma(-80, d)).toBeCloseTo(-goma(80, d));
  });
});

describe("destinoPager", () => {
  const base = { ancho: 375, total: 5 };

  it("nunca salta más de una tarjeta", () => {
    expect(destinoPager({ ...base, x: -375 * 2, vx: -5000, indice: 2 })).toBe(3);
    expect(destinoPager({ ...base, x: -375 * 2, vx: 5000, indice: 2 })).toBe(1);
    expect(destinoPager({ ...base, x: -375 * 4, vx: 0, indice: 2 })).toBe(3);
  });

  it("respeta los extremos", () => {
    expect(destinoPager({ ...base, x: 120, vx: 3000, indice: 0 })).toBe(0);
    expect(destinoPager({ ...base, x: -375 * 4 - 120, vx: -3000, indice: 4 })).toBe(4);
  });

  it("sin velocidad se queda en la tarjeta más cercana", () => {
    expect(destinoPager({ ...base, x: -375 - 100, vx: 0, indice: 1 })).toBe(1);
    expect(destinoPager({ ...base, x: -375 - 250, vx: 0, indice: 1 })).toBe(2);
  });
});

describe("dampingDe", () => {
  it("rebota un poco si va rápido", () => {
    expect(dampingDe(400)).toBe(0.86);
    expect(dampingDe(-400)).toBe(0.86);
    expect(dampingDe(100)).toBe(1);
  });
});
