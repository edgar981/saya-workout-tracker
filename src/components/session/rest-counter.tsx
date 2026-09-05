"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { formatGap } from "@/lib/rest-gap";

/**
 * Tiempo transcurrido desde el `creado_en` más reciente de la sesión (§3).
 *
 * El valor NO vive en estado: se calcula desde `Date.now()` EN CADA RENDER, así
 * que todo render —incluido el primero al reanudar— muestra el tiempo real.
 *
 * El re-render lo guía `requestAnimationFrame`, no `setInterval`. rAF se pausa
 * cuando la página no se pinta (segundo plano / pantalla bloqueada) y se reanuda
 * al volver a pintarse — sin depender de `visibilitychange`/`focus`, que en PWA
 * standalone de iOS no disparan de forma fiable al desbloquear y dejaban el
 * contador congelado. Como el frame de reanudación recalcula desde `Date.now()`,
 * el valor salta al tiempo real solo. El loop corre por frame pero solo empuja un
 * re-render cuando cambia el segundo.
 *
 * Neutro a propósito: sin umbrales, sin color por tiempo, sin rotularlo
 * "descanso". Es información, no una meta.
 */
export function RestCounter({ lastCreadoEn }: { lastCreadoEn: string | null }) {
  // Solo fuerza el re-render; el valor mostrado no depende de este estado.
  const [, setTick] = useState(0);

  useEffect(() => {
    let raf = 0;
    let lastSec = -1;
    const loop = () => {
      const sec = Math.floor(Date.now() / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        setTick((t) => t + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Sin serie todavía → sin contador (§3 / criterio 7).
  if (!lastCreadoEn) return null;

  // Leer el reloj EN EL RENDER es a propósito (es el fix): un reloj en vivo es
  // impuro por definición, y guardar `now` en estado es justo lo que se congelaba
  // al reanudar en iOS. El re-render por segundo lo dispara el rAF de arriba.
  // eslint-disable-next-line react-hooks/purity
  const ms = Date.now() - new Date(lastCreadoEn).getTime();

  return (
    <p className="text-muted-foreground flex items-center gap-1.5 pb-2 text-xs tabular-nums">
      <Clock className="size-3.5 shrink-0" />
      <span>
        Desde la última serie <span className="text-foreground font-medium">{formatGap(ms)}</span>
      </span>
    </p>
  );
}
