"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Autosave por serie (D3). No hay botón de guardar en ninguna parte de la app.
 *
 * El punto no es escribir rápido, es no perder nada: además del debounce,
 * cualquier cosa pendiente se descarga al ocultarse la página y al desmontar el
 * componente. Eso cubre el caso real — el teléfono se bloquea, se abre otra
 * app, iOS mata el proceso — que es la restricción de diseño de todo esto.
 */
export function useAutosave(delay = 400) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const action = useRef<(() => void) | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const pending = action.current;
    action.current = null;
    pending?.();
  }, []);

  const schedule = useCallback(
    (commit: () => void) => {
      action.current = commit;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const pending = action.current;
        action.current = null;
        pending?.();
      }, delay);
    },
    [delay],
  );

  // `flush` es estable (useCallback sin deps), así que este efecto se monta una
  // sola vez pese a la dependencia.
  useEffect(() => {
    const onHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  return { schedule, flush };
}
