"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { paneles } from "@/lib/liquido";
import { cn } from "@/lib/utils";

/*
 * Panel y Aviso (§3): SÓLIDOS, no agregan desenfoque. Se montan en un portal en
 * `document.body`: así no dependen de ningún ancestro (z-index, contenedores).
 */

const FOCALIZABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Panel inferior `.pane`, con velo `scrim`. Mientras está abierto el líquido se
 * detiene (`paneles`), el scroll de la página queda quieto, Escape lo cierra, el
 * foco entra al abrir y vuelve a quien lo abrió. El cuerpo se desplaza
 * (`overflow-y: auto`) para que un campo con teclado abierto quede a la vista.
 * Quién lo abre y lo cierra lo decide el llamador (`abierto`, `alCerrar`); al
 * cerrarse se desmonta sin animación de salida.
 */
export function Panel({
  abierto,
  alCerrar,
  titulo,
  children,
  className,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const idTitulo = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const alCerrarRef = useRef(alCerrar);
  useEffect(() => {
    alCerrarRef.current = alCerrar;
  }, [alCerrar]);

  useEffect(() => {
    if (!abierto) return;
    const abridor = document.activeElement as HTMLElement | null;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    paneles.abrir();
    // El foco entra: al primer elemento focalizable, o al panel mismo.
    const panel = panelRef.current;
    const primero = panel?.querySelector<HTMLElement>(FOCALIZABLES);
    (primero ?? panel)?.focus();

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        alCerrarRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Trampa de foco mínima: el Tab no sale del panel.
      const lista = Array.from(panel.querySelectorAll<HTMLElement>(FOCALIZABLES));
      if (lista.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const primera = lista[0];
      const ultima = lista[lista.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primera || activo === panel)) {
        e.preventDefault();
        ultima.focus();
      } else if (!e.shiftKey && activo === ultima) {
        e.preventDefault();
        primera.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
      paneles.cerrar();
      if (abridor && document.contains(abridor)) abridor.focus();
    };
  }, [abierto]);

  if (!abierto || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="scrim" onClick={() => alCerrar()} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={cn("pane", className)}
      >
        <div className="pane-cab">
          <h2 id={idTitulo} className="tit-3">
            {titulo}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => alCerrar()}
            className="text-ink2 -mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none outline-none focus-visible:[box-shadow:var(--fsh-f)]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="pane-cuerpo">{children}</div>
      </div>
    </>,
    document.body,
  );
}

/**
 * Aviso `.toast`: `role="status"`, sube 10px con desvanecimiento. Quién lo monta
 * y cuándo lo quita lo decide el llamador: aquí no hay ningún tiempo.
 * `conBarraAgente`: abajo 84 (la barra del agente está puesta); si no, 90 más el
 * área segura.
 */
export function Aviso({
  children,
  conBarraAgente = false,
  className,
}: {
  children: ReactNode;
  conBarraAgente?: boolean;
  className?: string;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      className={cn("toast", className)}
      data-barra-agente={conBarraAgente ? "" : undefined}
    >
      {children}
    </div>,
    document.body,
  );
}
