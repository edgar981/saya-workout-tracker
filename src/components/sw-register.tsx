"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { getActiveSession } from "@/lib/db/queries";

/**
 * Registro del service worker + aviso de versión nueva (§5).
 *
 * La app está en uso real, así que una versión nueva no se aplica sola: el SW
 * nuevo queda "waiting" (install ya no hace skipWaiting), y aquí se muestra un
 * aviso no bloqueante. Aplicar solo al tocarlo, y NUNCA con una sesión activa —
 * si hay entrenamiento abierto, el aviso espera a que se cierre. Sin modal, sin
 * recarga automática.
 */
export function SwRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloading = useRef(false);

  // Solo interesa cuando NO hay sesión activa. undefined = cargando (no mostrar
  // todavía); null = resuelto sin sesión (seguro mostrar).
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const trackWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        if (!cancelled) setWaiting(reg.waiting);
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // "installed" con un controller ya presente = ACTUALIZACIÓN (no el
          // primer install). Ese SW queda esperando hasta que lo activemos.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            if (!cancelled) setWaiting(installing);
          }
        });
      });
    };

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          trackWaiting(reg);
          // Buscar actualizaciones al arrancar; si hay una, cae por updatefound.
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.error("[saya] no se pudo registrar el service worker:", err);
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    // Cuando el SW nuevo toma el control (tras SKIP_WAITING), recargar UNA vez
    // para cargar el código nuevo (y correr la migración de Dexie, si la hay).
    const onControllerChange = () => {
      if (reloading.current) {
        reloading.current = false;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const aplicar = () => {
    if (!waiting) return;
    // Guarda dura: nunca activar con sesión activa, aunque el botón no debería
    // estar visible en ese caso.
    if (active) return;
    reloading.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  // El aviso aparece solo con SW en espera Y sin sesión activa. Con sesión
  // abierta, espera (criterio 8).
  if (!waiting || active !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="bg-card flex w-full max-w-md items-center gap-3 rounded-lg border px-3 py-2 shadow-lg">
        <p className="min-w-0 flex-1 text-sm">Hay una versión nueva.</p>
        <button
          type="button"
          onClick={aplicar}
          className="bg-primary text-primary-foreground shrink-0 rounded-md px-3 py-1.5 text-sm font-medium"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
