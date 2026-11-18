/**
 * Textos de Ajustes que se arman con cuentas. Puro: sin React ni Dexie; las
 * pantallas del grupo Ajustes lo importan.
 */

/** `contar(1, "día", "días")` → «1 día»; `contar(5, …)` → «5 días». */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** El rango de un mesociclo: «2 nov – 14 dic», «desde el 2 nov» o «sin fecha de inicio». */
export function rangoMesociclo(
  inicio: string | null,
  fin: string | null,
  fmt: (iso: string) => string,
): string {
  if (!inicio) return "sin fecha de inicio";
  if (fin) return `${fmt(inicio)} – ${fmt(fin)}`;
  return `desde el ${fmt(inicio)}`;
}

/** La cuenta de ejercicios de un día y, si hay, sus dos primeros nombres. */
export function resumenDia(nombres: string[]): string {
  const cuenta = contar(nombres.length, "ejercicio", "ejercicios");
  if (nombres.length === 0) return cuenta;
  const primeros = nombres.slice(0, 2).join(", ");
  return `${cuenta} · ${primeros}${nombres.length > 2 ? "…" : ""}`;
}

/** La misma regla del `ExercisePicker`: sin mayúsculas ni espacios de los bordes. */
export function filtrarPorNombre<T extends { nombre: string }>(lista: T[], q: string): T[] {
  const busca = q.trim().toLowerCase();
  if (busca === "") return lista;
  return lista.filter((e) => e.nombre.toLowerCase().includes(busca));
}
