import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Botón de Cromo líquido. Mismas variantes y tamaños por nombre que antes, para
 * que ningún llamador cambie. `default` es `.btn` (EL acento: cromo con tinta
 * #0B0C0F encima), `secondary` es `.btn2`. «Máximo un botón de acento por
 * pantalla» es una regla de uso, no del componente. Todo tamaño tiene un alto de
 * toque de al menos 44px. El enlace de texto `.tl` es la variante `link` (su CSS
 * vive en globals.css; `className="danger"` lo pasa a --red-t).
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full",
    "text-[15px] leading-5 font-semibold [font-stretch:var(--w-btn)]",
    "transition-[opacity,box-shadow] duration-200 ease-[var(--ease)] outline-none",
    "focus-visible:[box-shadow:var(--fsh-f)]",
    "disabled:pointer-events-none disabled:opacity-[.55]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-primary bg-[image:var(--chrome)] text-accent-ink",
          "[box-shadow:inset_0_1px_0_#fff,inset_0_-1px_0_rgba(0,0,0,.25),0_10px_24px_rgba(0,0,0,.45)]",
        ],
        destructive: "bg-[var(--red)] text-[#1a0306]",
        outline: "bg-transparent text-ink [box-shadow:var(--glass)]",
        secondary: [
          "bg-white/[.07] text-ink font-medium [font-stretch:100%]",
          "[box-shadow:inset_0_1px_0_rgba(255,255,255,.16),inset_0_0_0_1px_rgba(255,255,255,.1)]",
        ],
        ghost: "bg-transparent text-ink hover:bg-white/[.08]",
        link: "tl rounded-none px-0",
      },
      size: {
        default: "min-h-12 px-[22px]",
        sm: "min-h-11 px-4 text-sm",
        lg: "min-h-14 px-7",
        icon: "size-12 min-h-11 min-w-11",
        "icon-sm": "size-11 min-h-11 min-w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
