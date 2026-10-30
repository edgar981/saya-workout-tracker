"use client";

import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

import type { EstadoProgreso, ProgresoEjercicio } from "@/lib/progress";
import { MIN_COMPARABLES } from "@/lib/progress";
import { cn } from "@/lib/utils";

/**
 * Presentación del estado de §11.4. Mismas reglas de color que el veredicto
 * (DECISIONES.md §10): "subiendo" en tinta plena con ↑; el resto atenuado, "por
 * debajo" con ↓ y NUNCA rojo. La dirección la carga la flecha, no el color.
 */
export const ESTADO_LABEL: Record<EstadoProgreso, string> = {
  subiendo: "Subiendo",
  estancado: "Estancado",
  por_debajo: "Por debajo",
  sin_registrar: "Sin registrar",
  pocos_datos: "Pocos datos",
  sin_registros: "Sin registros",
};

export const ESTADO_ICON: Partial<Record<EstadoProgreso, LucideIcon>> = {
  subiendo: ArrowUp,
  por_debajo: ArrowDown,
};

export function estadoClass(estado: EstadoProgreso): string {
  return estado === "subiendo" ? "text-foreground" : "text-muted-foreground";
}

/** Partido a mano: `new Date('2026-08-14')` se parsea como UTC y en América
 *  muestra el día anterior. */
export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function porcentaje(fraccion: number): string {
  const n = Math.round(fraccion * 100);
  return n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : "0%";
}

/** El dato que acompaña al estado (§11.4, columna "se muestra"). */
export function detalleEstado(p: ProgresoEjercicio): string {
  switch (p.estado) {
    case "subiendo":
      return `${porcentaje(p.cambio ?? 0)} desde el ${fechaCorta(p.puntos[0].fecha)}`;
    case "por_debajo":
      return `${porcentaje(p.cambio ?? 0)} vs tu mejor sesión (${fechaCorta(p.mejor!.fecha)})`;
    case "estancado":
      return `sin mejorar desde el ${fechaCorta(p.mejor!.fecha)} · ${p.semanasSinMejorar} sem`;
    case "sin_registrar":
      return `última vez el ${fechaCorta(p.ultimaFecha!)}`;
    case "pocos_datos":
      return `${p.puntos.length} de ${MIN_COMPARABLES} sesiones comparables`;
    case "sin_registros":
      return "nunca registrado";
  }
}

/** Etiqueta con flecha + detalle, en una línea. */
export function EstadoLinea({ progreso, className }: { progreso: ProgresoEjercicio; className?: string }) {
  const Icon = ESTADO_ICON[progreso.estado];
  return (
    <p className={cn("flex items-center gap-1.5 text-xs", className)}>
      <span className={cn("flex items-center gap-1 font-medium", estadoClass(progreso.estado))}>
        {Icon && <Icon className="size-3.5" />}
        {ESTADO_LABEL[progreso.estado]}
      </span>
      <span className="text-muted-foreground tabular-nums">· {detalleEstado(progreso)}</span>
    </p>
  );
}
