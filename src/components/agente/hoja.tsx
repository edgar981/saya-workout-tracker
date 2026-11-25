"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Gotas } from "@/components/agente/orbe";
import {
  leerRespuesta,
  prepararPedido,
  type Vista,
} from "@/components/agente/estado";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { alAbrirAgente } from "@/lib/agente/abrir";
import { MAX_PREGUNTA } from "@/lib/agente/contrato";
import { EJEMPLOS, periodoDe } from "@/lib/agente/filas";
import { leerDatosCuerpo } from "@/lib/db/agente";
import { todayISO } from "@/lib/db/queries";

/** Lo que espera el teléfono al servidor antes de rendirse. */
const ESPERA_MS = 30000;

const FOCALIZABLES = 'a[href],button:not([disabled]),input:not([disabled])';

function Ejemplos({ preguntar }: { preguntar: (p: string) => void }) {
  return (
    <div className="ag-qs">
      {EJEMPLOS.map((q) => (
        <button key={q} type="button" className="ag-q" onClick={() => preguntar(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}

/**
 * La hoja «Pregúntale a tus datos» (SAYA-R2-6). La abre el orbe de la barra
 * (`alAbrirAgente`). Sólo lee de Dexie y manda a la ruta las filas que la
 * pregunta necesita; no guarda preguntas ni respuestas (§3.5).
 */
export function HojaAgente() {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>({ tipo: "preguntar" });
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const turnoRef = useRef(0);

  const cancelar = useCallback(() => {
    turnoRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(
    () =>
      alAbrirAgente(() => {
        cancelar();
        setVista({ tipo: "preguntar" });
        setAbierto(true);
      }),
    [cancelar],
  );

  // Al desmontar, un pedido en curso no cambia nada.
  useEffect(() => cancelar, [cancelar]);

  const cerrar = useCallback(() => {
    cancelar();
    setAbierto(false);
    setVista({ tipo: "preguntar" });
  }, [cancelar]);

  const preguntar = useCallback(
    async (texto: string) => {
      const pregunta = texto.trim();
      if (pregunta === "") return;
      cancelar();
      const turno = turnoRef.current;
      const control = new AbortController();
      abortRef.current = control;

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setVista({ tipo: "error", pregunta });
        return;
      }
      setVista({ tipo: "pensando", pregunta });

      const temporizador = setTimeout(() => control.abort(), ESPERA_MS);
      let siguiente: Vista;
      try {
        const hoy = todayISO();
        const datos = await leerDatosCuerpo(periodoDe(pregunta, hoy).desde);
        const pedido = prepararPedido(pregunta, hoy, datos, new Date().getTimezoneOffset());
        if (pedido.tipo === "error") siguiente = { tipo: "error", pregunta };
        else {
          const res = await fetch("/api/agente", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: pedido.texto,
            cache: "no-store",
            signal: control.signal,
          });
          const cuerpo: unknown = await res.json().catch(() => null);
          siguiente = leerRespuesta(pregunta, res.status, cuerpo);
        }
      } catch {
        siguiente = { tipo: "error", pregunta };
      } finally {
        clearTimeout(temporizador);
      }
      if (turnoRef.current !== turno) return;
      abortRef.current = null;
      setVista(siguiente);
    },
    [cancelar],
  );

  // Al cambiar de vista el foco pasa al primer control de la nueva; en
  // «pensando», al panel.
  const tipo = vista.tipo;
  useEffect(() => {
    if (!abierto) return;
    const cuerpo = cuerpoRef.current;
    if (!cuerpo) return;
    if (tipo === "pensando") {
      cuerpo.closest<HTMLElement>('[role="dialog"]')?.focus();
      return;
    }
    cuerpo.querySelector<HTMLElement>(FOCALIZABLES)?.focus();
  }, [abierto, tipo]);

  return (
    <Panel abierto={abierto} alCerrar={cerrar} titulo="Pregúntale a tus datos">
      <div ref={cuerpoRef}>
        {vista.tipo === "preguntar" && (
          <>
            <Ejemplos preguntar={preguntar} />
            <form
              className="ag-askf"
              onSubmit={(e) => {
                e.preventDefault();
                const campo = campoRef.current;
                const texto = campo?.value.trim() ?? "";
                if (texto === "") {
                  campo?.focus();
                  return;
                }
                void preguntar(texto);
              }}
            >
              <Input
                ref={campoRef}
                variante="texto"
                placeholder="Escribe una pregunta"
                aria-label="Pregunta"
                autoComplete="off"
                enterKeyHint="send"
                maxLength={MAX_PREGUNTA}
                className="h-[50px] min-h-[50px] flex-1 min-w-0 rounded-[25px] px-[18px]"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Preguntar"
                className="size-[50px] rounded-[25px] [&_svg]:size-[22px]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 19V5.5M6 11l6-6 6 6" />
                </svg>
              </Button>
            </form>
          </>
        )}

        {vista.tipo === "pensando" && (
          <>
            <p className="dek mt-3.5">{vista.pregunta}</p>
            <div className="ag-pensando" role="status">
              <Gotas />
              <b>Pensando…</b>
            </div>
          </>
        )}

        {vista.tipo === "respuesta" && (
          <>
            <p className="dek mt-3.5">{vista.pregunta}</p>
            <p className="cifra mt-2.5">
              {vista.respuesta.cifra}
              {vista.respuesta.unidad !== "" && (
                <span className="cifra-u ml-[5px]">{vista.respuesta.unidad}</span>
              )}
            </p>
            {vista.respuesta.desglose.length > 0 && (
              <div className="mt-2.5">
                {vista.respuesta.desglose.map((d, i) => (
                  <Fila key={i} titulo={d.etiqueta} valor={d.valor} />
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              className="mt-[18px] w-full"
              onClick={() => setVista({ tipo: "preguntar" })}
            >
              Otra pregunta
            </Button>
          </>
        )}

        {vista.tipo === "sin_datos" && (
          <>
            <p className="dek mt-3.5">{vista.pregunta}</p>
            <p className="tit-3 mt-3.5">No encuentro datos para eso.</p>
            <Ejemplos preguntar={preguntar} />
          </>
        )}

        {vista.tipo === "error" && (
          <>
            <p className="dek mt-3.5">{vista.pregunta}</p>
            <ErrorEnLinea className="mt-3.5">
              No se pudo responder.
              <Button
                variant="link"
                className="mt-0.5 block"
                onClick={() => void preguntar(vista.pregunta)}
              >
                Reintentar
              </Button>
            </ErrorEnLinea>
          </>
        )}
      </div>
    </Panel>
  );
}
