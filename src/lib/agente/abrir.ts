/**
 * Abrir el agente (SAYA-R2-2): el orbe de la barra avisa, la hoja del agente
 * (SAYA-R2-6) escucha. Hasta entonces nadie escucha y tocar el orbe no hace nada.
 */

const oyentes = new Set<() => void>();

export function abrirAgente(): void {
  for (const cb of [...oyentes]) cb();
}

/** Devuelve la baja. */
export function alAbrirAgente(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}
