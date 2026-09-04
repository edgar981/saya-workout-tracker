"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Download, Layers, Stethoscope, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BackupPanel } from "@/components/backup-panel";
import { exportNow, importBackup, type ImportOutcome } from "@/lib/db/backup";
import { SCHEMA_VERSION, TABLE_NAMES, db } from "@/lib/db/db";
import { checkIntegrity, type IntegrityReport } from "@/lib/db/integrity";
import { diagnoseSegmentSides, type SegmentDiagnostic } from "@/lib/db/segment-diagnostic";

type Status =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "exported"; filename: string }
  | { kind: "imported"; outcome: Extract<ImportOutcome, { ok: true }> }
  | { kind: "failed"; outcome: Extract<ImportOutcome, { ok: false }> };

export default function DataScreen() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [integridad, setIntegridad] = useState<IntegrityReport | null>(null);
  const [segmentos, setSegmentos] = useState<SegmentDiagnostic | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const counts = useLiveQuery(async () => {
    const entries = await Promise.all(
      TABLE_NAMES.map(async (name) => [name, await db.table(name).count()] as const),
    );
    return entries;
  }, []);

  const doExport = async () => {
    setStatus({ kind: "working", label: "Exportando…" });
    try {
      const result = await exportNow();
      setStatus({ kind: "exported", filename: result.filename });
    } catch (err) {
      setStatus({
        kind: "failed",
        outcome: {
          ok: false,
          autoExportFilename: null,
          error: err instanceof Error ? err.message : "El export falló.",
        },
      });
    }
  };

  const doImport = async (file: File) => {
    setStatus({ kind: "working", label: "Respaldando el estado actual antes de restaurar…" });
    const outcome = await importBackup(file);
    setStatus(outcome.ok ? { kind: "imported", outcome } : { kind: "failed", outcome });
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Respaldo</h1>
        <span className="text-muted-foreground ml-auto text-xs">
          schema_version {SCHEMA_VERSION}
        </span>
      </header>

      <p className="text-muted-foreground text-sm">
        Volcado crudo de las ocho tablas, solo legible por esta app. Existe porque cada migración
        de esquema corre contra la única copia de los datos. No sirve para compartir.
      </p>

      <div className="rounded-lg border">
        {(counts ?? []).map(([name, count]) => (
          <div key={name} className="flex items-center justify-between border-b px-3 py-2 last:border-b-0">
            <span className="font-mono text-xs">{name}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
          </div>
        ))}
      </div>

      <BackupPanel
        onRestoreStart={() =>
          setStatus({ kind: "working", label: "Respaldando el estado actual antes de restaurar…" })
        }
        onRestoreDone={(outcome) =>
          setStatus(outcome.ok ? { kind: "imported", outcome } : { kind: "failed", outcome })
        }
      />

      <Separator />

      <p className="text-muted-foreground text-xs">
        Export/import a archivo. El servidor no lo reemplaza: es la copia que no depende de que el
        backend esté vivo.
      </p>

      <Button size="lg" onClick={() => void doExport()}>
        <Download /> Exportar
      </Button>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">
          Restaurar reemplaza todo: vacía las ocho tablas y reconstruye desde el archivo. Nunca
          fusiona. Antes de tocar nada se descarga un respaldo del estado actual — esa es la
          guarda, no un cuadro de confirmación.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file);
          }}
        />
        <Button variant="outline" size="lg" onClick={() => fileInput.current?.click()}>
          <Upload /> Restaurar desde archivo
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">
          El manifiesto del export verifica conteos, y un huérfano no altera ningún conteo: la fila
          sigue ahí, solo apunta a algo que ya no existe. Esto lo hace detectable. Solo reporta, no
          repara.
        </p>
        <Button
          variant="outline"
          size="lg"
          onClick={async () => setIntegridad(await checkIntegrity())}
        >
          <Stethoscope /> Verificar integridad
        </Button>
      </div>

      {integridad && (
        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            integridad.total > 0 && "border-destructive/50",
          )}
        >
          {integridad.total === 0 ? (
            <p className="font-medium">Sin problemas de integridad.</p>
          ) : (
            <>
              <p className="text-destructive font-medium">
                {integridad.total} problemas de integridad.
              </p>
              <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
                <li>SetLog sin instancia: {integridad.setLogsSinInstancia.length}</li>
                <li>SessionExercise sin sesión: {integridad.sessionExercisesSinSesion.length}</li>
                <li>SessionExercise sin slot: {integridad.sessionExercisesSinSlot.length}</li>
                <li>
                  SessionExercise sin ejercicio: {integridad.sessionExercisesSinEjercicio.length}
                </li>
                <li>Sesiones activas duplicadas: {integridad.sesionesActivasDeMas}</li>
              </ul>
            </>
          )}
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">
          Diagnóstico (solo lectura): busca series registradas con segmentos
          (segment_index &gt; 0). Sirve para distinguir giant sets legítimos de
          lados guardados como segmentos antes de que existiera el campo de lado.
          No convierte nada.
        </p>
        <Button
          variant="outline"
          size="lg"
          onClick={async () => setSegmentos(await diagnoseSegmentSides())}
        >
          <Layers /> Diagnóstico: lados en segmentos
        </Button>
      </div>

      {segmentos && (
        <div className="rounded-lg border p-3 text-sm">
          {segmentos.exercises.length === 0 ? (
            <p className="font-medium">Ninguna serie usa segmentos.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-xs">
                {segmentos.totalSetLogsConSegmento} filas con segment_index &gt; 0.
              </p>
              {segmentos.exercises.map((ex) => (
                <div key={ex.exerciseId} className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ex.nombre}</span>
                    <span className="text-muted-foreground text-xs">{ex.unitType}</span>
                    <span
                      className={
                        ex.todosDosSegmentos
                          ? "text-foreground ml-auto text-xs"
                          : "text-muted-foreground ml-auto text-xs"
                      }
                    >
                      {ex.todosDosSegmentos
                        ? "candidato a lados (2 seg/serie)"
                        : `giant set (hasta ${ex.maxSegmentosEnUnaSerie} seg) — excluir`}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {ex.gruposConSegmentos} series con segmentos
                  </span>
                  <ul className="text-muted-foreground flex flex-col gap-0.5 font-mono text-[11px]">
                    {ex.grupos.map((g, i) => (
                      <li key={i}>
                        {g.fecha} · serie {g.setIndex}
                        {g.esExtra ? " (extra)" : ""}:{" "}
                        {g.segments
                          .map(
                            (seg) =>
                              `seg${seg.segment_index}=${seg.reps}×${seg.weight_value ?? "—"}${seg.side ? `/${seg.side}` : ""}`,
                          )
                          .join("  ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {status.kind === "working" && (
        <p className="text-muted-foreground text-sm">{status.label}</p>
      )}

      {status.kind === "exported" && (
        <p className="text-sm">
          Exportado a <span className="font-mono text-xs">{status.filename}</span>
        </p>
      )}

      {status.kind === "imported" && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">Restauración completa.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Respaldo previo descargado como{" "}
            <span className="font-mono">{status.outcome.autoExportFilename}</span>.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Conteos verificados contra el manifiesto:{" "}
            {Object.entries(status.outcome.counts)
              .map(([name, n]) => `${name} ${n}`)
              .join(" · ")}
          </p>
        </div>
      )}

      {status.kind === "failed" && (
        <div className="border-destructive/50 rounded-lg border p-3 text-sm">
          <p className="text-destructive font-medium">No se importó.</p>
          <p className="mt-1 text-xs">{status.outcome.error}</p>
          {status.outcome.autoExportFilename && (
            <p className="text-muted-foreground mt-1 text-xs">
              El respaldo previo sí se descargó:{" "}
              <span className="font-mono">{status.outcome.autoExportFilename}</span>.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
