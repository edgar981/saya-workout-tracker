import * as React from "react";

import { cn } from "@/lib/utils";

/** Textarea: el aspecto de `Input` variante `texto` (.tin), con alto mínimo. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "bg-fbg text-ink flex min-h-28 w-full rounded-2xl px-4 py-3.5 text-base font-normal outline-none",
        "[box-shadow:var(--fsh)] transition-[box-shadow] duration-200 ease-[var(--ease)]",
        "focus-visible:[box-shadow:var(--fsh-f)]",
        "disabled:pointer-events-none disabled:opacity-[.55]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
