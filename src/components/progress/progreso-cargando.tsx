import { Cabeza, Hoja } from "@/components/ui/hoja";

/** Alto, ancho, margin-top y radio de cada bloque (maqueta `proLoad`). */
const BLOQUES: [number, string, number, number][] = [
  [11, "48%", 0, 4],
  [42, "34%", 14, 10],
  [132, "100%", 8, 12],
];

/**
 * El estado «cargando» de Progreso: la cabeza sin subtítulo, la hoja y bloques de
 * barrido con la forma de la pantalla llena (el balance, su cifra y las celdas).
 */
export function ProgresoCargando() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Progreso" empujada />
      </div>
      <Hoja empujada>
        <main className="pro mx-auto w-full max-w-md p-4">
          <p className="sr-only" role="status">
            Cargando
          </p>
          <div aria-hidden="true">
            <section className="sec first">
              {BLOQUES.map(([alto, ancho, margen, radio], i) => (
                <div
                  key={i}
                  className="sk"
                  style={{ height: alto, width: ancho, marginTop: margen, borderRadius: radio }}
                />
              ))}
              <div className="wsl">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="sk" style={{ height: 80, borderRadius: 16 }} />
                ))}
              </div>
            </section>
          </div>
        </main>
      </Hoja>
    </>
  );
}
