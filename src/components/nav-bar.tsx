"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";

import { AREAS, indiceDeArea } from "@/lib/navegacion";

/**
 * Navegación de Cromo líquido (§2): las pestañas de vidrio `.tabs` y la píldora
 * de atrás `.pback`. Ambas son `position: fixed` y están montadas a la vez; una
 * se ve y la otra se esconde (`data-oculto` → `visibility: hidden`), así nunca se
 * pintan juntas. Las pestañas se ven en las rutas `area`, la píldora en las
 * `empujada`; en `sesion` el shell no monta nada.
 *
 * La activa se marca con la pastilla `.tind` (vidrio blanco) y NUNCA con el
 * acento cromo (DECISIONES.md §10). Todo lo que decide a dónde va «‹» vive en
 * `lib/navegacion.ts`; aquí sólo se pinta.
 */
export function NavBar({
  pathname,
  nivel,
  etiqueta,
  alAtras,
}: {
  pathname: string;
  nivel: "area" | "empujada";
  /** La etiqueta del DESTINO de la píldora. */
  etiqueta: string;
  alAtras: () => void;
}) {
  const idx = indiceDeArea(pathname);

  // La pastilla se queda en la última área vista mientras las pestañas están
  // escondidas. `gen` cuenta los cambios de activa: el estiramiento corre una
  // vez por cambio (no en la primera pintura).
  const [estado, setEstado] = useState({ activo: idx ?? 0, gen: 0 });
  if (idx !== null && idx !== estado.activo) {
    setEstado({ activo: idx, gen: estado.gen + 1 });
  }

  const n = AREAS.length;
  const estilo = { "--n": n, "--i": estado.activo } as CSSProperties;

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="tabs"
        data-oculto={nivel === "area" ? undefined : ""}
        style={estilo}
      >
        <span className="tind" aria-hidden="true">
          <span key={estado.gen} className="tind-i" data-estira={estado.gen > 0 ? "" : undefined} />
        </span>
        {AREAS.map((area, i) => (
          <Link
            key={area.href}
            href={area.href}
            className="tab"
            aria-current={idx === i ? "page" : undefined}
          >
            {area.etiqueta}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className="pback"
        data-oculto={nivel === "empujada" ? undefined : ""}
        aria-label={`Volver a ${etiqueta}`}
        onClick={alAtras}
      >
        <b aria-hidden="true">‹</b>
        {etiqueta}
      </button>
    </>
  );
}
