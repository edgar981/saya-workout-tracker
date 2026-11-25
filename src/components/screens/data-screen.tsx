"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { BackupPanel } from "@/components/backup-panel";
import { CuentaPanel } from "@/components/cuenta-panel";
import { exportarServidor } from "@/lib/datos/exportar";
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

type EstadoServidor = { kind: "idle" } | { kind: "ok"; archivo: string } | { kind: "failed" };

export default function DataScreen() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [servidor, setServidor] = useState<EstadoServidor>({ kind: "idle" });
  const [pidiendoServidor, setPidiendoServidor] = useState(false);
  const pidiendoRef = useRef(false);
  const [integridad, setIntegridad] = useState<IntegrityReport | null>(null);
  const [segmentos, setSegmentos] = useState<SegmentDiagnostic | null>(null);
  const [refrescarRespaldo, setRefrescarRespaldo] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const counts = useLiveQuery(async () => {
    const entries = await Promise.all(
      TABLE_NAMES.map(async (name) => [name, await db.table(name).count()] as const),
    );
    return entries;
  }, []);

  /** Sólo la parte del servidor (Dinero y Tiempo): un solo vuelo a la vez. */
  const exportarDelServidor = async () => {
    if (pidiendoRef.current) return;
    pidiendoRef.current = true;
    setPidiendoServidor(true);
    try {
      const r = await exportarServidor();
      setServidor(r.ok ? { kind: "ok", archivo: r.archivo } : { kind: "failed" });
    } finally {
      pidiendoRef.current = false;
      setPidiendoServidor(false);
    }
  };

  const doExport = async () => {
    setStatus({ kind: "working", label: "Exportando…" });
    setServidor({ kind: "idle" });
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
    // Salga como salga el de Dexie.
    await exportarDelServidor();
  };

  const doImport = async (file: File) => {
    setStatus({ kind: "working", label: "Respaldando el estado actual antes de restaurar…" });
    const outcome = await importBackup(file);
    setStatus(outcome.ok ? { kind: "imported", outcome } : { kind: "failed", outcome });
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Respaldo" subtitulo={`schema_version ${SCHEMA_VERSION}`} empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <p className="dek">
            Volcado crudo de las nueve tablas, solo legible por esta app. Existe porque cada migración
            de esquema corre contra la única copia de los datos. No sirve para compartir.
          </p>

          <div className="mt-2.5 rounded-2xl shadow-[inset_0_0_0_1px_var(--color-hair)]">
            {(counts ?? []).map(([name, count]) => (
              <div
                key={name}
                className="flex min-h-9 items-center justify-between border-t border-hair px-3.5 first:border-t-0"
              >
                <span className="font-mono text-[12.5px] leading-[18px] font-medium text-ink2">
                  {name}
                </span>
                <span className="text-ink tabular-nums">{count}</span>
              </div>
            ))}
          </div>

          <section className="sec">
            <div className="sec-cab">
              <h2 className="kicker">Cuenta</h2>
            </div>
            <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
              <CuentaPanel onEntro={() => setRefrescarRespaldo((n) => n + 1)} />
            </div>
          </section>

          <BackupPanel
            refrescar={refrescarRespaldo}
            onRestoreStart={() =>
              setStatus({ kind: "working", label: "Respaldando el estado actual antes de restaurar…" })
            }
            onRestoreDone={(outcome) =>
              setStatus(outcome.ok ? { kind: "imported", outcome } : { kind: "failed", outcome })
            }
          />

          <section className="sec">
            <div className="sec-cab">
              <h2 className="kicker">Archivo</h2>
            </div>
            <p className="mt-2 text-[13px] leading-[18px] text-ink2">
              Export/import a archivo. El servidor no lo reemplaza: es la copia que no depende de que el
              backend esté vivo.
            </p>

            <Button variant="secondary" className="mt-3 w-full" onClick={() => void doExport()}>
              Exportar
            </Button>

            <p className="mt-5 text-[13px] leading-[18px] text-ink2">
              Restaurar reemplaza todo: vacía las nueve tablas y reconstruye desde el archivo. Nunca
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
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => fileInput.current?.click()}
            >
              Restaurar desde archivo
            </Button>

            {status.kind === "working" && (
              <p className="mt-3 text-[15px] leading-[22px] text-ink2">{status.label}</p>
            )}

            {status.kind === "exported" && (
              <p className="mt-3 text-sm">
                Exportado a <span className="font-mono text-[12.5px]">{status.filename}</span>
              </p>
            )}

            {servidor.kind === "ok" && (
              <p className="mt-3 text-sm">
                Exportado a <span className="font-mono text-[12.5px]">{servidor.archivo}</span>
              </p>
            )}

            {servidor.kind === "failed" && (
              <>
                <ErrorEnLinea className="mt-3">Dinero y Tiempo no se exportaron.</ErrorEnLinea>
                <Button
                  variant="link"
                  aria-disabled={pidiendoServidor ? "true" : undefined}
                  onClick={() => void exportarDelServidor()}
                >
                  Reintentar
                </Button>
              </>
            )}

            {status.kind === "imported" && (
              <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-hair)]">
                <p className="mt-3 flex gap-2.5 text-sm leading-5 font-medium">
                  Restauración completa.
                </p>
                <p className="mt-1 text-[13px] leading-[18px] text-ink2">
                  Respaldo previo descargado como{" "}
                  <span className="font-mono">{status.outcome.autoExportFilename}</span>.
                </p>
                <p className="mt-1 text-[13px] leading-[18px] text-ink2">
                  Conteos verificados contra el manifiesto:{" "}
                  {Object.entries(status.outcome.counts)
                    .map(([name, n]) => `${name} ${n}`)
                    .join(" · ")}
                </p>
              </div>
            )}

            {status.kind === "failed" && (
              <ErrorEnLinea className="mt-3">
                <p>No se importó.</p>
                <p className="mt-0.5 block text-ink2">{status.outcome.error}</p>
                {status.outcome.autoExportFilename && (
                  <p className="mt-0.5 block text-ink2">
                    El respaldo previo sí se descargó:{" "}
                    <span className="font-mono">{status.outcome.autoExportFilename}</span>.
                  </p>
                )}
              </ErrorEnLinea>
            )}
          </section>

          <section className="sec">
            <div className="sec-cab">
              <h2 className="kicker">Integridad</h2>
            </div>
            <p className="mt-2 text-[13px] leading-[18px] text-ink2">
              El manifiesto del export verifica conteos, y un huérfano no altera ningún conteo: la fila
              sigue ahí, solo apunta a algo que ya no existe. Esto lo hace detectable. Solo reporta, no
              repara.
            </p>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={async () => setIntegridad(await checkIntegrity())}
            >
              Verificar integridad
            </Button>

            {integridad &&
              (integridad.total === 0 ? (
                <p className="mt-3 flex gap-2.5 text-sm leading-5 font-medium">
                  Sin problemas de integridad.
                </p>
              ) : (
                <ErrorEnLinea className="mt-3">
                  <p>{integridad.total} problemas de integridad.</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-[13px] leading-[18px] text-ink2">
                    <li>SetLog sin instancia: {integridad.setLogsSinInstancia.length}</li>
                    <li>SessionExercise sin sesión: {integridad.sessionExercisesSinSesion.length}</li>
                    <li>SessionExercise sin slot: {integridad.sessionExercisesSinSlot.length}</li>
                    <li>
                      SessionExercise sin ejercicio: {integridad.sessionExercisesSinEjercicio.length}
                    </li>
                    <li>Sesiones activas duplicadas: {integridad.sesionesActivasDeMas}</li>
                    <li>RoutineDay sin mesociclo: {integridad.routineDaysSinMesociclo.length}</li>
                    <li>Mesociclos activos duplicados: {integridad.mesociclosActivosDeMas}</li>
                  </ul>
                </ErrorEnLinea>
              ))}

            <p className="mt-5 text-[13px] leading-[18px] text-ink2">
              Diagnóstico (solo lectura): busca series registradas con segmentos
              (segment_index &gt; 0). Sirve para distinguir giant sets legítimos de
              lados guardados como segmentos antes de que existiera el campo de lado.
              No convierte nada.
            </p>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={async () => setSegmentos(await diagnoseSegmentSides())}
            >
              Diagnóstico: lados en segmentos
            </Button>

            {segmentos &&
              (segmentos.exercises.length === 0 ? (
                <p className="mt-3 flex gap-2.5 text-sm leading-5 font-medium">
                  Ninguna serie usa segmentos.
                </p>
              ) : (
                <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--color-hair)]">
                  <div className="flex flex-col gap-3">
                    <p className="text-[13px] leading-[18px] text-ink2">
                      {segmentos.totalSetLogsConSegmento} filas con segment_index &gt; 0.
                    </p>
                    {segmentos.exercises.map((ex) => (
                      <div
                        key={ex.exerciseId}
                        className="flex flex-col gap-1 border-t border-hair pt-2 first:border-t-0 first:pt-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ex.nombre}</span>
                          <span className="text-[13px] text-ink2">{ex.unitType}</span>
                          <span
                            className={
                              ex.todosDosSegmentos
                                ? "ml-auto text-[13px] text-ink"
                                : "ml-auto text-[13px] text-ink2"
                            }
                          >
                            {ex.todosDosSegmentos
                              ? "candidato a lados (2 seg/serie)"
                              : `giant set (hasta ${ex.maxSegmentosEnUnaSerie} seg) — excluir`}
                          </span>
                        </div>
                        <span className="text-[13px] text-ink2">
                          {ex.gruposConSegmentos} series con segmentos
                        </span>
                        <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-ink2">
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
                </div>
              ))}
          </section>
        </main>
      </Hoja>
    </>
  );
}
