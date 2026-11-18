import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/*
 * El anillo líquido: un borde cónico que gira (7 s, un solo elemento, sólo
 * `transform`). Autónomo a propósito (Tailwind y estilo en línea, sin clases de
 * globals.css): el slice 4 lleva una copia idéntica. Sin movimiento reducido, no
 * gira.
 */

/** El borde líquido, superpuesto. El padre pone `relative`, el radio y `isolate`.
 *  `redondo` es el del chip de Sesión (círculo de 44px). */
export function Anillo({ redondo = false, className }: { redondo?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
      style={{
        padding: redondo ? 2 : 1.5,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
      }}
    >
      <i
        className="absolute top-1/2 left-1/2 -mt-[100%] -ml-[100%] h-0 w-[200%] animate-[spin_7s_linear_infinite] pb-[200%] will-change-transform motion-reduce:animate-none"
        style={{
          background:
            "conic-gradient(from 0deg,#eef0f4,#8a8f99 10%,#fff 17%,#ff7a3d 22%,#ffd447 26%,#5cf2b5 30%,#3fb0ff 34%,#dfe2e8 42%,#6c717b 55%,#f7f8fa 64%,#9aa0aa 78%,#eef0f4)",
        }}
      />
    </span>
  );
}

/** La tarjeta `.lmc`: con `href` es un enlace; sin él, un `<div>`. Sin desenfoque. */
export function TarjetaAnillo({
  chica = false,
  href,
  className,
  children,
}: {
  chica?: boolean;
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const clases = cn(
    "relative isolate block w-full text-left text-ink",
    chica ? "rounded-[20px] px-4 py-3.5" : "rounded-[24px] p-[18px]",
    className,
  );
  const estilo = {
    background: "linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.02))",
  };
  if (href !== undefined) {
    return (
      <Link href={href} className={clases} style={estilo}>
        <Anillo />
        {children}
      </Link>
    );
  }
  return (
    <div className={clases} style={estilo}>
      <Anillo />
      {children}
    </div>
  );
}

/** Las barras de avance de la sesión: las primeras `hechos` en cromo. */
export function Segmentos({ total, hechos }: { total: number; hechos: number }) {
  if (total <= 0) return null;
  return (
    <span aria-hidden="true" className="mt-3.5 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <i
          key={i}
          className="h-1.5 flex-1 rounded-[3px]"
          style={{ background: i < hechos ? "var(--chrome)" : "rgba(255,255,255,.14)" }}
        />
      ))}
    </span>
  );
}
