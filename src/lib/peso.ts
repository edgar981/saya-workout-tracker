/**
 * Lee el número que el usuario tecleó como peso corporal. Una sola regla para el
 * formulario de cierre y para la hoja «Anotar peso»: la coma pasa a punto, se
 * descarta todo lo que no sea dígito o punto, vacío da `null` y lo no finito
 * también.
 */
export function parsePeso(texto: string): number | null {
  const cleaned = texto.replace(",", ".").replace(/[^\d.]/g, "");
  if (cleaned === "") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
