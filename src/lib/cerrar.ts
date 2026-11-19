import { resumirPeso, type PesoRegistro } from "@/lib/cuerpo";

/**
 * La unidad con la que arranca el peso corporal en Cerrar sesión: la del peso más
 * reciente (el orden es el de `resumirPeso`), o KG si no hay ninguno.
 */
export function unidadPorDefecto(pesos: readonly PesoRegistro[]): "KG" | "LB" {
  return resumirPeso(pesos)?.unidad === "lb" ? "LB" : "KG";
}
