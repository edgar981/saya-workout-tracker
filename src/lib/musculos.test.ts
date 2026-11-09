import { describe, it, expect } from "vitest";
import type { GrupoMuscular } from "@/lib/db/types";
import { GRUPOS, GRUPOS_SEMILLA, gruposSemilla, nombresDirectos, sinGrupo } from "@/lib/musculos";

// `Record<GrupoMuscular, true>` obliga a tsc a que esta lista sea exactamente la
// unión: si un grupo entra o sale del tipo, este archivo deja de compilar.
const TODOS: Record<GrupoMuscular, true> = {
  pecho: true,
  espalda: true,
  hombros: true,
  biceps: true,
  triceps: true,
  antebrazo: true,
  cuadriceps: true,
  isquios: true,
  gluteos: true,
  pantorrillas: true,
  abdomen: true,
};

describe("§12.2 GRUPOS", () => {
  it("§12.2: once grupos, uno por cada GrupoMuscular, cada uno con nombre", () => {
    expect(GRUPOS).toHaveLength(11);
    expect(GRUPOS.map((g) => g.id).sort()).toEqual(Object.keys(TODOS).sort());
    for (const g of GRUPOS) expect(g.nombre.length).toBeGreaterThan(0);
  });
});

describe("§12.6 GRUPOS_SEMILLA", () => {
  const ids = new Set<string>(GRUPOS.map((g) => g.id));

  it("§12.6: cada clasificación usa sólo grupos de GRUPOS y roles directo/indirecto", () => {
    for (const [ejercicio, grupos] of Object.entries(GRUPOS_SEMILLA)) {
      for (const [g, rol] of Object.entries(grupos)) {
        expect(ids.has(g), `${ejercicio}: grupo ${g}`).toBe(true);
        expect(["directo", "indirecto"], `${ejercicio}: rol de ${g}`).toContain(rol);
      }
    }
  });

  it("§12.6: toda clasificación semilla tiene al menos un grupo directo", () => {
    for (const [ejercicio, grupos] of Object.entries(GRUPOS_SEMILLA)) {
      expect(Object.values(grupos), ejercicio).toContain("directo");
    }
  });

  it("§12.6: gruposSemilla devuelve una COPIA (mutarla no cambia la tabla)", () => {
    const antes = JSON.stringify(GRUPOS_SEMILLA["ex-close-grip-bench-press"]);
    const copia = gruposSemilla("ex-close-grip-bench-press");
    expect(copia).toEqual(GRUPOS_SEMILLA["ex-close-grip-bench-press"]);
    copia.pecho = "directo";
    delete copia.triceps;
    expect(JSON.stringify(GRUPOS_SEMILLA["ex-close-grip-bench-press"])).toBe(antes);
    expect(gruposSemilla("ex-close-grip-bench-press").triceps).toBe("directo");
  });

  it("§12.5: un id desconocido (ejercicio creado por el usuario) nace sin grupo", () => {
    expect(gruposSemilla("1f3c-uuid-cualquiera")).toEqual({});
  });
});

describe("§12.2 nombresDirectos / sinGrupo", () => {
  it("§12.2: nombresDirectos lista sólo los directos, en el orden de GRUPOS", () => {
    expect(nombresDirectos({ pecho: "directo", hombros: "indirecto" })).toBe("Pecho");
    expect(nombresDirectos({ antebrazo: "directo", biceps: "directo" })).toBe("Bíceps, Antebrazo");
    expect(nombresDirectos({ hombros: "indirecto" })).toBe("");
    expect(nombresDirectos({})).toBe("");
  });

  it("§12.4: sinGrupo es verdadero para undefined y objeto vacío, falso con algún rol", () => {
    expect(sinGrupo(undefined)).toBe(true);
    expect(sinGrupo({})).toBe(true);
    expect(sinGrupo({ pecho: "indirecto" })).toBe(false);
  });
});
