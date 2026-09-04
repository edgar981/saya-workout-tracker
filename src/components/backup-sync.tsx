"use client";

import { useEffect } from "react";
import { retryIfPending } from "@/lib/backup/client";

/**
 * Reintento del respaldo pendiente. Al abrir la app (con red) y cada vez que la
 * red vuelve, empuja el estado actual si quedó algo sin respaldar. No hay cola:
 * un snapshot es un snapshot, se empuja lo que hay ahora. Sin UI, no bloquea
 * nada — igual que DbBoot/SwRegister.
 */
export function BackupSync() {
  useEffect(() => {
    retryIfPending();
    const onOnline = () => retryIfPending();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
