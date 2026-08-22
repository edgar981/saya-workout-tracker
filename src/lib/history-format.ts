import type { SetLog, Side } from "@/lib/db/types";
import { formatSetWeight } from "@/lib/units";

/**
 * Agrupa los SetLog de una instancia en LÍNEAS de lectura. Reglas de §4/§5:
 *
 *  - Giant set (un set_index con varios segment_index) → UNA línea, reps unidas
 *    con "+" y el total. No una fila por segmento.
 *  - L/R (mismo set_index, side distinto) → UNA línea, "6L / 7R".
 *  - El peso y la unidad salen del SNAPSHOT del propio SetLog. Nunca se hace
 *    join contra Exercise para el número ni la unidad, y snapshots distintos no
 *    se unifican.
 */
export interface SetLine {
  setIndex: number;
  repsText: string;
  /** Suma de reps en un giant set; null en el resto. */
  total: number | null;
  weightText: string;
  isBodyweight: boolean;
  esExtra: boolean;
}

const sideRank = (s: Side | null) => (s === null ? 0 : s === "L" ? 1 : 2);

export function groupSetLines(sets: SetLog[], stackLabel: string | null): SetLine[] {
  const groups = new Map<number, SetLog[]>();
  for (const set of sets) {
    const list = groups.get(set.set_index) ?? [];
    list.push(set);
    groups.set(set.set_index, list);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([setIndex, raw]) => {
      const rows = raw
        .slice()
        .sort((a, b) => a.segment_index - b.segment_index || sideRank(a.side) - sideRank(b.side));

      const isGiant = new Set(rows.map((r) => r.segment_index)).size > 1;
      const esExtra = rows.some((r) => r.es_extra);
      const rep = rows[0];

      let repsText: string;
      let total: number | null = null;

      if (isGiant) {
        repsText = rows.map((r) => r.reps).join("+");
        total = rows.reduce((acc, r) => acc + r.reps, 0);
      } else if (rows.length > 1) {
        repsText = rows.map((r) => (r.side ? `${r.reps}${r.side}` : String(r.reps))).join(" / ");
      } else {
        repsText = rep.side ? `${rep.reps}${rep.side}` : String(rep.reps);
      }

      return {
        setIndex,
        repsText,
        total,
        weightText: formatSetWeight(rep, stackLabel),
        isBodyweight: rep.weight_unit === "BODYWEIGHT",
        esExtra,
      };
    });
}
