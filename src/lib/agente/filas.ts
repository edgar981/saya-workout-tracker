/**
 * Qué filas de Cuerpo manda el teléfono con cada pregunta (SAYA-R2-6). Puro: sin
 * Dexie, sin React, sin reloj (`hoy` entra por argumento). El teléfono sólo
 * elige y copia; no suma nada (§12.2: el modelo cuenta 1 por directo y 0,5 por
 * indirecto con `directos`/`indirectos`).
 */
import type { FilaCuerpo, FilaPeso, FilaSerie, FilaSesion } from "@/lib/agente/contrato";
import type {
  BodyweightLog,
  Exercise,
  GrupoMuscular,
  RoutineDay,
  Session,
  SessionExercise,
  SetLog,
} from "@/lib/db/types";
import { GRUPOS } from "@/lib/musculos";
import { lunesDe, sumarDias } from "@/lib/progress";
import { seriesDeAparicion } from "@/lib/volumen";

export type DatosCuerpo = {
  sesiones: Session[];
  apariciones: SessionExercise[];
  sets: SetLog[];
  ejercicios: Exercise[];
  dias: RoutineDay[];
  pesos: BodyweightLog[];
};
export type Periodo = { desde: string; hasta: string }; // YYYY-MM-DD, ambos incluidos
export type Tema =
  | { tipo: "ejercicio"; id: string }
  | { tipo: "grupo"; grupo: GrupoMuscular }
  | { tipo: "peso" }
  | { tipo: "sesiones" }
  | { tipo: "series" };

/** Las tres preguntas de la hoja: de Cuerpo, con periodos relativos. */
export const EJEMPLOS: readonly string[] = [
  "¿Cuántas series de pecho llevo esta semana?",
  "¿Cuánto pesé este mes?",
  "¿Cuántas sesiones hice la semana pasada?",
];

/** Minúsculas, sin tildes, lo que no es letra ni cifra como espacio, espacios simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `frase` aparece entera, como palabras enteras, en `texto` (los dos ya normalizados). */
function contiene(texto: string, frase: string): boolean {
  return frase.length > 0 && ` ${texto} `.includes(` ${frase} `);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** El primer mes por su nombre que aparece en el texto (ya normalizado), 1–12; `setiembre` es septiembre. */
function mesNombrado(q: string): number | null {
  let mejor: { mes: number; pos: number } | null = null;
  const nombres: [string, number][] = [...MESES.map((n, i): [string, number] => [n, i + 1]), ["setiembre", 9]];
  for (const [nombre, mes] of nombres) {
    const pos = ` ${q} `.indexOf(` ${nombre} `);
    if (pos >= 0 && (mejor === null || pos < mejor.pos)) mejor = { mes, pos };
  }
  return mejor?.mes ?? null;
}

export function periodoDe(pregunta: string, hoy: string): Periodo {
  const q = normalizar(pregunta);
  const lunes = lunesDe(hoy);
  const primeroDeMes = `${hoy.slice(0, 7)}-01`;
  if (contiene(q, "semana pasada")) {
    return { desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -1) };
  }
  if (contiene(q, "esta semana")) return { desde: lunes, hasta: hoy };
  if (contiene(q, "mes pasado")) {
    const hasta = sumarDias(primeroDeMes, -1);
    return { desde: `${hasta.slice(0, 7)}-01`, hasta };
  }
  if (contiene(q, "este mes")) return { desde: primeroDeMes, hasta: hoy };
  const mes = mesNombrado(q);
  if (mes !== null) {
    const mesHoy = Number(hoy.slice(5, 7));
    const anio = Number(hoy.slice(0, 4)) - (mes > mesHoy ? 1 : 0);
    const desde = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-01`;
    if (mes === mesHoy && anio === Number(hoy.slice(0, 4))) return { desde, hasta: hoy };
    const siguiente = mes === 12 ? `${String(anio + 1).padStart(4, "0")}-01-01` : `${String(anio).padStart(4, "0")}-${String(mes + 1).padStart(2, "0")}-01`;
    return { desde, hasta: sumarDias(siguiente, -1) };
  }
  if (contiene(q, "ayer")) {
    const ayer = sumarDias(hoy, -1);
    return { desde: ayer, hasta: ayer };
  }
  if (contiene(q, "hoy")) return { desde: hoy, hasta: hoy };
  return { desde: sumarDias(hoy, -27), hasta: hoy };
}

const PALABRAS_PESO = ["peso", "pese", "pesaba", "peso corporal", "bascula"];
const PALABRAS_SESIONES = ["sesion", "sesiones", "entrene", "entrenado", "entrenamiento", "entrenamientos"];
const PALABRAS_SERIES = ["serie", "series", "volumen", "ejercicio", "ejercicios", "reps", "repeticiones"];

function nombresDeGrupo(id: GrupoMuscular, nombre: string): string[] {
  const n = normalizar(nombre);
  return [n, normalizar(id), n.endsWith("s") ? n.slice(0, -1) : n];
}

export function temaDe(
  pregunta: string,
  ejercicios: Pick<Exercise, "id" | "nombre">[],
): Tema | null {
  const q = normalizar(pregunta);

  let mejor: { id: string; largo: number } | null = null;
  for (const e of ejercicios) {
    const n = normalizar(e.nombre);
    if (contiene(q, n) && (mejor === null || n.length > mejor.largo)) {
      mejor = { id: e.id, largo: n.length };
    }
  }
  if (mejor) return { tipo: "ejercicio", id: mejor.id };

  for (const g of GRUPOS) {
    if (nombresDeGrupo(g.id, g.nombre).some((n) => contiene(q, n))) {
      return { tipo: "grupo", grupo: g.id };
    }
  }
  if (PALABRAS_PESO.some((p) => contiene(q, p))) return { tipo: "peso" };
  if (PALABRAS_SESIONES.some((p) => contiene(q, p))) return { tipo: "sesiones" };
  if (PALABRAS_SERIES.some((p) => contiene(q, p))) return { tipo: "series" };
  return null;
}

type Clave = { fecha: string; iniciada: string; orden: number };
type ConClave = { clave: Clave; fila: FilaCuerpo };

function comparar(a: Clave, b: Clave): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
  if (a.iniciada !== b.iniciada) return a.iniciada < b.iniciada ? -1 : 1;
  return a.orden - b.orden;
}

export function elegirFilas(pregunta: string, hoy: string, datos: DatosCuerpo): FilaCuerpo[] {
  const tema = temaDe(pregunta, datos.ejercicios);
  if (tema === null) return [];
  const { desde, hasta } = periodoDe(pregunta, hoy);
  const dentro = (fecha: string) => fecha >= desde && fecha <= hasta;

  if (tema.tipo === "peso") {
    return datos.pesos
      .filter((p) => dentro(p.fecha))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
      .map((p): FilaPeso => ({ tipo: "peso", fecha: p.fecha, valor: p.valor, unidad: p.unidad }));
  }

  const sesiones = datos.sesiones.filter(
    (s) => dentro(s.fecha) && (s.cerrada_en !== null || s.activa === 1),
  );
  const porSesion = new Map(sesiones.map((s) => [s.id, s]));
  const dias = new Map(datos.dias.map((d) => [d.id, d]));
  const ejercicios = new Map(datos.ejercicios.map((e) => [e.id, e]));
  const nombreSesion = (s: Session) =>
    (s.routine_day_id !== null ? dias.get(s.routine_day_id)?.nombre : undefined) ?? "Sesión libre";

  const setsPorAparicion = new Map<string, SetLog[]>();
  for (const s of datos.sets) {
    const lista = setsPorAparicion.get(s.session_exercise_id);
    if (lista) lista.push(s);
    else setsPorAparicion.set(s.session_exercise_id, [s]);
  }

  const salida: ConClave[] = [];

  if (tema.tipo === "sesiones") {
    for (const s of sesiones) {
      let nEjercicios = 0;
      let nSeries = 0;
      for (const a of datos.apariciones) {
        if (a.session_id !== s.id) continue;
        const series = seriesDeAparicion(setsPorAparicion.get(a.id) ?? []);
        if (series > 0) {
          nEjercicios += 1;
          nSeries += series;
        }
      }
      const fila: FilaSesion = {
        tipo: "sesion",
        fecha: s.fecha,
        sesion: nombreSesion(s),
        abierta: s.activa === 1,
        ejercicios: nEjercicios,
        series: nSeries,
      };
      salida.push({ clave: { fecha: s.fecha, iniciada: s.iniciada_en, orden: 0 }, fila });
    }
  } else {
    for (const a of datos.apariciones) {
      const s = porSesion.get(a.session_id);
      const e = ejercicios.get(a.exercise_id);
      if (!s || !e) continue;
      if (tema.tipo === "ejercicio" && e.id !== tema.id) continue;
      if (tema.tipo === "grupo" && !e.grupos?.[tema.grupo]) continue;

      // Una fila por combinación (unidad, base, añadido): nunca se mezclan unidades (§3.5).
      const combos = new Map<string, SetLog[]>();
      for (const x of setsPorAparicion.get(a.id) ?? []) {
        const k = `${x.weight_unit}|${x.weight_basis ?? ""}|${x.added_unit ?? ""}`;
        const lista = combos.get(k);
        if (lista) lista.push(x);
        else combos.set(k, [x]);
      }
      const directos = GRUPOS.filter((g) => e.grupos?.[g.id] === "directo").map((g) => g.nombre);
      const indirectos = GRUPOS.filter((g) => e.grupos?.[g.id] === "indirecto").map(
        (g) => g.nombre,
      );
      for (const sets of combos.values()) {
        const series = seriesDeAparicion(sets);
        if (series === 0) continue;
        const apuntes = sets
          .filter((x) => x.reps > 0)
          .sort((p, q) => p.set_index - q.set_index || p.segment_index - q.segment_index)
          .map((x) => ({ serie: x.set_index, reps: x.reps, peso: x.weight_value, lado: x.side }));
        const fila: FilaSerie = {
          tipo: "serie",
          fecha: s.fecha,
          sesion: nombreSesion(s),
          abierta: s.activa === 1,
          ejercicio: e.nombre,
          directos,
          indirectos,
          unidad: sets[0].weight_unit,
          base: sets[0].weight_basis,
          anadido: sets[0].added_unit,
          series,
          apuntes,
        };
        salida.push({
          clave: { fecha: s.fecha, iniciada: s.iniciada_en, orden: a.orden_visual },
          fila,
        });
      }
    }
  }

  return salida.sort((x, y) => comparar(x.clave, y.clave)).map((x) => x.fila);
}
