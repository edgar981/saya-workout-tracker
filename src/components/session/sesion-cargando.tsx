import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Alto, ancho, margin-top y radio de cada bloque (maqueta `sesLoad`). */
const BLOQUES: [number, string, number, number][] = [
  [44, "62%", 16, 22],
  [11, "42%", 26, 4],
  [30, "82%", 12, 8],
  [196, "100%", 16, 24],
  [60, "100%", 14, 30],
  [26, "48%", 22, 13],
  [110, "100%", 24, 18],
];

/**
 * El estado «cargando» de Sesión: la cabeza con «Volver» (y el día si ya se sabe),
 * el contador vacío y bloques de barrido con la forma de la pantalla llena.
 */
export function SesionCargando({ dia }: { dia?: string | null }) {
  return (
    <div className="ses">
      <header className="stop">
        <Link href="/" aria-label="Volver al home sin cerrar la sesión" className="back">
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
          Volver
        </Link>
        {dia ? <span className="day">{dia}</span> : <span />}
        <span />
      </header>
      <div className="hoja" data-propia="" style={{ marginTop: 12 }}>
        <main className="mx-auto w-full max-w-md px-4 pt-4">
          <p className="sr-only" role="status">
            Cargando
          </p>
          <div aria-hidden="true">
            {BLOQUES.map(([alto, ancho, margen, radio], i) => (
              <div
                key={i}
                className="sk"
                style={{ height: alto, width: ancho, marginTop: margen, borderRadius: radio }}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
