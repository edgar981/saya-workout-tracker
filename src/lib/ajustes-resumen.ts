/**
 * Textos de Ajustes que se arman con cuentas. Puro: sin React ni Dexie; las
 * pantallas del grupo Ajustes lo importan.
 */

import type { Exercise } from "@/lib/db/types";
import { GRUPOS } from "@/lib/musculos";

/** `musculos.ts` no exporta `Grupos`: es el tipo del campo de `Exercise`. */
type Grupos = NonNullable<Exercise["grupos"]>;

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

/** El subtítulo de Mesociclos en Ajustes: «2 · activo Mesociclo 2». Sin mesociclos, nada. */
export function resumenMesociclos(n: number, activo: string | null): string | undefined {
  if (n === 0) return undefined;
  return activo ? `${n} · activo ${activo}` : `${n}`;
}

/** El subtítulo de Plantillas en Ajustes: «5 días · Mesociclo 2». Sin activo, nada. */
export function resumenPlantillas(dias: number, activo: string | null): string | undefined {
  if (!activo) return undefined;
  return `${contar(dias, "día", "días")} · ${activo}`;
}

const SIN_GRUPO = "Sin grupo";

/**
 * Cada ejercicio bajo su primer grupo directo (en el orden de `GRUPOS`); sin
 * directo, bajo «Sin grupo», que va al final. Un grupo vacío no sale.
 */
export function agruparPorGrupo<T extends { grupos?: Grupos }>(
  lista: T[],
): { grupo: string; ejercicios: T[] }[] {
  const porGrupo = new Map<string, T[]>();
  for (const e of lista) {
    const primero = GRUPOS.find((g) => e.grupos?.[g.id] === "directo");
    const clave = primero ? primero.nombre : SIN_GRUPO;
    const cubeta = porGrupo.get(clave);
    if (cubeta) cubeta.push(e);
    else porGrupo.set(clave, [e]);
  }
  const salida: { grupo: string; ejercicios: T[] }[] = [];
  for (const g of GRUPOS) {
    const ejercicios = porGrupo.get(g.nombre);
    if (ejercicios) salida.push({ grupo: g.nombre, ejercicios });
  }
  const sin = porGrupo.get(SIN_GRUPO);
  if (sin) salida.push({ grupo: SIN_GRUPO, ejercicios: sin });
  return salida;
}

/** El subtítulo del Catálogo: «32 ejercicios · 11 grupos». */
export function resumenCatalogo(ejercicios: number, grupos: number): string {
  const e = contar(ejercicios, "ejercicio", "ejercicios");
  return grupos === 0 ? e : `${e} · ${contar(grupos, "grupo", "grupos")}`;
}

/** El chip del respaldo: la misma regla en Ajustes y en Datos. */
export function chipRespaldo(estado: {
  pending: boolean;
  lastError: string | null | undefined;
}): { label: string; cls: string } {
  if (estado.pending) {
    return estado.lastError
      ? { label: "Falló", cls: "ko" }
      : { label: "Pendiente", cls: "text-ink" };
  }
  return { label: "Al día", cls: "" };
}
