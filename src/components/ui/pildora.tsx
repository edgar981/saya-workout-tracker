import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Píldora `.pill` (§3): una opción de una elección. Es un `<button>` con
 * `aria-pressed`. Presionada: texto blanco, fondo .15 y aro de 1.5px a .75.
 * Mixta (grupo indirecto): aro a .4 más «½»; `aria-pressed="mixed"` y el «½» lo
 * dicen con texto, no solo con el aro.
 */
export function Pildora({
  presionada = false,
  mixta = false,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "aria-pressed" | "type"> & {
  presionada?: boolean;
  mixta?: boolean;
}) {
  const aro = mixta
    ? "[box-shadow:inset_0_0_0_1.5px_rgba(255,255,255,.4)]"
    : presionada
      ? "[box-shadow:inset_0_0_0_1.5px_rgba(255,255,255,.75)]"
      : "[box-shadow:inset_0_0_0_1px_var(--hair)]";
  return (
    <button
      type="button"
      data-slot="pildora"
      aria-pressed={mixta ? "mixed" : presionada}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[22px] px-4 text-sm font-medium",
        "outline-none transition-[background-color,box-shadow,color] duration-200 ease-[var(--ease)]",
        "focus-visible:[box-shadow:var(--fsh-f)] disabled:pointer-events-none disabled:opacity-[.55]",
        presionada && !mixta ? "bg-white/15 text-white" : "bg-white/[.04] text-ink2",
        aro,
        className,
      )}
      {...props}
    >
      {children}
      {mixta && <span>½</span>}
    </button>
  );
}
