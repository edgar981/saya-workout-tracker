import { escalas, trazo } from "@/components/progress/escala";
import type { PuntoMarca } from "@/lib/progress";

/**
 * Tendencia mínima de una fila de `/progreso`: solo la forma. Línea atenuada y la
 * última sesión en tinta. Misma escala que la línea grande (rango mínimo ±10%),
 * así que una fila casi plana se ve casi plana. Decorativo: el dato de la fila
 * está en el texto, por eso `aria-hidden`.
 */
const ANCHO = 56;
const ALTO = 20;

export function Sparkline({ puntos, mejor }: { puntos: PuntoMarca[]; mejor: number }) {
  if (puntos.length === 0) return <div style={{ width: ANCHO, height: ALTO }} aria-hidden />;
  const e = escalas(puntos, mejor, { ancho: ANCHO, alto: ALTO, padX: 3, padY: 3 });
  const ultimo = puntos[puntos.length - 1];
  return (
    <svg width={ANCHO} height={ALTO} className="block shrink-0" aria-hidden>
      <path
        d={trazo(puntos, e)}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={e.x(ultimo.fecha)} cy={e.y(ultimo.marca)} r={2.5} fill="var(--ink)" />
    </svg>
  );
}
