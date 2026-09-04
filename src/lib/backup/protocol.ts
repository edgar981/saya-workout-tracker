import { TABLE_NAMES } from "@/lib/db/tables";

/**
 * Contrato del respaldo, isomórfico: lo importan tanto el cliente (para armar el
 * cuerpo del push) como la ruta de API (para validarlo). Sin Dexie, sin Node,
 * sin Prisma — solo tipos y una validación pura.
 *
 * El objeto que viaja es EXACTAMENTE el que produce el export de /datos: un
 * `{ manifest, data }` (ver `db/backup.ts` → BackupFile). El servidor lo guarda
 * entero como `payload`, e indexa `schema_version` y `counts` aparte.
 */

export interface SnapshotManifest {
  schema_version: number;
  exported_at: string;
  counts: Record<string, number>;
}

export interface SnapshotBody {
  manifest: SnapshotManifest;
  data: Record<string, unknown[]>;
}

/** Metadata de un snapshot, sin el payload. Lo que devuelven listar y latest. */
export interface SnapshotMeta {
  id: string;
  creado_en: string;
  schema_version: number;
  counts: Record<string, number>;
}

export type ValidationResult =
  | { ok: true; body: SnapshotBody; schema_version: number; counts: Record<string, number> }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Rechaza (sin guardar) si falta `manifest` o `data`, si no vienen las ocho
 * tablas, o si `counts` no coincide con la cantidad real de filas del `data`.
 *
 * Un snapshot con todas las tablas vacías (sessions: 0, setLogs: 0) es LEGÍTIMO
 * — es el estado tras un reset — y se acepta. La protección contra ese caso es
 * el append-only del servidor, no esta validación.
 */
export function validateSnapshotBody(raw: unknown): ValidationResult {
  if (!isRecord(raw)) return { ok: false, error: "El cuerpo no es un objeto JSON." };

  const manifest = raw.manifest;
  if (!isRecord(manifest)) return { ok: false, error: "Falta el manifiesto." };
  if (typeof manifest.schema_version !== "number") {
    return { ok: false, error: "El manifiesto no trae schema_version." };
  }
  if (!isRecord(manifest.counts)) return { ok: false, error: "El manifiesto no trae counts." };

  const data = raw.data;
  if (!isRecord(data)) return { ok: false, error: "Falta el bloque data (el volcado)." };

  const counts: Record<string, number> = {};
  for (const name of TABLE_NAMES) {
    const rows = data[name];
    if (!Array.isArray(rows)) {
      return { ok: false, error: `El volcado no trae la tabla "${name}".` };
    }
    const declared = manifest.counts[name];
    if (typeof declared !== "number") {
      return { ok: false, error: `El manifiesto no declara el conteo de "${name}".` };
    }
    if (declared !== rows.length) {
      return {
        ok: false,
        error: `Conteo inconsistente en "${name}": el manifiesto dice ${declared} y el volcado trae ${rows.length}.`,
      };
    }
    counts[name] = rows.length;
  }

  return {
    ok: true,
    body: raw as unknown as SnapshotBody,
    schema_version: manifest.schema_version,
    counts,
  };
}
