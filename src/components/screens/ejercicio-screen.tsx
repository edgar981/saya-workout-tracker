"use client";

import { Fragment, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ScissorsLineDashed } from "lucide-react";

import { unitTag } from "@/components/exercise-picker";
import { EstadoLinea, fechaCorta } from "@/components/progress/estado";
import { MarcaChart, resumenSeries } from "@/components/progress/marca-chart";
import { EjercicioSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Vacio } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { loadExerciseHistory, todayISO, type ExerciseHistory } from "@/lib/db/queries";
import { descargasEnLinea, fechaFila, partirUnidad } from "@/lib/leer";
import { aparicionesDe, evaluarProgreso, MIN_COMPARABLES, TAG_DELOAD } from "@/lib/progress";
import { formatSetWeight, unitSuffix } from "@/lib/units";

/** Etiqueta de unidad del snapshot vigente (no del catálogo): la línea de
 *  metadatos describe lo que se registró, no lo que dice el catálogo hoy. */
function unidadSnapshot(snap: NonNullable<ExerciseHistory["recentSnapshot"]>, stackLabel: string | null): string {
  if (snap.unit_type === "BODYWEIGHT") return "peso corporal";
  if (snap.unit_type === "BODYWEIGHT_PLUS")
    return `+${unitSuffix(snap.unit_type, snap.weight_basis, snap.added_unit)}`;
  return unitSuffix(snap.unit_type, snap.weight_basis, snap.added_unit, stackLabel);
}

/** Las filas de «Sesiones» que muestra la lista (las últimas 5, las de `entries`). */
const ULTIMAS = 5;

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

export default function EjercicioScreen() {
  const params = useParams<{ exerciseId: string }>();
  const exerciseId = params.exerciseId;

  // Capa 2 (§11) sale de la MISMA travesía: `todas` ya viene en el historial.
  const history = useLiveQuery(async () => {
    const h = await loadExerciseHistory(exerciseId);
    const apariciones = aparicionesDe(h.todas, h.pesos);
    return {
      ...h,
      progreso: evaluarProgreso(apariciones, todayISO()),
      descargas: descargasEnLinea(apariciones),
    };
  }, [exerciseId]);

  if (history === undefined) {
    return <EjercicioSkeleton />;
  }

  const {
    exercise,
    entries,
    recentSnapshot,
    esUnilateral,
    totalSeries,
    bestSet,
    progreso,
    descargas,
    todas,
    pesos,
  } = history;
  const stackLabel = exercise?.stack_label ?? null;
  const fuera = [
    progreso.otraCarga > 0 &&
      `${progreso.otraCarga} ${progreso.otraCarga === 1 ? "sesión no comparable" : "sesiones no comparables"} (otra carga, unidad o lateralidad)`,
    progreso.deload > 0 && `${progreso.deload} de descarga`,
  ].filter(Boolean);

  // BODYWEIGHT_PLUS con peso corporal (§11.2): se dice qué mide la línea, y si
  // hay puntos anteriores al primer registro, qué peso se les puso.
  const primerPeso = pesos
    .filter((p) => p.unidad === recentSnapshot?.added_unit)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const notaCuerpo =
    progreso.conPesoCorporal && primerPeso
      ? progreso.puntos.some((p) => p.fecha < primerPeso.fecha)
        ? ` Carga: tu peso corporal + el añadido; antes de tu primer registro (${fechaCorta(primerPeso.fecha)}) se usa ese peso, ${primerPeso.valor} ${primerPeso.unidad.toLowerCase()}.`
        : " Carga: tu peso corporal + el añadido."
      : "";

  // Línea de metadatos (§4): unidad del snapshot vigente · lateralidad · total de
  // series. Sin apariciones, cae a la unidad del catálogo.
  const metaLine = recentSnapshot
    ? [
        unidadSnapshot(recentSnapshot, stackLabel),
        esUnilateral ? "unilateral" : "bilateral",
        `${totalSeries} ${totalSeries === 1 ? "serie" : "series"}`,
      ].join(" · ")
    : exercise
      ? unitTag(exercise)
      : "";

  const pocosDatos = progreso.estado === "pocos_datos";
  const hayLinea = progreso.mejor !== null && progreso.puntos.length >= 2;
  const leyenda = [
    "Cada punto: el promedio de tus dos mejores series de esa sesión. El anillo marca tu mejor sesión.",
    notaCuerpo.trim(),
    fuera.length > 0 ? `Fuera de la línea: ${fuera.join(" y ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const reciente = entries[0];
  const mejor = bestSet
    ? partirUnidad(
        bestSet.isBodyweight
          ? `${bestSet.set.reps} reps`
          : `${bestSet.set.reps} × ${formatSetWeight(bestSet.set, stackLabel)}`,
      )
    : null;

  return (
    <>
      <div className="px-4">
        <Cabeza titulo={exercise?.nombre ?? "Ejercicio"} subtitulo={metaLine || undefined} empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          {entries.length === 0 ? (
            <Vacio titulo="Todavía no hay series de este ejercicio." />
          ) : (
            <>
              {reciente?.isSubstitution && reciente.slotExerciseNombre && (
                <div className="l-chips" style={{ marginTop: 22 }}>
                  <span>sustituye a {reciente.slotExerciseNombre}</span>
                </div>
              )}

              {bestSet && mejor && (
                <Seccion titulo="Mejor serie" derecha={fechaCorta(bestSet.fecha)}>
                  <p className="cifra">
                    {mejor.cifra}
                    {mejor.unidad && (
                      <>
                        {" "}
                        <span className="cifra-u">{mejor.unidad}</span>
                      </>
                    )}
                  </p>
                  {bestSet.set.side && <p className="dek">lado {bestSet.set.side}</p>}
                </Seccion>
              )}

              {/* Progreso (§11.7): estado y línea de marcas de las comparables. La
                  marca no se muestra como número; al tocar un punto se leen sus series. */}
              {progreso.estado !== "sin_registros" && (
                <Seccion
                  titulo="Progreso"
                  derecha={pocosDatos ? `${progreso.puntos.length} de ${MIN_COMPARABLES}` : undefined}
                >
                  <EstadoLinea progreso={progreso} />
                  {pocosDatos ? (
                    <p className="l-vacio">
                      La línea aparece con {MIN_COMPARABLES} sesiones comparables. Llevas{" "}
                      {progreso.puntos.length}.
                    </p>
                  ) : (
                    hayLinea &&
                    progreso.mejor && (
                      <MarcaChart
                        puntos={progreso.puntos}
                        mejor={progreso.mejor}
                        stackLabel={stackLabel}
                        descargas={descargas}
                      />
                    )
                  )}
                  {leyenda && <p className="l-s3">{leyenda}</p>}
                </Seccion>
              )}

              <Seccion
                titulo="Sesiones"
                derecha={
                  todas.length > ULTIMAS
                    ? `últimas ${ULTIMAS}`
                    : `${entries.length} ${entries.length === 1 ? "sesión" : "sesiones"}`
                }
              >
                {entries.map((entry, i) => {
                  // §3.5: si el snapshot de unidad cambia entre sesiones, se corta la
                  // serie en vez de fingir continuidad. Se compara contra la entrada
                  // anterior (más reciente) de la lista.
                  const cambioUnidad = i > 0 && entries[i - 1].unitKey !== entry.unitKey;
                  const descarga = entry.session.tag_ids.includes(TAG_DELOAD);

                  return (
                    <Fragment key={entry.sessionExercise.id}>
                      {cambioUnidad && (
                        <p className="l-s3 flex items-center gap-2">
                          <ScissorsLineDashed className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            La unidad cambió aquí. Arriba y abajo de esta línea no son comparables.
                          </span>
                        </p>
                      )}
                      <Fila
                        href={`/historial/${entry.session.id}`}
                        titulo={
                          <>
                            {fechaFila(entry.session.fecha, fechaCorta)}
                            {entry.session.activa === 1 && (
                              <Badge className="text-ink ml-2 align-middle">
                                <span className="vivo" aria-hidden="true" />
                                en curso
                              </Badge>
                            )}
                            {descarga && <Badge className="ml-2 align-middle">descarga</Badge>}
                            {entry.isSubstitution && entry.slotExerciseNombre && (
                              <Badge className="ml-2 align-middle">
                                sustituye a {entry.slotExerciseNombre}
                              </Badge>
                            )}
                          </>
                        }
                        subtitulo={resumenSeries(entry.sets, stackLabel)}
                      />
                    </Fragment>
                  );
                })}
              </Seccion>
            </>
          )}
        </main>
      </Hoja>
    </>
  );
}
