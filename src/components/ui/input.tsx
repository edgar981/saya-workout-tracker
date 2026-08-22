import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // text-base (16px) no es estético: por debajo de 16px iOS hace zoom al
        // enfocar el campo, y eso a mitad de una serie es insufrible.
        "border-input bg-background flex h-11 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-colors outline-none",
        "placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
