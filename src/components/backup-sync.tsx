"use client";

import { useEffect } from "react";
import { retryIfPending } from "@/lib/backup/client";

/**
 * Reintento del respaldo pendiente. Al abrir la app (con red) y cada vez que la
 * red vuelve, empuja el estado actual si quedó algo sin respaldar. No hay cola:
 * un snapshot es un snapshot, se empuja lo que hay ahora. Si el último intento
 * recibió un 401 («sin sesión»), `retryIfPending` no dispara: sin sesión
 * repetiría el 401 en cada apertura (§14). Sin UI, no bloquea nada — igual que
 * DbBoot/SwRegister.
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
