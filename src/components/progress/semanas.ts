import { lunesDe, type SemanaBalance } from "@/lib/progress";
import { decimalComa } from "@/lib/leer";
import { redondearMedia, type VolumenGrupo } from "@/lib/volumen";

/**
 * Progreso «Semanas» de la ronda 2 (SAYA-R2-5). Puro: sin React, sin Dexie, sin DOM.
 * La fecha corta se pasa como función para que las pruebas no dependan de la ICU.
 * Nada se almacena (§3.5): todo sale de lo que ya leyó la pantalla.
 */

type Fecha = (iso: string) => string;

/** «+3» · «−4» (U+2212, no guion) · «0». */
export function signo(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

// ── El gráfico ───────────────────────────────────────────────────────────────

/** Px por punto de neto en la maqueta, y la línea del cero (2 + 6·11). */
export const BK = 11;
export const BZ = 68;
/** Alto de la columna sin la fila de fechas: 132 − 18. */
const ALTO_COLUMNA = 114;
const AIRE = 2;

export interface BarraBalance {
  /** % del ancho, tres decimales. */
  left: string;
  width: string;
  top: number;
  alto: number;
  negativo: boolean;
  deload: boolean;
  hueco: boolean;
}

export interface GeometriaBalance {
  cero: number;
  k: number;
  barras: BarraBalance[];
}

export function geometriaBalance(semanas: readonly SemanaBalance[]): GeometriaBalance {
  const n = semanas.length;
  const conSesiones = semanas.filter((s) => s.sesiones > 0);
  const mayorPos = Math.max(0, ...conSesiones.map((s) => s.net));
  const mayorNeg = Math.max(0, ...conSesiones.map((s) => -s.net));
  const k = Math.min(
    BK,
    mayorPos > 0 ? (BZ - AIRE) / mayorPos : BK,
    mayorNeg > 0 ? (ALTO_COLUMNA - BZ - AIRE) / mayorNeg : BK,
  );
  const barras = semanas.map((s, i): BarraBalance => {
    const hueco = s.sesiones === 0;
    const alto = hueco ? 0 : Math.max(2, Math.abs(s.net) * k);
    return {
      left: ((i / n) * 100).toFixed(3),
      width: (100 / n).toFixed(3),
      top: s.net >= 0 ? BZ - alto : BZ,
      alto,
      negativo: s.net < 0,
      deload: s.deload,
      hueco,
    };
  });
  return { cero: BZ, k, barras };
}

export function textoSemana(semana: SemanaBalance, fecha: Fecha): string {
  const n = semana.sesiones;
  return `Semana del ${fecha(semana.lunes)} · ${n} ${n === 1 ? "sesión" : "sesiones"}${
    semana.deload ? " · descarga" : ""
  }`;
}

export function subtituloProgreso(cerradas: number, primera: string | null, fecha: Fecha): string {
  if (cerradas <= 0 || primera === null) return "Sin sesiones cerradas";
  return `${cerradas} ${cerradas === 1 ? "sesión cerrada" : "sesiones cerradas"} · desde el ${fecha(primera)}`;
}

// ── Días ─────────────────────────────────────────────────────────────────────

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function diaDeSemana(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** «Lun 21». */
export function diaCorto(iso: string): string {
  const d = Number(iso.split("-")[2]);
  return `${DIAS[diaDeSemana(iso)]} ${d}`;
}

/** «Lun, 21 sep». */
export function diaLargo(iso: string, fecha: Fecha): string {
  return `${DIAS[diaDeSemana(iso)]}, ${fecha(iso)}`;
}

export interface SesionDia {
  id: string;
  fecha: string;
  net: number;
  routineDayId: string | null;
}

export function agruparPorSemana(sesiones: readonly SesionDia[]): Record<string, SesionDia[]> {
  const out: Record<string, SesionDia[]> = {};
  for (const s of sesiones) (out[lunesDe(s.fecha)] ??= []).push(s);
  for (const l of Object.values(out)) l.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return out;
}

export type CeldaSemana =
  | { dia: { id: string; nombre: string }; vacia: true }
  | {
      dia: { id: string; nombre: string };
      vacia?: false;
      sessionId: string;
      net: number;
      texto: string;
      mut: boolean;
      corta: string;
      aria: string;
    };

export function celdasDeSemana(
  dias: readonly { id: string; nombre: string }[],
  sesionesDeLaSemana: readonly SesionDia[],
  fecha: Fecha,
): CeldaSemana[] {
  const ordenadas = [...sesionesDeLaSemana].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return dias.map((dia): CeldaSemana => {
    const s = ordenadas.find((x) => x.routineDayId === dia.id);
    if (!s) return { dia, vacia: true };
    return {
      dia,
      sessionId: s.id,
      net: s.net,
      texto: signo(s.net),
      mut: s.net <= 0,
      corta: diaCorto(s.fecha),
      aria: `${dia.nombre}, ${diaLargo(s.fecha, fecha)}, balance ${signo(s.net)}`,
    };
  });
}

// ── Volumen ──────────────────────────────────────────────────────────────────

/** La mayor `tipica`, o 1 si todas son 0. */
export function escalaVolumen(grupos: readonly { tipica: number }[]): number {
  const m = Math.max(0, ...grupos.map((g) => g.tipica));
  return m > 0 ? m : 1;
}

const media = (x: number) => decimalComa(redondearMedia(x));

export interface FilaHojaGrupo {
  t: string;
  s?: string;
  v: string;
}

export function filasHojaGrupo(
  grupo: Pick<VolumenGrupo, "tipica" | "directas" | "aportes">,
  estadoDe: (exerciseId: string) => string | null,
): { subtitulo: string; filas: FilaHojaGrupo[] } {
  const subtitulo = `${media(grupo.tipica)} series por semana · ${media(grupo.directas)} directas`;
  const filas: FilaHojaGrupo[] = [];
  const indirectos = grupo.aportes.filter((a) => a.rol === "indirecto");
  for (const a of grupo.aportes) {
    if (a.rol === "indirecto") continue;
    const s = estadoDe(a.exerciseId);
    filas.push({ t: a.nombre, ...(s !== null ? { s } : {}), v: media(a.series) });
  }
  if (indirectos.length > 0) {
    const suma = indirectos.reduce((n, a) => n + a.series, 0);
    filas.push({
      t: `${indirectos.map((a) => a.nombre).join(" · ")} (½ de ${media(suma)})`,
      v: media(suma / 2),
    });
  }
  return { subtitulo, filas };
}
