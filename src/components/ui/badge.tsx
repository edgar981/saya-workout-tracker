import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Badge `.bd`: alto 24, aro --hair. Un badge ya no es un relleno de acento (un
 * veredicto nunca es acento): `default`, `secondary` y `outline` se aplanan al
 * mismo `.bd`; los nombres se conservan para no tocar a los llamadores.
 * `destructive` es `.bd.ko`: aro rojo a .6 con texto en tinta.
 */
const BD =
  "text-ink2 [box-shadow:inset_0_0_0_1px_var(--hair)]";

const badgeVariants = cva(
  "inline-flex h-6 items-center justify-center gap-1 rounded-xl px-[9px] text-xs leading-none font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: BD,
        secondary: BD,
        outline: BD,
        destructive: "text-ink [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.6)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
