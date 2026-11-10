import { describe, expect, it } from "vitest";
import { ESTADO_VACIO, leerEstado, tras401, trasEntrar, trasExito, trasFallo, type BackupState } from "./estado";
import type { SnapshotMeta } from "./protocol";

const META = { id: "s1", creado_en: "2026-11-09T10:00:00.000Z", schema_version: 4, counts: {} } as unknown as SnapshotMeta;

const AL_DIA: BackupState = { pending: false, lastError: null, last: { ...META, at: "2026-11-09T10:00:01.000Z" }, sinSesion: false };

describe("estado del respaldo", () => {
  it("un 401 deja pendiente, marca «sin sesión» y no guarda mensaje", () => {
    const s = tras401({ ...AL_DIA, lastError: "x" });
    expect(s.pending).toBe(true);
    expect(s.sinSesion).toBe(true);
    expect(s.lastError).toBeNull();
    expect(s.last).toEqual(AL_DIA.last);
  });

  it("cualquier otro fallo deja pendiente y desmarca «sin sesión»", () => {
    const s = trasFallo(tras401(AL_DIA), "El servidor respondió 500.");
    expect(s.pending).toBe(true);
    expect(s.sinSesion).toBe(false);
    expect(s.lastError).toBe("El servidor respondió 500.");
  });

  it("un push exitoso deja todo al día y desmarca «sin sesión»", () => {
    const s = trasExito(META, "2026-11-09T11:00:00.000Z");
    expect(s).toEqual({
      pending: false,
      lastError: null,
      last: { ...META, at: "2026-11-09T11:00:00.000Z" },
      sinSesion: false,
    });
  });

  it("un estado guardado antes del campo se lee como «sin sesión» desmarcado", () => {
    const viejo = { pending: true, lastError: "x", last: null } as Partial<BackupState>;
    expect(leerEstado(viejo)).toEqual({ pending: true, lastError: "x", last: null, sinSesion: false });
    expect(leerEstado(undefined)).toEqual(ESTADO_VACIO);
  });

  it("entrar desmarca «sin sesión» y conserva lo pendiente", () => {
    const s = trasEntrar(tras401(AL_DIA));
    expect(s.sinSesion).toBe(false);
    expect(s.pending).toBe(true);
  });
});
