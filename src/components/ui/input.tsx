import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Campos de Cromo líquido. Tres variantes de `Input`, por defecto `texto`:
 *   - texto (.tin)  alto 52, radio 16. 16px: por debajo iOS hace zoom al enfocar.
 *   - cifra (.bigin) un número grande (peso, saldo): alto 68, radio 20.
 *   - serie (.fld)  repeticiones y peso: alto 56, radio 16.
 * `cifra` y `serie` pintan su unidad (y el prefijo «$») en un contenedor `Campo`
 * que envuelve al `<input>`; el `<input>` sigue siendo el único elemento
 * enfocable, y el foco (--fsh-f) se dibuja en el contenedor.
 */
export type VarianteInput = "texto" | "cifra" | "serie";

// Aspecto común de todo campo: fondo --fbg, borde --fsh, foco --fsh-f.
const CAJA =
  "bg-fbg [box-shadow:var(--fsh)] transition-[box-shadow] duration-200 ease-[var(--ease)]";
const FOCO = "focus-visible:[box-shadow:var(--fsh-f)]";

const TEXTO = cn(
  "flex min-h-[52px] w-full min-w-0 rounded-2xl px-4 text-base font-normal text-ink outline-none",
  CAJA,
  FOCO,
  "disabled:pointer-events-none disabled:opacity-[.55]",
);

// Contenedor de cifra/serie y el `<input>` desnudo de dentro.
const CAMPO = {
  cifra: {
    caja: "min-h-[68px] rounded-[20px] px-[18px]",
    input: "text-[30px] font-medium [font-stretch:var(--w-ancho)]",
    unidad: "text-[15px] font-medium",
    prefijo: "text-[26px]",
  },
  serie: {
    caja: "min-h-14 rounded-2xl px-3.5",
    input: "text-2xl font-semibold [font-stretch:var(--w-ancho)]",
    unidad: "text-[13px] font-medium",
    prefijo: "text-2xl",
  },
} as const;

/** El contenedor que pinta la caja, el prefijo y la unidad de un campo grande. */
function Campo({
  variante,
  prefijo,
  unidad,
  className,
  children,
}: {
  variante: "cifra" | "serie";
  prefijo?: React.ReactNode;
  unidad?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const v = CAMPO[variante];
  return (
    <div
      data-slot="campo"
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 has-[input:focus-visible]:[box-shadow:var(--fsh-f)] has-[input:disabled]:opacity-[.55]",
        CAJA,
        v.caja,
        className,
      )}
    >
      {prefijo != null && (
        <span className={cn("text-ink2 shrink-0", v.prefijo)} aria-hidden="true">
          {prefijo}
        </span>
      )}
      {children}
      {unidad != null && <span className={cn("text-ink2 shrink-0", v.unidad)}>{unidad}</span>}
    </div>
  );
}

type InputProps = Omit<React.ComponentProps<"input">, "prefix"> & {
  variante?: VarianteInput;
  /** Solo `cifra` y `serie`: texto que va después del número («kg», «reps»). */
  unidad?: React.ReactNode;
  /** Solo `cifra` y `serie`: texto que va antes del número («$»). */
  prefijo?: React.ReactNode;
};

function Input({ className, type, variante = "texto", unidad, prefijo, ...props }: InputProps) {
  if (variante === "texto") {
    return <input type={type} data-slot="input" className={cn(TEXTO, className)} {...props} />;
  }
  return (
    <Campo variante={variante} unidad={unidad} prefijo={prefijo} className={className}>
      <input
        type={type}
        data-slot="input"
        className={cn(
          "text-ink min-w-0 flex-1 [font-variant-numeric:tabular-nums] bg-transparent outline-none",
          "h-full self-stretch",
          CAMPO[variante].input,
        )}
        {...props}
      />
    </Campo>
  );
}

export { Input, Campo };
