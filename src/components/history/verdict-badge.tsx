import { fechaCorta } from "@/components/progress/estado";
import type { InstanceVerdict } from "@/lib/db/verdicts";
import type { SinComparacionReason, Verdict } from "@/lib/verdict";

export const CATEGORY_LABEL: Record<Verdict["category"], string> = {
  mejor: "mejor",
  igual: "igual",
  peor: "peor",
  sin_comparacion: "sin comparación",
};

export const REASON_LABEL: Record<SinComparacionReason, string> = {
  sin_historial: "sin historial",
  cambio_unidad: "cambio de unidad",
  fuera_rango_e1rm: "fuera de rango de e1RM",
};

/** Método + valores comparados. Sin esto el número no es auditable (§2). */
export function methodDetail(v: Verdict): string | null {
  if (v.method === "reps_totales" && v.previous !== null && v.current !== null) {
    return `${v.previous} → ${v.current} reps`;
  }
  if (v.method === "e1rm" && v.previous !== null && v.current !== null) {
    return `e1RM ${Math.round(v.previous)} → ${Math.round(v.current)}`;
  }
  return null;
}

/**
 * El veredicto de un ejercicio, en la cabecera de su tarjeta (`.l-s`). Color como
 * información, no como botón (§10): «mejor» en tinta plena con ↑ (`.l-up`); «igual»
 * y «peor» en `--ink2`, «peor» con ↓. Nunca acento, ni rojo, ni verde, ni ámbar:
 * la dirección la carga la flecha. `verFecha` pone el «vs {fecha}» de hoy cuando el
 * kicker de la sección no pudo decir una fecha común.
 */
export function VeredictoLinea({
  item,
  verFecha = false,
}: {
  item: InstanceVerdict;
  verFecha?: boolean;
}) {
  const { verdict, referenceFecha } = item;
  const vs =
    verFecha && referenceFecha && verdict.category !== "sin_comparacion"
      ? ` vs ${fechaCorta(referenceFecha)}`
      : "";

  if (verdict.category === "sin_comparacion") {
    return (
      <span className="l-s l-dn">
        sin comparación{verdict.reason ? ` · ${REASON_LABEL[verdict.reason]}` : ""}
      </span>
    );
  }

  const detalle = methodDetail(verdict) ?? CATEGORY_LABEL[verdict.category];
  const [marca, clase] =
    verdict.category === "mejor"
      ? ["↑", "l-up"]
      : verdict.category === "peor"
        ? ["↓", "l-dn"]
        : ["=", "l-dn"];
  return (
    <span className="l-s">
      <span className={clase}>
        {marca} {detalle}
      </span>
      {vs}
    </span>
  );
}
