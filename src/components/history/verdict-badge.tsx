"use client";

import { Badge } from "@/components/ui/badge";
import type { InstanceVerdict } from "@/lib/db/verdicts";
import type { SinComparacionReason, Verdict } from "@/lib/verdict";
import { cn } from "@/lib/utils";

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short" });
}

const CATEGORY_LABEL: Record<Verdict["category"], string> = {
  mejor: "mejor",
  igual: "igual",
  peor: "peor",
  sin_comparacion: "sin comparación",
};

const REASON_LABEL: Record<SinComparacionReason, string> = {
  sin_historial: "sin historial",
  cambio_unidad: "cambio de unidad",
  fuera_rango_e1rm: "fuera de rango de e1RM",
};

/** Color como información: verde SOLO para mejor. "peor" neutro atenuado, nunca
 *  rojo. Nada de ámbar — un veredicto no exige atención. */
function badgeClass(category: Verdict["category"]): string {
  switch (category) {
    case "mejor":
      return "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "peor":
    case "igual":
    case "sin_comparacion":
      return "text-muted-foreground";
  }
}

/** Método + valores comparados. Sin esto el número no es auditable (§2). */
function methodDetail(v: Verdict): string | null {
  if (v.method === "reps_totales" && v.previous !== null && v.current !== null) {
    return `${v.previous} → ${v.current} reps`;
  }
  if (v.method === "e1rm" && v.previous !== null && v.current !== null) {
    return `e1RM ${Math.round(v.previous)} → ${Math.round(v.current)}`;
  }
  return null;
}

export function VerdictBadge({ item }: { item: InstanceVerdict }) {
  const { verdict, referenceFecha } = item;
  const detalle = methodDetail(verdict);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className={cn("text-[10px]", badgeClass(verdict.category))}>
        {CATEGORY_LABEL[verdict.category]}
      </Badge>
      {verdict.reason && (
        <span className="text-muted-foreground text-[11px]">{REASON_LABEL[verdict.reason]}</span>
      )}
      {detalle && <span className="text-muted-foreground text-[11px] tabular-nums">{detalle}</span>}
      {referenceFecha && verdict.category !== "sin_comparacion" && (
        <span className="text-muted-foreground text-[11px]">vs {formatFechaCorta(referenceFecha)}</span>
      )}
    </div>
  );
}
