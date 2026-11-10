import type { SnapshotMeta } from "./protocol";

/**
 * Reglas puras del estado del respaldo (DECISIONES.md §9, §14). `client.ts` las
 * usa y las guarda en localStorage; aquí no hay red, ni storage, ni Dexie.
 */

export interface BackupState {
  /** Se debe un push (el último falló, o cerró una sesión sin red). */
  pending: boolean;
  /** Razón del último intento fallido, para mostrarla en /datos. */
  lastError: string | null;
  /** Metadata del último push exitoso, más cuándo se hizo (reloj del cliente). */
  last: (SnapshotMeta & { at: string }) | null;
  /**
   * El último intento recibió un 401: falta la sesión del login. No es un fallo
   * del respaldo sino una credencial que falta; mientras esté marcado el
   * reintento automático no se dispara.
   */
  sinSesion: boolean;
}

export const ESTADO_VACIO: BackupState = { pending: false, lastError: null, last: null, sinSesion: false };

export const MENSAJE_401 = "El servidor pide entrar (401).";

/** Lee lo guardado; un estado de antes de este campo se lee como «sin sesión» desmarcado. */
export function leerEstado(guardado: Partial<BackupState> | null | undefined): BackupState {
  return {
    pending: guardado?.pending ?? false,
    lastError: guardado?.lastError ?? null,
    last: guardado?.last ?? null,
    sinSesion: guardado?.sinSesion === true,
  };
}

/** Un 401: sigue pendiente y queda marcado «sin sesión». */
export function tras401(prev: BackupState): BackupState {
  return { ...prev, pending: true, lastError: MENSAJE_401, sinSesion: true };
}

/** Cualquier otro fallo: sigue pendiente y se desmarca «sin sesión». */
export function trasFallo(prev: BackupState, error: string): BackupState {
  return { ...prev, pending: true, lastError: error, sinSesion: false };
}

/** Un push exitoso: todo al día y sin «sin sesión». */
export function trasExito(meta: SnapshotMeta, at: string): BackupState {
  return { pending: false, lastError: null, last: { ...meta, at }, sinSesion: false };
}

/** Edgar entró: se desmarca «sin sesión»; lo pendiente se conserva. */
export function trasEntrar(prev: BackupState): BackupState {
  return { ...prev, sinSesion: false };
}
