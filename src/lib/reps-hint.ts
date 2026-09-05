import type { SetLog } from "@/lib/db/types";

/**
 * Reps de la vez pasada para mostrar como PLACEHOLDER en la captura (§2 del
 * prompt "El dato donde se necesita").
 *
 * NO traversa nada: opera sobre las series ya cargadas de la aparición anterior
 * (`getLastPerformance`, la misma fuente del peso), así que no hay una segunda
 * travesía de `sessionExercises` (criterio 11).
 *
 * `refSets` llega vacío cuando no hay aparición anterior o cuando no es
 * comparable (cambió `weight_unit`/`weight_basis`, §3.5 de DECISIONES) — en esos
 * casos no hay placeholder y el que llama muestra la marca correspondiente.
 *
 * Posición: mismo `set_index`; si hoy hay más series que la vez pasada, la extra
 * cae a la última disponible. Lado: mismo L/R; si la vez pasada solo hubo un
 * lado (o fue bilateral), ese valor sirve para ambos.
 */
export function repsPlaceholder(refSets: SetLog[], set: SetLog): number | null {
  if (refSets.length === 0) return null;

  const mismoLado = refSets.filter((s) => s.side === set.side);
  const candidatos = mismoLado.length > 0 ? mismoLado : refSets;

  const exacta = candidatos.find((s) => s.set_index === set.set_index);
  if (exacta) return exacta.reps;

  const maxIndex = Math.max(...candidatos.map((s) => s.set_index));
  const ultima = candidatos.find((s) => s.set_index === maxIndex);
  return ultima ? ultima.reps : null;
}
