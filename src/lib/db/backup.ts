import { SCHEMA_VERSION, TABLE_NAMES, allTables, db, type TableName } from "./db";

/**
 * Export / import de recuperación. Autoridad: DECISIONES.md §5 y §6.
 *
 * Esto NO es exportar-para-compartir. Es un volcado crudo de las ocho tablas,
 * feo, completo y solo legible por esta app. Existe porque cada migración de
 * esquema de Dexie corre contra la única copia de los datos (D2), y sin una
 * segunda copia un deploy con cambio de esquema es una apuesta.
 */

export interface BackupManifest {
  schema_version: number;
  exported_at: string;
  counts: Record<TableName, number>;
}

export interface BackupFile {
  manifest: BackupManifest;
  data: Record<TableName, unknown[]>;
}

export async function buildBackup(): Promise<BackupFile> {
  const data = {} as Record<TableName, unknown[]>;
  const counts = {} as Record<TableName, number>;

  await db.transaction("r", allTables(), async () => {
    for (const name of TABLE_NAMES) {
      const rows = await db.table(name).toArray();
      data[name] = rows;
      counts[name] = rows.length;
    }
  });

  return {
    manifest: {
      schema_version: SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      counts,
    },
    data,
  };
}

function backupFilename(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}-${stamp}.json`;
}

function downloadJSON(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ExportResult {
  filename: string;
  manifest: BackupManifest;
}

export async function exportNow(prefix = "saya-tracker"): Promise<ExportResult> {
  const backup = await buildBackup();
  const filename = backupFilename(prefix);
  downloadJSON(backup, filename);
  return { filename, manifest: backup.manifest };
}

// ── Import ──────────────────────────────────────────────────────────────────

export type ImportOutcome =
  | { ok: true; autoExportFilename: string; counts: Record<TableName, number> }
  | { ok: false; autoExportFilename: string | null; error: string };

function parseBackup(raw: string): BackupFile {
  const parsed = JSON.parse(raw) as unknown;

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("El archivo no contiene un objeto JSON.");
  }
  const candidate = parsed as Partial<BackupFile>;

  if (!candidate.manifest || typeof candidate.manifest.schema_version !== "number") {
    throw new Error("El archivo no tiene un manifiesto con schema_version. No parece un export de esta app.");
  }
  if (!candidate.data || typeof candidate.data !== "object") {
    throw new Error("El archivo no tiene bloque `data`.");
  }

  for (const name of TABLE_NAMES) {
    if (!Array.isArray(candidate.data[name])) {
      throw new Error(`El archivo no trae la tabla "${name}". Un backup incompleto no se restaura a medias.`);
    }
    if (typeof candidate.manifest.counts?.[name] !== "number") {
      throw new Error(`El manifiesto no declara el conteo de "${name}".`);
    }
  }

  return candidate as BackupFile;
}

/**
 * Semántica de REEMPLAZO TOTAL, nunca merge. Un merge contra una base a medio
 * migrar es justo el estado del que estás tratando de escapar.
 *
 * Secuencia obligatoria:
 *   1. auto-export del estado actual, antes de tocar nada;
 *   2. validar schema_version — si difiere, abortar sin escribir;
 *   3. vaciar y reconstruir las ocho tablas en UNA sola transacción;
 *   4. verificar conteos contra el manifiesto; si no cuadran, throw → Dexie
 *      revierte la transacción entera.
 *
 * La guarda no es un modal: es el auto-export del paso 1.
 */
export async function importBackup(file: File): Promise<ImportOutcome> {
  // 1 ──────────────────────────────────────────────────────────────────────
  let autoExportFilename: string;
  try {
    autoExportFilename = (await exportNow("saya-tracker-pre-import")).filename;
  } catch {
    return {
      ok: false,
      autoExportFilename: null,
      error:
        "No se pudo generar el respaldo previo, así que no se importó nada. El import solo corre si antes se pudo bajar el estado actual.",
    };
  }

  // 2 ──────────────────────────────────────────────────────────────────────
  let backup: BackupFile;
  try {
    backup = parseBackup(await file.text());
  } catch (err) {
    return {
      ok: false,
      autoExportFilename,
      error: err instanceof Error ? err.message : "El archivo no se pudo leer.",
    };
  }

  if (backup.manifest.schema_version !== SCHEMA_VERSION) {
    return {
      ok: false,
      autoExportFilename,
      error:
        `El archivo fue exportado con schema_version ${backup.manifest.schema_version} y esta app corre ${SCHEMA_VERSION}. ` +
        "No se tocó Dexie: no se intenta migrar durante un restore. " +
        `Revierte el deploy a la versión que generó el archivo, restaura ahí, arregla lo que haya que arreglar y vuelve a desplegar.`,
    };
  }

  // 3 y 4 ──────────────────────────────────────────────────────────────────
  try {
    await db.transaction("rw", allTables(), async () => {
      for (const name of TABLE_NAMES) {
        await db.table(name).clear();
      }
      for (const name of TABLE_NAMES) {
        const rows = backup.data[name];
        if (rows.length > 0) await db.table(name).bulkAdd(rows);
      }
      for (const name of TABLE_NAMES) {
        const expected = backup.manifest.counts[name];
        const actual = await db.table(name).count();
        if (actual !== expected) {
          throw new Error(
            `La tabla "${name}" quedó con ${actual} filas y el manifiesto declara ${expected}. ` +
              "Se revirtió la restauración completa: Dexie quedó como estaba antes del import.",
          );
        }
      }
    });
  } catch (err) {
    return {
      ok: false,
      autoExportFilename,
      error: err instanceof Error ? err.message : "La restauración falló y se revirtió.",
    };
  }

  return { ok: true, autoExportFilename, counts: backup.manifest.counts };
}
