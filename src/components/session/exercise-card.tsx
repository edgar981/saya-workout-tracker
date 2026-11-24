"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import {
  estaAnotado,
  etiquetaUnidad,
  faltaPeso,
  gruposDeHoy,
  siguienteSerie,
  textoSerie,
  valoresIniciales,
} from "@/components/session/dial";
import { LastPerformance } from "@/components/session/last-performance";
import { SerieDial } from "@/components/session/serie-dial";
import { ErrorEnLinea } from "@/components/ui/estados";
import {
  addOppositeSide,
  addSet,
  getLastPerformance,
  loadSessionView,
  updateSet,
  type SessionExerciseView,
} from "@/lib/db/queries";

const ARMED_MS = 4000;

/** La clave con que la pantalla esconde un grupo borrado mientras espera el «Deshacer». */
export function claveSerie(sessionExerciseId: string, setIndex: number): string {
  return `${sessionExerciseId}:${setIndex}`;
}

function sinMovimiento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Advertencia() {
  return (
    <svg className="warn" viewBox="0 0 24 24" width="22" height="22" role="img" aria-label="Falta el peso">
      <path d="M12 2.5 22.5 20.5h-21z" fill="var(--amber)" />
      <path d="M11 8.5h2v6.5h-2zM11 16.5h2v2h-2z" fill="#1A1200" />
    </svg>
  );
}

interface Fallo {
  /** Número de serie que se intentó escribir (1-based). */
  n: number;
  reps: number;
  peso: number | null;
  editando: number | null;
}

export function ExerciseCard({
  item,
  sessionId,
  posicion,
  total,
  activa,
  ocultas,
  onNota,
  onBorrarSerie,
  onQuitar,
}: {
  item: SessionExerciseView;
  sessionId: string;
  /** Posición (1-based) del ejercicio entre los que se ven, para el kicker. */
  posicion: number;
  total: number;
  /** Es la tarjeta que está a la vista. */
  activa: boolean;
  /** Claves (`claveSerie`) de las series borradas que esperan el «Deshacer». */
  ocultas: ReadonlySet<string>;
  onNota: () => void;
  onBorrarSerie: (sessionExerciseId: string, setIndex: number, n: number) => void;
  onQuitar: (sessionExerciseId: string) => void;
}) {
  const { exercise, slot, sessionExercise } = item;
  const [armed, setArmed] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [manual, setManual] = useState<{ clave: string; reps?: number; peso?: number | null } | null>(
    null,
  );
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const [recien, setRecien] = useState<number | null>(null);
  const porDesplazar = useRef<number | null>(null);
  const chips = useRef(new Map<number, HTMLButtonElement>());

  // Se desarma a los 4000 ms; cambiar de ejercicio (`activa` pasa a false) lo
  // desarma al momento.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), activa ? ARMED_MS : 0);
    return () => clearTimeout(t);
  }, [armed, activa]);
  const armado = armed && activa;

  // Última aparición del ejercicio: la MISMA fuente que ya alimentaba la precarga
  // (getLastPerformance → getPerformanceHistory, la única travesía). Se carga una
  // vez aquí y se reusa para «La pasada» y para los valores iniciales de los
  // diales.
  const anterior = useLiveQuery(
    () => getLastPerformance(exercise.id, sessionId),
    [exercise.id, sessionId],
  );
  const pasada = useMemo(() => anterior?.sets ?? [], [anterior]);

  const visibles = useMemo(
    () => item.sets.filter((s) => !ocultas.has(claveSerie(sessionExercise.id, s.set_index))),
    [item.sets, ocultas, sessionExercise.id],
  );
  const grupos = gruposDeHoy(visibles);
  const anotados = grupos
    .map((g, j) => ({ g, j }))
    .filter(({ g }) => estaAnotado(g));
  const sinPeso = exercise.unit_type === "BODYWEIGHT";

  const editIdx = editando !== null && grupos[editando] ? editando : null;
  const inicial = valoresIniciales({ exercise, slot, pasada, hoy: visibles, editando: editIdx });
  const clave = [
    exercise.id,
    editIdx,
    grupos.length,
    grupos.map((g) => g.map((f) => `${f.reps}/${f.weight_value}`).join("+")).join("|"),
    inicial.reps,
    inicial.peso,
  ].join(";");
  // Lo que el dedo movió vale sólo mientras nada de abajo cambie; si cambia (se
  // anotó una serie, se abrió otra para editar), vuelven los valores iniciales.
  const vigente = manual && manual.clave === clave ? manual : null;
  const reps = vigente?.reps ?? inicial.reps;
  const peso = sinPeso ? null : vigente && vigente.peso !== undefined ? vigente.peso : inicial.peso;

  const numero = (editIdx ?? siguienteSerie(grupos)) + 1;

  // Tras anotar, la página baja lo justo para que la ficha nueva quede 12 px por
  // encima de la tira de abajo.
  useEffect(() => {
    const setIndex = porDesplazar.current;
    if (setIndex === null) return;
    const chip = chips.current.get(setIndex);
    const sbot = document.querySelector(".sbot");
    if (!chip) return;
    porDesplazar.current = null;
    if (!sbot) return;
    const exceso = chip.getBoundingClientRect().bottom - (sbot.getBoundingClientRect().top - 12);
    if (exceso > 0) {
      window.scrollBy({ top: exceso, behavior: sinMovimiento() ? "auto" : "smooth" });
    }
  });

  const escribir = async (v: { reps: number; peso: number | null; editando: number | null }) => {
    const pesoFila = sinPeso ? null : v.peso;
    const j = v.editando ?? siguienteSerie(grupos);
    const existente = grupos[j];
    try {
      if (existente) {
        // Reusa el grupo: todas las filas del segmento 0 (los dos lados, si hay).
        for (const fila of existente.filter((f) => f.segment_index === 0)) {
          await updateSet(fila.id, { reps: v.reps, weight_value: pesoFila });
        }
        porDesplazar.current = existente[0].set_index;
        setRecien(existente[0].set_index);
      } else {
        await addSet(sessionExercise.id, { esExtra: false, side: "AUTO" });
        const filasNuevas = async () => {
          const vista = await loadSessionView(sessionId);
          const it = vista?.items.find((i) => i.sessionExercise.id === sessionExercise.id);
          const todas = it?.sets ?? [];
          const max = todas.length ? Math.max(...todas.map((s) => s.set_index)) : 0;
          return { max, filas: todas.filter((s) => s.set_index === max) };
        };
        const primera = await filasNuevas();
        let filas = primera.filas;
        if (exercise.laterality_default === "UNILATERAL") {
          await addOppositeSide(sessionExercise.id, primera.max);
          filas = (await filasNuevas()).filas;
        }
        for (const fila of filas.filter((f) => f.segment_index === 0)) {
          await updateSet(fila.id, { reps: v.reps, weight_value: pesoFila });
        }
        porDesplazar.current = primera.max;
        setRecien(primera.max);
      }
      setFallo(null);
      setEditando(null);
      setManual(null);
    } catch {
      setFallo({ n: j + 1, reps: v.reps, peso: v.peso, editando: v.editando });
    }
  };

  const confirmar = () => void escribir({ reps, peso, editando: editIdx });

  const nSeries = anotados.length;
  const textoQuitar = armado
    ? nSeries === 0
      ? "Sí, quitar"
      : `Sí, quitar · ${nSeries} ${nSeries === 1 ? "serie" : "series"}`
    : "Quitar de la sesión";

  const hayBadges =
    (item.isSubstitution && !!item.slotExercise) ||
    item.isAdHoc ||
    sessionExercise.orden_ejecucion !== null ||
    (!!slot && slot.target_sets !== null && slot.target_reps !== null);
  const hayPasada = anterior !== null;

  return (
    <section className="card" aria-label={`Ejercicio ${posicion} de ${total}`}>
      <p className="kick exk">
        Ejercicio {posicion} de {total} · {etiquetaUnidad(exercise)}
      </p>
      <h2 className="h2">{exercise.nombre}</h2>

      <SerieDial
        exercise={exercise}
        reps={reps}
        peso={peso}
        onReps={(n) => setManual({ clave, reps: n, peso: vigente?.peso })}
        onPeso={(n) => setManual({ clave, reps: vigente?.reps, peso: n })}
      />

      {editIdx === null ? (
        <button type="button" className="btn big w" style={{ marginTop: 14 }} onClick={confirmar}>
          Anotar serie {numero}
        </button>
      ) : (
        <div className="ed3">
          <button
            type="button"
            className="arw"
            aria-label={`Borrar serie ${numero}`}
            onClick={() => {
              setEditando(null);
              onBorrarSerie(sessionExercise.id, grupos[editIdx][0].set_index, numero);
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
          <button type="button" className="btn2" onClick={() => setEditando(null)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn big"
            aria-label={`Guardar serie ${numero}`}
            onClick={confirmar}
          >
            Guardar
          </button>
        </div>
      )}

      <p className="kick hk">
        Hoy
        <span className="r">
          {nSeries === 0 ? "—" : `${nSeries} ${nSeries === 1 ? "serie" : "series"}`}
        </span>
      </p>
      {nSeries > 0 && (
        <div className="lchips">
          {anotados.map(({ g, j }) => {
            const falta = faltaPeso(exercise, g);
            const setIndex = g[0].set_index;
            const clases = ["lchip", falta && "miss", editIdx === j && "ed", recien === setIndex && "popin"]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={setIndex}
                ref={(el) => {
                  if (el) chips.current.set(setIndex, el);
                  else chips.current.delete(setIndex);
                }}
                type="button"
                className={clases}
                aria-label={`Editar serie ${j + 1}${falta ? " · Falta el peso" : ""}`}
                aria-pressed={editIdx === j}
                onClick={() => setEditando(editIdx === j ? null : j)}
              >
                <span className="ix">{g.some((f) => f.es_extra) ? "E" : j + 1}</span>
                {textoSerie(exercise, g)}
                {falta && <Advertencia />}
              </button>
            );
          })}
        </div>
      )}

      {fallo && (
        <ErrorEnLinea>
          <p>No se pudo guardar la serie {fallo.n}.</p>
          <span className="es">Tus datos no se tocaron.</span>
          <button
            type="button"
            className="tl"
            onClick={() => void escribir({ reps: fallo.reps, peso: fallo.peso, editando: fallo.editando })}
          >
            Reintentar
          </button>
        </ErrorEnLinea>
      )}

      {(hayBadges || hayPasada) && (
        <div className="hist">
          {hayBadges && (
            <div className="badges">
              {item.isSubstitution && item.slotExercise && (
                <span>sustituye a {item.slotExercise.nombre}</span>
              )}
              {item.isAdHoc && <span>fuera de plantilla</span>}
              {/* Derivado, nunca editable. Se muestra para que la secuencia real sea
                  legible sin reacomodar la lista. */}
              {sessionExercise.orden_ejecucion !== null && (
                <span>ejecutado {sessionExercise.orden_ejecucion}º</span>
              )}
              {slot && slot.target_sets !== null && slot.target_reps !== null && (
                <span>
                  objetivo {slot.target_sets} × {slot.target_reps}
                </span>
              )}
            </div>
          )}
          <LastPerformance exerciseId={exercise.id} stackLabel={exercise.stack_label} last={anterior} />
        </div>
      )}

      {sessionExercise.nota && <p className="note-t">{sessionExercise.nota}</p>}

      <div className="lxa">
        <button type="button" className="tl" onClick={onNota}>
          Nota del ejercicio <span aria-hidden="true">▾</span>
        </button>
        {/* Quitar borra la instancia y sus series en una sola transacción (la
            pantalla lo hace con deleteSessionExercise tras el «Deshacer»). Guarda
            de doble toque. */}
        <button
          type="button"
          className="tl danger"
          onClick={() => (armado ? onQuitar(sessionExercise.id) : setArmed(true))}
        >
          {textoQuitar}
        </button>
      </div>
    </section>
  );
}
