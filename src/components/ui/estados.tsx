import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Bloques de estado (§3). El título del error y el del vacío llegan por prop (el
 * llamador los pone); los únicos textos propios son «Tus datos no se tocaron.» y
 * «Reintentar», tal como los aprobó el owner en la maqueta. La carga son barras
 * de esqueleto con la forma del estado completo (skeletons.tsx): sin spinners.
 */

/** Error `.err`: disco rojo con «!», título, «Tus datos no se tocaron.» y
 *  «Reintentar» (de acento si reintentar es la acción primaria de la pantalla;
 *  `secondary` si no). `role="alert"`: el error se dice con palabras. */
export function BloqueError({
  titulo,
  alReintentar,
  primaria = false,
  className,
}: {
  titulo: ReactNode;
  alReintentar: () => void;
  /** Reintentar es la acción primaria de la pantalla → botón de acento. */
  primaria?: boolean;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("err", className)}>
      <span className="err-disco" aria-hidden="true">
        !
      </span>
      <div>
        <p className="err-t">{titulo}</p>
        <p className="err-s">Tus datos no se tocaron.</p>
      </div>
      <Button variant={primaria ? "default" : "secondary"} onClick={alReintentar}>
        Reintentar
      </Button>
    </div>
  );
}

/** Error en línea `.errbox` (dentro de paneles y de Sesión). */
export function ErrorEnLinea({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("errbox err-t", className)}>
      {children}
    </div>
  );
}

/** Vacío: una línea `.h3` (o `.t`), una línea `.dek` y, como máximo, una salida.
 *  Sin ilustración. */
export function Vacio({
  titulo,
  texto,
  salida,
  className,
}: {
  titulo: ReactNode;
  texto?: ReactNode;
  /** La única salida (un botón o un enlace). */
  salida?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <p className="tit-3">{titulo}</p>
      {texto != null && <p className="dek">{texto}</p>}
      {salida}
    </div>
  );
}
