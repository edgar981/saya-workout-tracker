"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { fechaCorta } from "@/components/progress/estado";
import { formatoPeso, type PesoResumen } from "@/lib/cuerpo";
import { anotarPeso, todayISO } from "@/lib/db/queries";
import { parsePeso } from "@/lib/peso";

/**
 * Hoja «Anotar peso». La unidad es la del último registro (sin registros, kg):
 * no hay selector. Guardar es local (Dexie), no espera red. Al guardar bien se
 * cierra; Cuerpo se actualiza solo (su lectura es una consulta viva). Al fallar
 * queda abierta, con lo tecleado y «peso-error».
 */
export function PesoSheet({
  abierto,
  alCerrar,
  peso,
}: {
  abierto: boolean;
  alCerrar: () => void;
  peso: PesoResumen | null;
}) {
  return (
    <Panel abierto={abierto} alCerrar={alCerrar} titulo="Anotar peso">
      <Formulario alCerrar={alCerrar} peso={peso} />
    </Panel>
  );
}

// Vive dentro del Panel: se monta al abrir y se desmonta al cerrar, así cada
// apertura empieza con el campo vacío y sin error.
function Formulario({ alCerrar, peso }: { alCerrar: () => void; peso: PesoResumen | null }) {
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);

  const unidad = peso?.unidad ?? "kg";
  const valor = parsePeso(texto);

  const guardar = async () => {
    if (valor === null || guardando) return;
    setGuardando(true);
    setError(false);
    try {
      await anotarPeso(valor, unidad === "kg" ? "KG" : "LB");
      alCerrar();
    } catch {
      setError(true);
      setGuardando(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <p className="dek">Hoy, {fechaCorta(todayISO())}</p>
      <Input
        variante="cifra"
        unidad={unidad}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        inputMode="decimal"
        placeholder="78,4"
        aria-label="Peso corporal"
        autoComplete="off"
      />
      {peso && (
        <p className="dek">
          Último: {formatoPeso(peso.ultimo)} {peso.unidad} · {fechaCorta(peso.ultimaFecha)}
        </p>
      )}
      {error && (
        <ErrorEnLinea>
          <p>No se pudo guardar el peso.</p>
          <p className="err-s">Tus datos no se tocaron.</p>
        </ErrorEnLinea>
      )}
      <Button type="submit" size="lg" disabled={valor === null || guardando}>
        {error ? "Reintentar" : "Guardar"}
      </Button>
    </form>
  );
}
