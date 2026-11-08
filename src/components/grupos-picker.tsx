"use client";

import type { Exercise, RolMuscular } from "@/lib/db/types";
import { GRUPOS } from "@/lib/musculos";
import { cn } from "@/lib/utils";

type Grupos = Exercise["grupos"];

/** Un toque avanza: nada → directo → indirecto → nada. */
const SIGUIENTE: Record<RolMuscular | "nada", RolMuscular | undefined> = {
  nada: "directo",
  directo: "indirecto",
  indirecto: undefined,
};

/**
 * Grupos musculares de un ejercicio (DECISIONES.md §12.2). Un chip por grupo, de
 * tres estados — un grupo no puede ser directo e indirecto a la vez, así que no
 * hacen falta dos filas de chips. Mismo chip que los tags del cierre.
 */
export function GruposPicker({
  value,
  onChange,
}: {
  value: Grupos;
  onChange: (grupos: Grupos) => void;
}) {
  const tocar = (id: (typeof GRUPOS)[number]["id"]) => {
    const rol = SIGUIENTE[value[id] ?? "nada"];
    const next = { ...value };
    if (rol) next[id] = rol;
    else delete next[id];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {GRUPOS.map(({ id, nombre }) => {
          const rol = value[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={rol === "directo" ? true : rol === "indirecto" ? "mixed" : false}
              aria-label={`${nombre}: ${rol ?? "no trabaja"}`}
              onClick={() => tocar(id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                rol === "directo" && "bg-primary text-primary-foreground border-transparent",
                rol === "indirecto" && "bg-secondary text-foreground border-border-strong",
                !rol && "text-muted-foreground",
              )}
            >
              {nombre}
              {rol === "indirecto" && <span className="ml-1 font-mono text-xs">½</span>}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        Toca para marcar: directo → indirecto (cuenta ½ serie) → nada.
      </p>
    </div>
  );
}
