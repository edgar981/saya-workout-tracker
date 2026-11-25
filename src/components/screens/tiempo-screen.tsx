"use client";

import { useEffect, useState, type ReactNode } from "react";

import { TiempoSheet } from "@/components/tiempo-sheet";
import { TiempoSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { BloqueError } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { todayISO } from "@/lib/db/queries";
import { leer } from "@/lib/tiempo/cliente";
import {
  desdeParaLeer,
  escalaTemas,
  etiquetaRegistro,
  formatoHM,
  lineaDiferencia,
  partesHM,
  porcentajeDe,
  rangoSemana,
  resumen,
  type DatosTiempo,
  type RegistroTiempoDto,
  type TemaResumen,
  type TemaTiempo,
} from "@/lib/tiempo/semana";

/** Los registros más recientes que se muestran. */
const ULTIMOS = 5;

type Estado = { tipo: "cargando" } | { tipo: "error" } | { tipo: "datos"; datos: DatosTiempo };

export default function TiempoScreen() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  // «Reintentar» vuelve a leer: cambia la dependencia del efecto.
  const [intento, setIntento] = useState(0);
  const [hoy] = useState(() => todayISO());

  useEffect(() => {
    const control = new AbortController();
    void leer(desdeParaLeer(hoy), { signal: control.signal }).then((r) => {
      if (control.signal.aborted) return;
      setEstado(r.ok ? { tipo: "datos", datos: r.datos } : { tipo: "error" });
    });
    return () => control.abort();
  }, [hoy, intento]);

  if (estado.tipo === "cargando") return <TiempoSkeleton />;

  /** Suma a lo que ya hay el tema y el registro que devolvió el servidor. */
  const agregar = (tema: TemaTiempo, registro: RegistroTiempoDto) => {
    setEstado((previo) => {
      if (previo.tipo !== "datos") return previo;
      const d = previo.datos;
      const temas = d.temas.some((t) => t.id === tema.id)
        ? d.temas
        : [...d.temas, tema].sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0));
      const registros = d.registros.some((r) => r.id === registro.id)
        ? d.registros
        : [...d.registros, registro].sort(
            (a, b) =>
              (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0) ||
              (a.anotado_en < b.anotado_en ? 1 : a.anotado_en > b.anotado_en ? -1 : 0),
          );
      const primer =
        d.primer_registro === null || registro.fecha < d.primer_registro
          ? registro.fecha
          : d.primer_registro;
      return { tipo: "datos", datos: { temas, registros, primer_registro: primer } };
    });
  };

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Tiempo" subtitulo="Aprender" ajustes />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          {estado.tipo === "error" ? (
            <BloqueError
              titulo="No se pudo leer tu tiempo."
              alReintentar={() => {
                setEstado({ tipo: "cargando" });
                setIntento((n) => n + 1);
              }}
            />
          ) : (
            <Contenido datos={estado.datos} hoy={hoy} agregar={agregar} />
          )}
        </main>
      </Hoja>
    </>
  );
}

function Seccion({
  titulo,
  derecha,
  children,
}: {
  titulo: string;
  derecha?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="sec">
      <div className="sec-cab">
        <h2 className="kicker">{titulo}</h2>
        {derecha != null && <span className="kicker kicker-d">{derecha}</span>}
      </div>
      {children}
    </section>
  );
}

function Contenido({
  datos,
  hoy,
  agregar,
}: {
  datos: DatosTiempo;
  hoy: string;
  agregar: (tema: TemaTiempo, registro: RegistroTiempoDto) => void;
}) {
  const [hoja, setHoja] = useState(false);
  const vacio = datos.primer_registro === null;
  const r = resumen(datos, hoy);
  const diferencia = lineaDiferencia(r.minutos, r.tipica);
  const nombres = new Map(datos.temas.map((t) => [t.id, t.nombre]));
  const recientes = datos.registros.slice(0, ULTIMOS);
  const escala = escalaTemas(r.temas);

  return (
    <>
      <Seccion titulo="Últimos 7 días" derecha={rangoSemana(hoy)}>
        <p className="cifra">
          {partesHM(r.minutos).map((p, i) => (
            <span key={p.u}>
              {i > 0 && " "}
              {p.n} <span className="cifra-u">{p.u}</span>
            </span>
          ))}
        </p>
        {!vacio && r.tipica !== null && (
          <p className="dek">
            Típica {formatoHM(r.tipica)}
            {diferencia !== null && ` · ${diferencia}`}
          </p>
        )}
        <Button className="mt-3 w-full" onClick={() => setHoja(true)}>
          Anotar tiempo
        </Button>
        <TiempoSheet
          abierto={hoja}
          alCerrar={() => setHoja(false)}
          temas={datos.temas}
          alGuardar={agregar}
        />
      </Seccion>

      {!vacio && (
        <>
          <Seccion titulo="Por tema">
            <div>
              {r.temas.map((t) => (
                <FilaTema key={t.id} tema={t} escala={escala} />
              ))}
            </div>
          </Seccion>

          {recientes.length > 0 && (
            <Seccion titulo="Registros" derecha={`últimos ${recientes.length}`}>
              <div>
                {recientes.map((reg) => (
                  <Fila
                    key={reg.id}
                    titulo={nombres.get(reg.tema_id) ?? "Tema"}
                    subtitulo={etiquetaRegistro(reg, hoy)}
                    valor={formatoHM(reg.minutos)}
                  />
                ))}
              </div>
            </Seccion>
          )}
        </>
      )}
    </>
  );
}

/** Una fila de «Por tema»: nombre y minutos, el medidor y la típica. */
function FilaTema({ tema, escala }: { tema: TemaResumen; escala: number }) {
  return (
    <Fila
      titulo={tema.nombre}
      valor={tema.minutos > 0 ? formatoHM(tema.minutos) : <span className="text-ink2">—</span>}
      subtitulo={
        <>
          <span className="med" aria-hidden="true">
            <span className="med-r" style={{ width: `${porcentajeDe(tema.minutos, escala)}%` }} />
            {tema.tipica !== null && (
              <span className="med-m" style={{ left: `${porcentajeDe(tema.tipica, escala)}%` }} />
            )}
          </span>
          {tema.tipica !== null && (
            <span className="mt-1.5 block">típica {formatoHM(tema.tipica)}</span>
          )}
        </>
      }
    />
  );
}
