/**
 * Reglas puras de los diales y de las fichas de «Hoy» en Sesión (SAYA-R2-4).
 * Sin React ni DOM. Nada derivado se guarda (§3.5): todo sale de las filas
 * `SetLog` que ya existen. Sin conversión entre unidades (D5).
 */
import { proyectar } from "@/components/session/resorte";
import type { Exercise, SetLog } from "@/lib/db/types";
import { GRUPOS } from "@/lib/musculos";
import { hasWeightField } from "@/lib/units";

/** Un grupo = las filas de un mismo `set_index`, ordenadas por segmento y lado. */
export type GrupoSerie = SetLog[];

export type CampoDial = "reps" | "peso";

export const MAX_REPS = 99;
export const MAX_PESO = 999;
export const PX_POR_PASO = 24;

/** El paso de cada campo. `null`: el ejercicio no tiene ese campo (peso corporal). */
export function pasoDial(exercise: Exercise, campo: CampoDial): number | null {
  if (campo === "reps") return 1;
  switch (exercise.unit_type) {
    case "KG":
      return 2.5;
    case "LB":
      return 5;
    case "BODYWEIGHT_PLUS":
      return exercise.added_unit === "KG" ? 2.5 : 5;
    case "STACK_POSITION":
      return 1;
    case "BODYWEIGHT":
      return null;
  }
}

/** `v` más `delta`, redondeado a 0,01 y topado a [0, max]. */
export function ajustar(v: number, delta: number, max: number): number {
  const r = Math.round((v + delta) * 100) / 100;
  return Math.min(max, Math.max(0, r)) + 0;
}

/** Cuántos pasos mueve un arrastre vertical de `dy` px (hacia arriba sube). */
export function pasosDeArrastre(dy: number): number {
  return Math.round(-dy / PX_POR_PASO) + 0;
}

/** Cuántos pasos más suma el lanzamiento al soltar, con la velocidad `vy` (px/s). */
export function lanzamiento(vy: number): number {
  const n = Math.round(-proyectar(vy, 0.99) / PX_POR_PASO);
  return Math.min(6, Math.max(-6, n)) + 0;
}

/** El sufijo del peso: «lb», «lb c/u», «kg», «kg c/u», «kg»/«lb» del extra, o el stack. */
export function sufijoPeso(exercise: Exercise): string {
  switch (exercise.unit_type) {
    case "KG":
      return exercise.weight_basis === "PER_IMPLEMENT" ? "kg c/u" : "kg";
    case "LB":
      return exercise.weight_basis === "PER_IMPLEMENT" ? "lb c/u" : "lb";
    case "BODYWEIGHT_PLUS":
      return exercise.added_unit === "KG" ? "kg" : "lb";
    case "STACK_POSITION":
      return exercise.stack_label ?? "posición";
    case "BODYWEIGHT":
      return "";
  }
}

/** La etiqueta de unidad del kicker y de las filas de los selectores. */
export function etiquetaUnidad(exercise: Exercise): string {
  switch (exercise.unit_type) {
    case "BODYWEIGHT":
      return "peso corporal";
    case "BODYWEIGHT_PLUS":
      return `peso corporal + ${sufijoPeso(exercise)}`;
    default:
      return sufijoPeso(exercise);
  }
}

/** El primer grupo directo en el orden de `GRUPOS`, o «Sin grupo». */
export function grupoDirecto(exercise: Exercise): string {
  return GRUPOS.find((g) => exercise.grupos[g.id] === "directo")?.nombre ?? "Sin grupo";
}

/** Coma decimal, como en la maqueta (`22,5`). */
export function numeroEs(n: number): string {
  return String(n).replace(".", ",");
}

/** El peso con su sufijo: «50 lb», «+10 kg», «peso corporal». */
export function textoPeso(exercise: Exercise, w: number): string {
  if (exercise.unit_type === "BODYWEIGHT") return "peso corporal";
  const prefijo = exercise.unit_type === "BODYWEIGHT_PLUS" ? "+" : "";
  return `${prefijo}${numeroEs(w)} ${sufijoPeso(exercise)}`;
}

function ordenFilas(a: SetLog, b: SetLog): number {
  if (a.segment_index !== b.segment_index) return a.segment_index - b.segment_index;
  const lado = (s: SetLog) => (s.side === "L" ? 0 : s.side === "R" ? 1 : 0);
  return lado(a) - lado(b);
}

/** Agrupa por `set_index`, en orden. Un grupo está «anotado» si alguna fila tiene reps > 0. */
export function gruposDeHoy(sets: SetLog[]): GrupoSerie[] {
  const mapa = new Map<number, SetLog[]>();
  for (const s of sets) {
    const lista = mapa.get(s.set_index) ?? [];
    lista.push(s);
    mapa.set(s.set_index, lista);
  }
  return [...mapa.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, filas]) => [...filas].sort(ordenFilas));
}

export function estaAnotado(grupo: GrupoSerie): boolean {
  return grupo.some((f) => f.reps > 0);
}

/** El índice del primer grupo con todas sus reps en 0; si no hay, uno nuevo. */
export function siguienteSerie(grupos: GrupoSerie[]): number {
  const i = grupos.findIndex((g) => g.every((f) => f.reps === 0));
  return i === -1 ? grupos.length : i;
}

/** El peso del grupo: el del primer segmento, de la primera fila que lo tenga. */
export function pesoDeGrupo(grupo: GrupoSerie): number | null {
  const seg0 = grupo.filter((f) => f.segment_index === (grupo[0]?.segment_index ?? 0));
  return seg0.find((f) => f.weight_value !== null)?.weight_value ?? null;
}

/** Las reps del grupo para precargar el dial: las de la primera fila con reps. */
export function repsDeGrupo(grupo: GrupoSerie): number {
  return grupo.find((f) => f.reps > 0)?.reps ?? 0;
}

/** Una serie con reps y sin peso, en un ejercicio que sí lleva peso. */
export function faltaPeso(exercise: Exercise, grupo: GrupoSerie): boolean {
  if (!hasWeightField(exercise.unit_type)) return false;
  return grupo.some((f) => f.reps > 0 && f.weight_value === null);
}

/** «8 × 50 lb», «12 reps», «8 × —», «8/7 × 20 lb», «8+6 × 50 lb». */
export function textoSerie(exercise: Exercise, grupo: GrupoSerie): string {
  const filas = [...grupo].sort(ordenFilas);
  const conSegmentos = filas.some((f) => f.segment_index > 0);
  let reps: string;
  if (conSegmentos) {
    reps = filas.map((f) => String(f.reps)).join("+");
  } else {
    const lados = filas.map((f) => f.reps);
    reps = lados.every((r) => r === lados[0]) ? String(lados[0] ?? 0) : lados.join("/");
  }
  if (exercise.unit_type === "BODYWEIGHT") return `${reps} reps`;
  const w = pesoDeGrupo(filas);
  return `${reps} × ${w === null ? "—" : textoPeso(exercise, w)}`;
}

/** Sólo cuenta la pasada comparable: mismo `weight_unit` y `weight_basis`. */
export function pasadaComparable(exercise: Exercise, pasada: SetLog[]): boolean {
  return (
    pasada.length > 0 &&
    pasada[0].weight_unit === exercise.unit_type &&
    pasada[0].weight_basis === exercise.weight_basis
  );
}

export interface ValoresDial {
  reps: number;
  /** `null` en peso corporal. */
  peso: number | null;
}

/** Con qué valores arrancan los diales. Ver SAYA-R2-4 §6. */
export function valoresIniciales({
  exercise,
  slot,
  pasada,
  hoy,
  editando,
}: {
  exercise: Exercise;
  slot: { target_reps: number | null } | null;
  pasada: SetLog[];
  hoy: SetLog[];
  /** Índice (0-based) del grupo que se edita, o `null`. */
  editando: number | null;
}): ValoresDial {
  const sinPeso = exercise.unit_type === "BODYWEIGHT";
  const gruposHoy = gruposDeHoy(hoy);
  const gruposPasada = pasadaComparable(exercise, pasada) ? gruposDeHoy(pasada) : [];
  const enPasada = (i: number): GrupoSerie | null =>
    gruposPasada.length === 0 ? null : gruposPasada[Math.min(i, gruposPasada.length - 1)];

  if (editando !== null && gruposHoy[editando]) {
    const g = gruposHoy[editando];
    const peso = pesoDeGrupo(g);
    const dePasada = peso === null ? enPasada(editando) : null;
    return {
      reps: repsDeGrupo(g),
      peso: sinPeso ? null : (peso ?? (dePasada ? pesoDeGrupo(dePasada) : null) ?? 0),
    };
  }

  const k = siguienteSerie(gruposHoy);
  const repsPasada = gruposPasada[k] ? repsDeGrupo(gruposPasada[k]) : 0;
  const reps = repsPasada > 0 ? repsPasada : (slot?.target_reps ?? 8);

  if (sinPeso) return { reps, peso: null };

  const pesoPasada = enPasada(k) ? pesoDeGrupo(enPasada(k)!) : null;
  let ultimoHoy: number | null = null;
  for (const g of gruposHoy) {
    if (estaAnotado(g)) {
      const w = pesoDeGrupo(g);
      if (w !== null) ultimoHoy = w;
    }
  }
  return { reps, peso: pesoPasada ?? ultimoHoy ?? 0 };
}
