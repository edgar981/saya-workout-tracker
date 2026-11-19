"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { chipRespaldo } from "@/lib/ajustes-resumen";
import { cn } from "@/lib/utils";
import { TABLE_NAMES } from "@/lib/db/db";
import { restoreFromServerPayload, type ImportOutcome } from "@/lib/db/backup";
import { MENSAJE_NO_SE_PUDO } from "@/lib/auth/errores";
import {
  ErrorSinSesion,
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
  refrescar = 0,
}: {
  onRestoreStart: () => void;
  onRestoreDone: (outcome: ImportOutcome) => void;
  /** Sube cuando Edgar entra: se vuelve a consultar la última copia del servidor. */
  refrescar?: number;
}) {
  const state = useSyncExternalStore(subscribeBackupState, getBackupState, getBackupState);

  const [latest, setLatest] = useState<SnapshotMeta | null | undefined>(undefined);
  const [latestFalla, setLatestFalla] = useState(false);
  const [latestSinSesion, setLatestSinSesion] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [showRestore, setShowRestore] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refreshLatest = async () => {
    setLatestFalla(false);
    setLatestSinSesion(false);
    try {
      setLatest(await fetchLatest());
    } catch (err) {
      setLatest(null);
      if (err instanceof ErrorSinSesion) setLatestSinSesion(true);
      else setLatestFalla(true);
    }
  };

  // Consulta inicial. El estado se toca SOLO tras el await (nada síncrono en el
  // cuerpo del efecto), y un guard evita setState tras desmontar.
  useEffect(() => {
    let cancelled = false;
    fetchLatest()
      .then((l) => {
        if (cancelled) return;
        setLatestFalla(false);
        setLatestSinSesion(false);
        setLatest(l);
      })
      .catch((err) => {
        if (cancelled) return;
        setLatest(null);
        if (err instanceof ErrorSinSesion) {
          setLatestFalla(false);
          setLatestSinSesion(true);
        } else {
          setLatestSinSesion(false);
          setLatestFalla(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refrescar]);

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
        if (!(err instanceof ErrorSinSesion)) {
          setListErr(err instanceof Error ? err.message : "No se pudo listar el servidor.");
        }
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
        error:
          err instanceof ErrorSinSesion
            ? MENSAJE_NO_SE_PUDO
            : err instanceof Error
              ? err.message
              : "No se pudo descargar el snapshot.",
      });
    } finally {
      setRestoringId(null);
      setArmedId(null);
    }
  };

  const chip = chipRespaldo(state);

  return (
    <section className="sec">
      <div className="sec-cab">
        <h2 className="kicker">Respaldo automático</h2>
        <span className={cn("bd ml-auto", chip.cls)}>{chip.label}</span>
      </div>

      <p className="dek">
        Al cerrar una sesión se empuja un volcado completo al servidor. Si no hay señal, queda
        pendiente y se reintenta al abrir la app. Dexie sigue siendo la fuente de verdad.
      </p>

      {state.pending && state.lastError && (
        <div role="alert" className="errbox err-t mt-3">
          <p>Último intento: {state.lastError}</p>
          <span className="mt-0.5 block text-ink2">
            Tus datos no se tocaron: siguen en este teléfono.
          </span>
        </div>
      )}

      {/* Última copia: el dato que hace del respaldo un hecho verificable. */}
      {latestSinSesion && !state.last ? null : (
      <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-3 text-sm shadow-[inset_0_0_0_1px_var(--color-hair)]">
        {latest === undefined ? (
          <span className="text-ink2">Consultando el servidor…</span>
        ) : latestSinSesion ? (
          state.last && (
            <span className="text-ink2">Última conocida (local): {fmtDate(state.last.at)}</span>
          )
        ) : latestFalla ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-ink2">No se pudo consultar el servidor.</span>
            {state.last && (
              <span className="text-ink2">
                Última conocida (local): {fmtDate(state.last.at)}
              </span>
            )}
          </div>
        ) : latest === null ? (
          <span className="text-ink2">Aún no hay ningún respaldo en el servidor.</span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Última copia: {fmtDate(latest.creado_en)}</span>
          </div>
        )}
      </div>
      )}

      <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
        <Button variant="default" disabled={pushing} onClick={() => void doBackup()}>
          {pushing ? "Respaldando…" : "Respaldar ahora"}
        </Button>
        <Button variant="link" size="sm" className="font-medium [font-stretch:100%]" onClick={() => void toggleRestore()}>
          Restaurar del servidor
        </Button>
      </div>

      {showRestore && (
        <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-hair)]">
          <p className="text-[13px] leading-[18px] text-ink2">
            Restaurar reemplaza todo, igual que desde archivo: antes descarga un respaldo del estado
            actual (esa es la guarda) y valida el schema_version. Toca dos veces para confirmar.
          </p>
          {loadingList && <p className="mt-2 text-[13px] text-ink2">Cargando snapshots…</p>}
          {listErr && <p className="err-t mt-2 text-[13px]">{listErr}</p>}
          {snapshots && snapshots.length === 0 && (
            <p className="mt-2 text-[13px] text-ink2">No hay snapshots en el servidor.</p>
          )}
          {snapshots?.map((snap) => (
            <div
              key={snap.id}
              className="flex items-center gap-2 border-t border-hair py-2 first:border-t-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{fmtDate(snap.creado_en)}</span>
                <span className="truncate text-xs text-ink2">
                  s{snap.schema_version} · {countsLine(snap.counts)}
                </span>
              </div>
              <Button
                variant="link"
                className={cn("ml-auto shrink-0", armedId === snap.id && "danger")}
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
    </section>
  );
}
