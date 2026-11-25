"use client";

import { useRef, useState } from "react";

import { fechaCorta } from "@/components/progress/estado";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea } from "@/components/ui/estados";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Pildora } from "@/components/ui/pildora";
import { todayISO } from "@/lib/db/queries";
import { guardarRegistro, guardarTema } from "@/lib/tiempo/cliente";
import type { RegistroTiempoDto, TemaTiempo } from "@/lib/tiempo/semana";

/** Los minutos rápidos. */
const RAPIDOS = [25, 45, 60, 90] as const;

/** Entero de 1 a 1440 en el campo «Otro, en minutos»; si no, `null`. */
export function parseMinutos(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 1440 ? n : null;
}

/**
 * Hoja «Anotar tiempo». Tiempo vive en el servidor: guardar espera la red. Si el
 * tema es nuevo se guarda primero y se usa el `id` que devuelve el servidor; con
 * éxito la hoja se cierra y la pantalla suma lo devuelto, sin una segunda lectura.
 * Al fallar queda abierta, con lo tecleado y «tiempo-error».
 */
export function TiempoSheet({
  abierto,
  alCerrar,
  temas,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  temas: readonly TemaTiempo[];
  alGuardar: (tema: TemaTiempo, registro: RegistroTiempoDto) => void;
}) {
  return (
    <Panel abierto={abierto} alCerrar={alCerrar} titulo="Anotar tiempo">
      <Formulario alCerrar={alCerrar} temas={temas} alGuardar={alGuardar} />
    </Panel>
  );
}

// Vive dentro del Panel: se monta al abrir y se desmonta al cerrar, así cada
// apertura empieza vacía y sin error.
function Formulario({
  alCerrar,
  temas,
  alGuardar,
}: {
  alCerrar: () => void;
  temas: readonly TemaTiempo[];
  alGuardar: (tema: TemaTiempo, registro: RegistroTiempoDto) => void;
}) {
  const [temaId, setTemaId] = useState<string | null>(null);
  const [otro, setOtro] = useState("");
  const [rapido, setRapido] = useState<number | null>(null);
  const [otrosMin, setOtrosMin] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);

  // Los ids se crean una vez por montaje: «Reintentar» no duplica nada.
  const ids = useRef({
    tema: crypto.randomUUID(),
    registro: crypto.randomUUID(),
    nombreDelTema: "",
  });

  const nombreEscrito = otro.trim();
  // Un nombre escrito que coincide (sin importar mayúsculas) con un tema existente usa ese tema.
  const coincide =
    nombreEscrito === ""
      ? undefined
      : temas.find((t) => t.nombre.toLowerCase() === nombreEscrito.toLowerCase());
  const elegido = coincide ?? temas.find((t) => t.id === temaId);
  const hayTema = elegido !== undefined || nombreEscrito !== "";
  const minutos = rapido ?? parseMinutos(otrosMin);
  const valido = hayTema && minutos !== null && nombreEscrito.length <= 60;

  const guardar = async () => {
    if (!valido || minutos === null || guardando) return;
    setGuardando(true);
    setError(false);

    let tema: TemaTiempo;
    if (elegido) {
      tema = elegido;
    } else {
      // Si cambió el nombre tras un intento fallido, el tema es otro: id nuevo.
      if (ids.current.nombreDelTema !== nombreEscrito) {
        ids.current.tema = crypto.randomUUID();
        ids.current.nombreDelTema = nombreEscrito;
      }
      const t = await guardarTema({ id: ids.current.tema, nombre: nombreEscrito });
      if (!t.ok) {
        setError(true);
        setGuardando(false);
        return;
      }
      tema = t.datos;
    }

    const r = await guardarRegistro({
      id: ids.current.registro,
      tema_id: tema.id,
      minutos,
      fecha: todayISO(),
    });
    if (!r.ok) {
      setError(true);
      setGuardando(false);
      return;
    }
    alGuardar(tema, r.datos);
    alCerrar();
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

      <section className="fg !mt-0">
        <h3 className="kicker">Tema</h3>
        <div className="pills mt-2.5">
          {temas.map((t) => (
            <Pildora
              key={t.id}
              presionada={elegido?.id === t.id && nombreEscrito === ""}
              onClick={() => {
                setTemaId(t.id);
                setOtro("");
              }}
            >
              {t.nombre}
            </Pildora>
          ))}
        </div>
        <Input
          className="mt-2.5"
          value={otro}
          onChange={(e) => {
            setOtro(e.target.value);
            setTemaId(null);
          }}
          placeholder="Otro tema"
          aria-label="Otro tema"
          maxLength={60}
          autoComplete="off"
        />
      </section>

      <section className="fg !mt-0">
        <h3 className="kicker">Minutos</h3>
        <div className="pills mt-2.5">
          {RAPIDOS.map((m) => (
            <Pildora
              key={m}
              presionada={rapido === m}
              onClick={() => {
                setRapido(m);
                setOtrosMin("");
              }}
            >
              {m} min
            </Pildora>
          ))}
        </div>
        <Input
          className="mt-2.5"
          value={otrosMin}
          onChange={(e) => {
            setOtrosMin(e.target.value);
            setRapido(null);
          }}
          inputMode="numeric"
          placeholder="Otro, en minutos"
          aria-label="Otro, en minutos"
          autoComplete="off"
        />
      </section>

      {error && (
        <ErrorEnLinea>
          <p>No se pudo guardar el tiempo.</p>
          <p className="err-s">Tus datos no se tocaron.</p>
        </ErrorEnLinea>
      )}
      <Button type="submit" size="lg" disabled={!valido || guardando}>
        {error ? "Reintentar" : "Guardar"}
      </Button>
    </form>
  );
}
