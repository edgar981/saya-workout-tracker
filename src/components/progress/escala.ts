import { diasEntre, type PuntoMarca } from "@/lib/progress";

/**
 * Escalas compartidas por la línea de `/ejercicio` y el sparkline de `/progreso`.
 *
 * Eje X por FECHA, no por índice: una semana sin entrenar se ve como hueco.
 *
 * Eje Y con un rango MÍNIMO de ±10% de la mejor marca. Sin números en el eje
 * (la marca no se muestra, §11.1), un eje ajustado al min/max haría que un +3%
 * se viera tan empinado como un +22%; con el rango mínimo, la inclinación dice
 * algo por sí sola.
 */
const RANGO_MIN = 0.2;

export interface Escala {
  x: (fecha: string) => number;
  y: (marca: number) => number;
}

export function escalas(
  puntos: PuntoMarca[],
  mejor: number,
  caja: { ancho: number; alto: number; padX: number; padY: number },
): Escala {
  const { ancho, alto, padX, padY } = caja;
  const primera = puntos[0]?.fecha ?? "";
  const dias = puntos.length > 1 ? diasEntre(primera, puntos[puntos.length - 1].fecha) : 0;

  const marcas = puntos.map((p) => p.marca);
  let lo = Math.min(...marcas);
  let hi = Math.max(...marcas);
  const minimo = mejor * RANGO_MIN;
  if (hi - lo < minimo) {
    const medio = (hi + lo) / 2;
    lo = medio - minimo / 2;
    hi = medio + minimo / 2;
  }

  return {
    x: (fecha) =>
      dias === 0 ? ancho / 2 : padX + (diasEntre(primera, fecha) / dias) * (ancho - 2 * padX),
    y: (marca) => padY + (1 - (marca - lo) / (hi - lo)) * (alto - 2 * padY),
  };
}

export function trazo(puntos: PuntoMarca[], e: Escala): string {
  return puntos
    .map((p, i) => `${i === 0 ? "M" : "L"}${e.x(p.fecha).toFixed(1)},${e.y(p.marca).toFixed(1)}`)
    .join(" ");
}
