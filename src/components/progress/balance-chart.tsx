import { fechaCorta } from "@/components/progress/estado";
import { barrasBalance } from "@/lib/leer";
import type { SemanaBalance } from "@/lib/progress";

/**
 * Balance semanal (§11.6): barras divergentes desde una línea base (`.l-bal`).
 * Arriba, las semanas con más «mejor» que «peor»; abajo, al revés. Color de §10:
 * positivo en tinta clara, negativo en tinta tenue, la descarga en contorno;
 * nunca acento, rojo ni verde. Cada barra lleva su número, a 3 px de su extremo.
 * Una semana sin sesiones es un hueco («·»), no un cero. Las cuentas están en
 * `barrasBalance` (lib/leer.ts), con pruebas.
 */
export function BalanceChart({ semanas }: { semanas: SemanaBalance[] }) {
  const b = barrasBalance(semanas, fechaCorta);

  return (
    <>
      <div className="l-bal" role="img" aria-label={b.etiqueta}>
        {b.columnas.map((c) => (
          <div key={c.lunes} className="c">
            {!c.hueco && c.alto > 0 && (
              <i
                className={[c.negativo ? "n" : "", c.deload ? "dl" : ""].filter(Boolean).join(" ")}
                style={c.negativo ? { top: "50%", height: c.alto } : { bottom: "50%", height: c.alto }}
              />
            )}
            <b style={c.numero}>{c.texto}</b>
          </div>
        ))}
      </div>
      {b.primera && b.ultima && (
        <div className="l-eje">
          <span>{fechaCorta(b.primera)}</span>
          <span>{fechaCorta(b.ultima)}</span>
        </div>
      )}
    </>
  );
}
