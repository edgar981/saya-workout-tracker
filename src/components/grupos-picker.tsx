"use client";

import { Pildora } from "@/components/ui/pildora";
import type { Exercise, RolMuscular } from "@/lib/db/types";
import { GRUPOS } from "@/lib/musculos";

type Grupos = Exercise["grupos"];

/** Un toque avanza: nada → directo → indirecto → nada. */
const SIGUIENTE: Record<RolMuscular | "nada", RolMuscular | undefined> = {
  nada: "directo",
  directo: "indirecto",
  indirecto: undefined,
};

/**
 * Grupos musculares de un ejercicio (DECISIONES.md §12.2). Una píldora por grupo,
 * de tres estados — un grupo no puede ser directo e indirecto a la vez, así que no
 * hacen falta dos filas. La `Pildora` pone el `aria-pressed` y el «½».
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
            <Pildora
              key={id}
              presionada={rol === "directo"}
              mixta={rol === "indirecto"}
              aria-label={`${nombre}: ${rol ?? "no trabaja"}`}
              onClick={() => tocar(id)}
            >
              {nombre}
            </Pildora>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] leading-[18px] text-ink2">
        Toca para marcar: directo → indirecto (cuenta ½ serie) → nada.
      </p>
    </div>
  );
}
