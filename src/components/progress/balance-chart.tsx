import { fechaCorta } from "@/components/progress/estado";
import type { SemanaBalance } from "@/lib/progress";
import { cn } from "@/lib/utils";

/**
 * Balance semanal (§11.6): barras divergentes desde una línea base. Arriba, las
 * semanas con más "mejor" que "peor"; abajo, al revés. Mismo criterio de color
 * que el neto del historial (§10): positivo en tinta, negativo atenuado, nunca
 * acento ni rojo — la posición respecto a la base ya dice el signo.
 *
 * Con 8 semanas, cada barra lleva su número: es la tabla misma, no ruido.
 * Una semana sin sesiones es un hueco (·), no un cero.
 */
const MEDIA = 32; // alto de cada mitad, en px

function neto(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

export function BalanceChart({ semanas }: { semanas: SemanaBalance[] }) {
  const max = Math.max(1, ...semanas.map((s) => Math.abs(s.net)));
  const alto = (n: number) => Math.max(2, (Math.abs(n) / max) * MEDIA);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex" style={{ height: MEDIA * 2 }}>
        {/* Línea base: trazo fino y sólido, un paso sobre el fondo. */}
        <div className="bg-border-strong absolute inset-x-0 h-px" style={{ top: MEDIA }} />
        {semanas.map((s) => (
          <div
            key={s.lunes}
            className="relative flex flex-1 justify-center"
            title={
              s.sesiones === 0
                ? `Semana del ${fechaCorta(s.lunes)}: sin sesiones`
                : `Semana del ${fechaCorta(s.lunes)}: ${s.sesiones} ${s.sesiones === 1 ? "sesión" : "sesiones"}, neto ${neto(s.net)}${s.deload ? " · descarga" : ""}`
            }
          >
            {s.sesiones > 0 && s.net !== 0 && (
              <div
                className={cn(
                  "absolute w-full max-w-6",
                  // Extremo de dato redondeado; cuadrado contra la base.
                  s.net > 0
                    ? "bg-foreground rounded-t-[4px]"
                    : "bg-muted-foreground rounded-b-[4px]",
                )}
                style={
                  s.net > 0
                    ? { bottom: MEDIA, height: alto(s.net) }
                    : { top: MEDIA + 1, height: alto(s.net) }
                }
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex">
        {semanas.map((s) => (
          <div key={s.lunes} className="flex flex-1 flex-col items-center">
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                s.sesiones === 0
                  ? "text-faint"
                  : s.net > 0
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {s.sesiones === 0 ? "·" : neto(s.net)}
            </span>
            {s.deload && <span className="text-muted-foreground text-[9px] leading-none">desc.</span>}
          </div>
        ))}
      </div>

      {semanas.length > 0 && (
        <div className="text-muted-foreground flex justify-between font-mono text-[10px]">
          <span>{fechaCorta(semanas[0].lunes)}</span>
          <span>esta semana</span>
        </div>
      )}
    </div>
  );
}
