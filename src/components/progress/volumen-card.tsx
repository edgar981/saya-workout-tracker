"use client";

import { useState } from "react";

import { ESTADO_LABEL } from "@/components/progress/estado";
import { escalaVolumen, filasHojaGrupo } from "@/components/progress/semanas";
import { Panel } from "@/components/ui/panel";
import type { ProgresoFila } from "@/lib/db/progress";
import { decimalComa } from "@/lib/leer";
import { redondearMedia, type Volumen, type VolumenGrupo } from "@/lib/volumen";

/**
 * Volumen por grupo muscular (DECISIONES.md §12), ronda 2: la leyenda, una fila por
 * grupo (`.vrow`, de mayor a menor: lo poco queda al fondo) y, al tocarla, una hoja
 * con lo que aportó cada ejercicio. Sin rango de referencia — solo tus números. Dos
 * tramos por barra: directas en tinta clara, lo contado (directas + ½ indirectas)
 * en tinta tenue. Nada de acento, rojo ni verde (§10).
 */

const media = (x: number) => decimalComa(redondearMedia(x));
const escala = (x: number) => Math.min(1, Math.max(0, x)).toFixed(4);

export function VolumenCard({
  volumen,
  filas,
  vacio,
}: {
  volumen: Volumen;
  filas: ProgresoFila[];
  vacio: boolean;
}) {
  const [abierto, setAbierto] = useState<VolumenGrupo | null>(null);
  const sinDatos = vacio || volumen.tipicas.length === 0;
  const max = escalaVolumen(volumen.grupos);

  const estadoDe = (id: string): string | null => {
    const f = filas.find((x) => x.exercise.id === id);
    return f && f.progreso.estado !== "sin_registros" ? ESTADO_LABEL[f.progreso.estado] : null;
  };
  const hoja = abierto ? filasHojaGrupo(abierto, estadoDe) : null;

  return (
    <>
      <div className="leg" aria-hidden="true">
        <span>
          <i />
          Directas
        </span>
        <span>
          <i className="u" />
          Indirectas ½
        </span>
      </div>

      <div className="vrows" style={{ marginTop: 6 }}>
        {volumen.grupos.map((g) => {
          const mut = sinDatos || g.tipica === 0;
          return (
            <button key={g.grupo} type="button" className="vrow" onClick={() => setAbierto(g)}>
              <span className="t">{g.nombre}</span>
              <span className={mut ? "v mut" : "v"}>{sinDatos ? "—" : media(g.tipica)}</span>
              <span className="vbar grow" aria-hidden="true">
                <u style={{ transform: `scaleX(${sinDatos ? 0 : escala(g.tipica / max)})` }} />
                <i style={{ transform: `scaleX(${sinDatos ? 0 : escala(g.directas / max)})` }} />
              </span>
            </button>
          );
        })}
      </div>

      {!vacio && volumen.sinGrupo.length > 0 && (
        <p className="s foot">Sin grupo · {volumen.sinGrupo.map((e) => e.nombre).join(" · ")}</p>
      )}

      <Panel
        abierto={abierto !== null}
        alCerrar={() => setAbierto(null)}
        titulo={abierto?.nombre ?? ""}
        className="pro-hoja"
      >
        {hoja && (
          <>
            <p className="s r25-sub">{hoja.subtitulo}</p>
            {hoja.filas.length === 0 ? (
              <div className="efr">—</div>
            ) : (
              <div className="rows">
                {hoja.filas.map((f, i) => (
                  <div key={i} className="row">
                    <span className="m">
                      <span className="t">{f.t}</span>
                      {f.s !== undefined && <span className="s">{f.s}</span>}
                    </span>
                    <span className="v">{f.v}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
