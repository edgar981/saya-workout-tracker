import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Fila `.row` (§3): título `.t` sobre subtítulo `.s` a la izquierda; `.v` y el
 * chevron a la derecha; un índice `.ix` («01») a la izquierda en las filas de
 * día. El divisor de 1px --hair va arriba de toda fila menos la primera.
 *
 * Si la fila navega (`href`) es un `<Link>`; si actúa (`onClick`) es un
 * `<button>` entero; ambos de al menos 44px de alto (la fila mide 60). Sin
 * ninguno de los dos es un `<div>` informativo, sin chevron.
 */
type FilaBase = {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  valor?: ReactNode;
  /** «01»: el número de índice de las filas de día. */
  indice?: ReactNode;
  /** El chevron de la derecha; por defecto solo si la fila es navegable/accionable. */
  chevron?: boolean;
  className?: string;
};

function Contenido({ titulo, subtitulo, valor, indice, chevron }: FilaBase) {
  return (
    <>
      {indice != null && <span className="fila-s fila-ix">{indice}</span>}
      <span className="fila-m">
        <span className="fila-t block">{titulo}</span>
        {subtitulo != null && <span className="fila-s block">{subtitulo}</span>}
      </span>
      {valor != null && <span className="fila-v">{valor}</span>}
      {chevron && <ChevronRight className="fila-chev size-[18px]" aria-hidden="true" />}
    </>
  );
}

export function Fila(
  props:
    | (FilaBase & { href: string; onClick?: undefined } & Omit<
          ComponentProps<typeof Link>,
          keyof FilaBase | "href"
        >)
    | (FilaBase & { href?: undefined; onClick: ComponentProps<"button">["onClick"] } & Omit<
          ComponentProps<"button">,
          keyof FilaBase | "onClick"
        >)
    | (FilaBase & { href?: undefined; onClick?: undefined }),
) {
  const { titulo, subtitulo, valor, indice, chevron, className, ...resto } = props;

  if (props.href !== undefined) {
    const { href, ...enlace } = resto as { href: string } & Omit<ComponentProps<typeof Link>, "href">;
    return (
      <Link href={href} className={cn("fila", className)} {...enlace}>
        <Contenido
          titulo={titulo}
          subtitulo={subtitulo}
          valor={valor}
          indice={indice}
          chevron={chevron ?? true}
        />
      </Link>
    );
  }
  if (props.onClick !== undefined) {
    return (
      <button
        type="button"
        className={cn("fila", className)}
        {...(resto as ComponentProps<"button">)}
      >
        <Contenido
          titulo={titulo}
          subtitulo={subtitulo}
          valor={valor}
          indice={indice}
          chevron={chevron ?? true}
        />
      </button>
    );
  }
  return (
    <div className={cn("fila", className)}>
      <Contenido
        titulo={titulo}
        subtitulo={subtitulo}
        valor={valor}
        indice={indice}
        chevron={chevron ?? false}
      />
    </div>
  );
}
