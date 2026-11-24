"use client";

import { abrirAgente } from "@/lib/agente/abrir";

/** Las gotas del orbe. `SAYA-R2-6` las reusa en su píldora «Pensando…». */
export function Gotas() {
  return (
    <span className="liq" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** El orbe del agente, a la derecha de la barra de abajo. */
export function Orbe() {
  return (
    <button
      type="button"
      className="orbb"
      aria-label="Pregúntale a tus datos"
      onClick={() => abrirAgente()}
    >
      <span className="orb big" aria-hidden="true">
        <Gotas />
      </span>
    </button>
  );
}
