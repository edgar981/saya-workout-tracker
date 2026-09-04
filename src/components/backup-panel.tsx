"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudUpload, RotateCw, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TABLE_NAMES } from "@/lib/db/db";
import { restoreFromServerPayload, type ImportOutcome } from "@/lib/db/backup";
import {
  backupNow,
  fetchLatest,
  fetchSnapshotPayload,
  getBackupState,
  listSnapshots,
  subscribeBackupState,
} from "@/lib/backup/client";
import type { SnapshotMeta } from "@/lib/backup/protocol";

/** Ventana en la que el botón de restaurar queda armado (como el descarte). */
const ARMED_MS = 5000;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countsLine(counts: Record<string, number>): string {
  return TABLE_NAMES.map((name) => `${name} ${counts[name] ?? 0}`).join(" · ");
}

/**
 * Estado del respaldo automático en /datos. Muestra la última copia DEL
 * SERVIDOR (lo que importa: sin esto el respaldo es una creencia, no un hecho),
 * el estado local (al día / pendiente / falló), un botón para forzar el push, y
 * la restauración desde el servidor — que entra por el MISMO camino de import.
 */
export function BackupPanel({
  onRestoreStart,
  onRestoreDone,
}: {
  onRestoreStart: () => void;
  onRestoreDone: (outcome: ImportOutcome) => void;
}) {
  const state = useSyncExternalStore(subscribeBackupState, getBackupState, getBackupState);

  const [latest, setLatest] = useState<SnapshotMeta | null | undefined>(undefined);
  const [latestErr, setLatestErr] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  const [showRestore, setShowRestore] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refreshLatest = async () => {
    setLatestErr(null);
    try {
      setLatest(await fetchLatest());
    } catch (err) {
      setLatest(null);
      setLatestErr(err instanceof Error ? err.message : "No se pudo consultar el servidor.");
    }
  };

  // Consulta inicial. El estado se toca SOLO tras el await (nada síncrono en el
  // cuerpo del efecto), y un guard evita setState tras desmontar.
  useEffect(() => {
    let cancelled = false;
    fetchLatest()
      .then((l) => {
        if (!cancelled) setLatest(l);
      })
      .catch((err) => {
        if (cancelled) return;
        setLatest(null);
        setLatestErr(err instanceof Error ? err.message : "No se pudo consultar el servidor.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!armedId) return;
    const t = setTimeout(() => setArmedId(null), ARMED_MS);
    return () => clearTimeout(t);
  }, [armedId]);

  const doBackup = async () => {
    setPushing(true);
    const result = await backupNow();
    setPushing(false);
    if (result.ok) void refreshLatest();
  };

  const toggleRestore = async () => {
    const next = !showRestore;
    setShowRestore(next);
    if (next && snapshots === null && !loadingList) {
      setLoadingList(true);
      setListErr(null);
      try {
        setSnapshots(await listSnapshots());
      } catch (err) {
        setListErr(err instanceof Error ? err.message : "No se pudo listar el servidor.");
      } finally {
        setLoadingList(false);
      }
    }
  };

  const doRestore = async (id: string) => {
    setRestoringId(id);
    onRestoreStart();
    try {
      const payload = await fetchSnapshotPayload(id);
      onRestoreDone(await restoreFromServerPayload(payload));
    } catch (err) {
      onRestoreDone({
        ok: false,
        autoExportFilename: null,
        error: err instanceof Error ? err.message : "No se pudo descargar el snapshot.",
      });
    } finally {
      setRestoringId(null);
      setArmedId(null);
    }
  };

  const chip = state.pending
    ? state.lastError
      ? { label: "Falló", cls: "text-destructive border-destructive/50" }
      : { label: "Pendiente", cls: "text-foreground border-foreground/30" }
    : { label: "Al día", cls: "text-muted-foreground border-border" };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Server className="size-4" />
        <span className="text-sm font-medium">Respaldo automático</span>
        <span className={cn("ml-auto rounded-full border px-2 py-0.5 text-xs", chip.cls)}>
          {chip.label}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">
        Al cerrar una sesión se empuja un volcado completo al servidor. Si no hay señal, queda
        pendiente y se reintenta al abrir la app. Dexie sigue siendo la fuente de verdad.
      </p>

      {state.pending && state.lastError && (
        <p className="text-destructive text-xs">Último intento: {state.lastError}</p>
      )}

      {/* Última copia: el dato que hace del respaldo un hecho verificable. */}
      <div className="bg-muted/40 rounded-md px-3 py-2 text-xs">
        {latest === undefined ? (
          <span className="text-muted-foreground">Consultando el servidor…</span>
        ) : latestErr ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">No se pudo consultar el servidor: {latestErr}</span>
            {state.last && (
              <span className="text-muted-foreground">
                Última conocida (local): {fmtDate(state.last.at)} · schema {state.last.schema_version}
              </span>
            )}
          </div>
        ) : latest === null ? (
          <span className="text-muted-foreground">Aún no hay ningún respaldo en el servidor.</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Última copia: {fmtDate(latest.creado_en)}</span>
            <span className="text-muted-foreground">schema_version {latest.schema_version}</span>
            <span className="text-muted-foreground font-mono break-words">{countsLine(latest.counts)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" disabled={pushing} onClick={() => void doBackup()}>
          <CloudUpload /> {pushing ? "Respaldando…" : "Respaldar ahora"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void toggleRestore()}>
          <RotateCw /> Restaurar del servidor
        </Button>
      </div>

      {showRestore && (
        <div className="flex flex-col gap-2 border-t pt-2">
          <p className="text-muted-foreground text-xs">
            Restaurar reemplaza todo, igual que desde archivo: antes descarga un respaldo del estado
            actual (esa es la guarda) y valida el schema_version. Toca dos veces para confirmar.
          </p>
          {loadingList && <p className="text-muted-foreground text-xs">Cargando snapshots…</p>}
          {listErr && <p className="text-destructive text-xs">{listErr}</p>}
          {snapshots && snapshots.length === 0 && (
            <p className="text-muted-foreground text-xs">No hay snapshots en el servidor.</p>
          )}
          {snapshots?.map((snap) => (
            <div key={snap.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium">{fmtDate(snap.creado_en)}</span>
                <span className="text-muted-foreground truncate text-[11px]">
                  s{snap.schema_version} · {countsLine(snap.counts)}
                </span>
              </div>
              <Button
                variant={armedId === snap.id ? "destructive" : "outline"}
                size="sm"
                className="ml-auto shrink-0"
                disabled={restoringId !== null}
                onClick={() => (armedId === snap.id ? void doRestore(snap.id) : setArmedId(snap.id))}
              >
                {restoringId === snap.id
                  ? "Restaurando…"
                  : armedId === snap.id
                    ? "Tocar de nuevo"
                    : "Restaurar"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
