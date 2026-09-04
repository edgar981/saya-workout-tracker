import { buildBackup } from "@/lib/db/backup";
import type { SnapshotBody, SnapshotMeta } from "./protocol";

/**
 * Lado cliente del respaldo: arma el volcado, lo empuja al endpoint, y lleva en
 * localStorage si hay uno pendiente y cómo fue el último intento. Nada de esto
 * bloquea la app — un push fallido queda "pendiente" y se reintenta al abrir.
 *
 * El token viaja embebido en el bundle (NEXT_PUBLIC_*), a la vista de quien mire
 * el JavaScript. Es a propósito y proporcional (DECISIONES.md §9).
 */

const TOKEN = process.env.NEXT_PUBLIC_BACKUP_TOKEN ?? "";
const ENDPOINT = "/api/snapshot";
const HEADER = "x-backup-token";
const STORE_KEY = "saya:backup:state";

function authHeaders(extra?: Record<string, string>): HeadersInit {
  return { [HEADER]: TOKEN, ...extra };
}

export interface BackupState {
  /** Se debe un push (el último falló, o cerró una sesión sin red). */
  pending: boolean;
  /** Razón del último intento fallido, para mostrarla en /datos. */
  lastError: string | null;
  /** Metadata del último push exitoso, más cuándo se hizo (reloj del cliente). */
  last: (SnapshotMeta & { at: string }) | null;
}

const EMPTY: BackupState = { pending: false, lastError: null, last: null };

// ── Estado persistente + suscripción (para useSyncExternalStore) ──────────────

const listeners = new Set<() => void>();
let cached: BackupState | null = null;

function readRaw(): BackupState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BackupState>;
    return {
      pending: parsed.pending ?? false,
      lastError: parsed.lastError ?? null,
      last: parsed.last ?? null,
    };
  } catch {
    return EMPTY;
  }
}

export function getBackupState(): BackupState {
  if (cached === null) cached = readRaw();
  return cached;
}

function setBackupState(next: BackupState): void {
  cached = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      // localStorage lleno o bloqueado: el estado en memoria sigue sirviendo
      // esta sesión; el reintento al abrir se re-deriva del servidor de todos
      // modos.
    }
  }
  for (const fn of listeners) fn();
}

export function subscribeBackupState(fn: () => void): () => void {
  listeners.add(fn);
  // Otra pestaña (o el propio SW) puede tocar la clave: refrescar el cache.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) {
      cached = readRaw();
      fn();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

// ── Push ──────────────────────────────────────────────────────────────────────

export type PushResult = { ok: true; meta: SnapshotMeta } | { ok: false; error: string };

// Coalescer: si ya hay un push en vuelo, los llamados concurrentes reciben ese
// mismo. Sin esto, dos disparos casi simultáneos —el cierre de sesión y el
// evento `online`, o el doble efecto de StrictMode en dev— escriben dos
// snapshots idénticos. Un snapshot append-only duplicado no rompe nada, pero
// tampoco hace falta.
let inFlight: Promise<PushResult> | null = null;

/**
 * Empuja el estado ACTUAL completo. Se marca "pendiente" antes de la red, así
 * que si la app muere a mitad del push, el reintento al abrir lo cubre. Nunca
 * lanza: cualquier fallo se traduce a `{ ok: false }` y a estado pendiente.
 */
export function backupNow(): Promise<PushResult> {
  if (inFlight) return inFlight;
  inFlight = pushSnapshot();
  return inFlight.finally(() => {
    inFlight = null;
  });
}

async function pushSnapshot(): Promise<PushResult> {
  const prev = getBackupState();
  setBackupState({ ...prev, pending: true });

  try {
    const backup = (await buildBackup()) as unknown as SnapshotBody;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(backup),
    });

    if (!res.ok) {
      const error = await errorMessage(res);
      setBackupState({ ...getBackupState(), pending: true, lastError: error });
      return { ok: false, error };
    }

    const meta = (await res.json()) as SnapshotMeta;
    setBackupState({ pending: false, lastError: null, last: { ...meta, at: new Date().toISOString() } });
    return { ok: true, meta };
  } catch (err) {
    const error =
      err instanceof Error && err.message ? err.message : "Sin conexión con el servidor de respaldo.";
    setBackupState({ ...getBackupState(), pending: true, lastError: error });
    return { ok: false, error };
  }
}

/** Reintenta un push pendiente, solo si hay red. Silencioso: dispara y olvida. */
export function retryIfPending(): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (!getBackupState().pending) return;
  void backupNow();
}

async function errorMessage(res: Response): Promise<string> {
  if (res.status === 401) return "El servidor rechazó el token (401).";
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    // sin cuerpo JSON
  }
  return `El servidor respondió ${res.status}.`;
}

// ── Lecturas para /datos ──────────────────────────────────────────────────────

/** Metadata del último snapshot en el SERVIDOR (no el cache local). */
export async function fetchLatest(): Promise<SnapshotMeta | null> {
  const res = await fetch(`${ENDPOINT}/latest`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(await errorMessage(res));
  const body = (await res.json()) as { latest: SnapshotMeta | null };
  return body.latest;
}

/** Lista de snapshots recientes (metadata) para elegir cuál restaurar. */
export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const res = await fetch(ENDPOINT, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(await errorMessage(res));
  const body = (await res.json()) as { snapshots: SnapshotMeta[] };
  return body.snapshots;
}

/** Payload completo de un snapshot: el `{ manifest, data }` para restaurar. */
export async function fetchSnapshotPayload(id: string): Promise<unknown> {
  const res = await fetch(`${ENDPOINT}/${id}`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
