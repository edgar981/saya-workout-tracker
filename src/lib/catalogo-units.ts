import type { UnitType } from "@/lib/db/types";

/**
 * Opciones de unidad y qué campos tienen sentido según cada una. Compartido por
 * la lista del catálogo (edición en sitio de una fila) y el formulario de crear
 * ejercicio, que ahora vive en su propia ruta (/catalogo/nuevo).
 */
export const UNIDADES: { valor: UnitType; etiqueta: string }[] = [
  { valor: "LB", etiqueta: "Libras" },
  { valor: "KG", etiqueta: "Kilos" },
  { valor: "BODYWEIGHT", etiqueta: "Peso corporal" },
  { valor: "BODYWEIGHT_PLUS", etiqueta: "Peso corporal + añadido" },
  // Sin ejercicios en la semilla (§7.4) pero disponible para la máquina sin
  // marcar que aparezca algún día.
  { valor: "STACK_POSITION", etiqueta: "Posición de stack" },
];

export function usaBasis(u: UnitType): boolean {
  return u === "KG" || u === "LB" || u === "BODYWEIGHT_PLUS";
}

export function usaAddedUnit(u: UnitType): boolean {
  return u === "BODYWEIGHT_PLUS";
}

export function usaStackLabel(u: UnitType): boolean {
  return u === "STACK_POSITION";
}
