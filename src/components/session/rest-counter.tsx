"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { formatGap } from "@/lib/rest-gap";

/**
 * Tiempo transcurrido desde el `creado_en` más reciente de la sesión (§3). Se
 * calcula SIEMPRE desde el timestamp (`Date.now() - lastCreadoEn`), no con un
 * contador que acumula: un `setInterval` acumulativo daría un valor equivocado
 * tras una suspensión de iOS en segundo plano —justo lo que pasa entre series—.
 * El tick solo re-renderiza; al volver del segundo plano, el `visibilitychange`
 * recalcula al tiempo real.
 *
 * Neutro a propósito: sin umbrales, sin color por tiempo, sin rotularlo
 * "descanso". Es información, no una meta.
 */
export function RestCounter({ lastCreadoEn }: { lastCreadoEn: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, []);

  // Sin serie todavía → sin contador (§3 / criterio 7).
  if (!lastCreadoEn) return null;

  const ms = now - new Date(lastCreadoEn).getTime();

  return (
    <p className="text-muted-foreground flex items-center gap-1.5 pb-2 text-xs tabular-nums">
      <Clock className="size-3.5 shrink-0" />
      <span>
        Desde la última serie <span className="text-foreground font-medium">{formatGap(ms)}</span>
      </span>
    </p>
  );
}
