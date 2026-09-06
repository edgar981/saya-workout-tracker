"use client";

import { useRouter } from "next/navigation";

/**
 * Chevron "Volver" que sigue el historial real —el mismo destino que el gesto de
 * deslizar desde el borde que usa el usuario— con un destino de respaldo cuando
 * no hay historial (deep-link en frío). Es el patrón de `/ejercicio/[id]` y
 * `/historial/[id]`: se usa cuando la ruta es alcanzable desde más de un origen,
 * para no mandar a un "arriba" fijo que sería equivocado para algunos orígenes.
 */
export function useVolver(fallback: string) {
  const router = useRouter();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };
}
