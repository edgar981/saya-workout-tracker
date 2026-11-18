"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { SetLines } from "@/components/history/set-lines";
import { VeredictoLinea } from "@/components/history/verdict-badge";
import { fechaCorta } from "@/components/progress/estado";
import { SessionDetailSkeleton } from "@/components/skeletons";
import { TarjetaAnillo, Segmentos } from "@/components/ui/anillo";
import { Button, buttonVariants } from "@/components/ui/button";
import { BloqueError, Vacio } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { Pildora } from "@/components/ui/pildora";
import { formatoPeso, textoSeries } from "@/lib/cuerpo";
import { db } from "@/lib/db/db";
import {
  discardSession,
  loadSessionDetail,
  updateSessionTags,
  type SessionDetail,
  type SessionExerciseView,
} from "@/lib/db/queries";
import type { SessionTag } from "@/lib/db/types";
import { loadSessionVerdicts, type InstanceVerdict } from "@/lib/db/verdicts";
import { antiguedad } from "@/lib/hoy";
import {
  conteoSesion,
  conteoVeredictos,
  duracion,
  fechaComun,
  fechaLarga,
} from "@/lib/leer";
import { TAG_DELOAD } from "@/lib/progress";
import { gapsBySetId, sessionDurationMs } from "@/lib/rest-gap";
import { useNavegando } from "@/lib/use-navegando";
import { cn } from "@/lib/utils";

/** Ventana en la que el borrado queda armado tras el primer toque. */
const ARMED_MS = 5000;

type Estado = "realizado" | "iniciado_sin_registro" | "no_realizado";

function estadoDe(item: SessionExerciseView): Estado {
  if (item.sets.length > 0) return "realizado";
  return item.sessionExercise.orden_ejecucion !== null ? "iniciado_sin_registro" : "no_realizado";
}

type Lectura =
  | {
      ok: true;
      detail: SessionDetail | null;
      verdicts: Record<string, InstanceVerdict>;
      todos: SessionTag[];
    }
  | { ok: false };

export default function SessionDetailScreen() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  // «Reintentar» vuelve a correr la lectura: cambia la dependencia de la query.
  const [intento, setIntento] = useState(0);
  // El detalle, los veredictos (`{}` para la sesión abierta: sólo cerradas) y los
  // tags para las píldoras, en una sola lectura.
  const lectura = useLiveQuery<Lectura>(async () => {
    try {
      const detail = await loadSessionDetail(sessionId);
      const verdicts = detail ? await loadSessionVerdicts(sessionId) : {};
      const todos = await db.sessionTags.toArray();
      return { ok: true, detail, verdicts, todos };
    } catch {
      return { ok: false };
    }
  }, [sessionId, intento]);

  // Eliminar la sesión borra el detalle y navega: sin esto, loadSessionDetail
  // devolvería null y pintaría «esta sesión no existe» antes de que aterrice el
  // replace a /historial. Ver useNavegando.
  const { navegando, marcar } = useNavegando();

  if (lectura === undefined) return <SessionDetailSkeleton />;

  if (!lectura.ok) {
    return (
      <Pantalla titulo="Sesión">
        <BloqueError
          titulo="No se pudo leer esta sesión."
          alReintentar={() => setIntento((n) => n + 1)}
        />
      </Pantalla>
    );
  }

  if (lectura.detail === null) {
    // Si el null es por NUESTRO propio eliminar, ya vamos en camino a /historial:
    // el esqueleto cubre el hueco hasta el replace, en vez de parpadear «esta
    // sesión no existe». Un null legítimo (URL de una sesión que no existe) sí
    // muestra el mensaje.
    if (navegando) return <SessionDetailSkeleton />;
    return (
      <Pantalla titulo="Sesión">
        <Vacio
          titulo="Esta sesión no existe."
          texto="Puede que la hayas descartado."
          salida={
            <Button asChild variant="secondary">
              <Link href="/historial">Ir al historial</Link>
            </Button>
          }
        />
      </Pantalla>
    );
  }

  return (
    <Detalle
      detail={lectura.detail}
      verdicts={lectura.verdicts}
      todos={lectura.todos}
      sessionId={sessionId}
      marcar={marcar}
    />
  );
}

/** La cabeza y la hoja de las pantallas de este grupo, sin la cabeza de datos. */
function Pantalla({
  titulo,
  subtitulo,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo={titulo} subtitulo={subtitulo} empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">{children}</main>
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

function Detalle({
  detail,
  verdicts,
  todos,
  sessionId,
  marcar,
}: {
  detail: SessionDetail;
  verdicts: Record<string, InstanceVerdict>;
  todos: SessionTag[];
  sessionId: string;
  /** La bandera de navegación vive en la pantalla: el null del detalle la lee ahí. */
  marcar: () => void;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const { session, routineDay, bodyweight, items } = detail;
  const abierta = session.activa === 1;
  const nombre = routineDay?.nombre ?? "Sesión libre";

  // Tiempo entre registros (§4), derivado en lectura de creado_en. Los items ya
  // vienen sin series en cero (loadSessionDetail filtra), así que los huecos y la
  // duración son entre series reales. Nada de esto se almacena.
  const allSets = items.flatMap((i) => i.sets);
  const gapMs = gapsBySetId(allSets);
  const dur = duracion(sessionDurationMs(allSets));

  const subtitulo = abierta
    ? `${fechaLarga(session.fecha)} · ${antiguedad(session.iniciada_en, new Date())}`
    : dur !== null
      ? `${fechaLarga(session.fecha)} · ${dur}`
      : fechaLarga(session.fecha);

  const eliminar = async () => {
    marcar();
    await discardSession(sessionId);
    router.replace("/historial");
  };

  return (
    <Pantalla titulo={nombre} subtitulo={subtitulo}>
      {abierta ? (
        <Abierta nombre={nombre} items={items} session={session} gapMs={gapMs} />
      ) : (
        <Cerrada
          detail={detail}
          verdicts={verdicts}
          todos={todos}
          gapMs={gapMs}
          bodyweight={bodyweight}
          armed={armed}
          alEliminar={() => (armed ? void eliminar() : setArmed(true))}
        />
      )}
    </Pantalla>
  );
}

function cuentaEjercicios(n: number): string {
  return `${n} ${n === 1 ? "ejercicio" : "ejercicios"}`;
}

function Abierta({
  nombre,
  items,
  session,
  gapMs,
}: {
  nombre: string;
  items: SessionExerciseView[];
  session: SessionDetail["session"];
  gapMs: Map<string, number>;
}) {
  const { hechos, total, series } = conteoSesion(items);
  return (
    <>
      <section className="sec">
        <TarjetaAnillo chica href="/sesion">
          <p className="text-ink2 flex items-center gap-2 text-[13px] leading-[18px] font-medium">
            <span className="vivo" aria-hidden="true" />
            Sesión abierta · {antiguedad(session.iniciada_en, new Date())}
          </p>
          <h2 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-.01em] [font-stretch:125%]">
            {nombre}
          </h2>
          <Segmentos total={total} hechos={hechos} />
          <p className="text-ink2 mt-2.5 text-[13px] leading-[18px] font-normal">
            {hechos} / {total} hechos · {textoSeries(series)}
          </p>
          <span className={cn(buttonVariants({ variant: "default" }), "mt-3.5 w-full")}>
            Continuar donde ibas →
          </span>
        </TarjetaAnillo>
      </section>

      <Seccion titulo="Ejercicios" derecha={cuentaEjercicios(items.length)}>
        {items.map((item) => (
          <TarjetaEjercicio key={item.sessionExercise.id} item={item} gapMs={gapMs} />
        ))}
      </Seccion>

      <p className="dek" style={{ marginTop: 20 }}>
        La nota, el contexto y el peso se anotan al cerrar.
      </p>
    </>
  );
}

function Cerrada({
  detail,
  verdicts,
  todos,
  gapMs,
  bodyweight,
  armed,
  alEliminar,
}: {
  detail: SessionDetail;
  verdicts: Record<string, InstanceVerdict>;
  todos: SessionTag[];
  gapMs: Map<string, number>;
  bodyweight: SessionDetail["bodyweight"];
  armed: boolean;
  alEliminar: () => void;
}) {
  const { session, items } = detail;
  const conteo = conteoVeredictos(verdicts);
  const hayVeredictos = Object.keys(verdicts).length > 0;
  const comun = fechaComun(verdicts);
  const deload = session.tag_ids.includes(TAG_DELOAD);
  const nota = session.nota && session.nota.trim() !== "" ? session.nota : null;

  const tocar = (id: string) =>
    void updateSessionTags(
      session.id,
      session.tag_ids.includes(id)
        ? session.tag_ids.filter((t) => t !== id)
        : [...session.tag_ids, id],
    );

  return (
    <>
      {hayVeredictos && (
        <Seccion
          titulo={`Contra la anterior${comun ? ` · ${fechaCorta(comun)}` : ""}`}
          derecha={deload ? "semana de descarga" : undefined}
        >
          <p className="l-tally">
            <span>
              <b>{conteo.mejor}</b> mejor
            </span>
            <span>
              <b>{conteo.igual}</b> igual
            </span>
            <span>
              <b>{conteo.peor}</b> peor
            </span>
            <span>
              <b>{conteo.sin_comparacion}</b> sin comparación
            </span>
          </p>
        </Seccion>
      )}

      <Seccion titulo="Ejercicios" derecha={cuentaEjercicios(items.length)}>
        {items.map((item) => (
          <TarjetaEjercicio
            key={item.sessionExercise.id}
            item={item}
            veredicto={verdicts[item.sessionExercise.id]}
            verFecha={comun === null}
            gapMs={gapMs}
          />
        ))}
      </Seccion>

      <Seccion titulo="Nota">
        {nota ? <p className="dek l-tinta">{nota}</p> : <p className="l-vacio">Sin nota.</p>}
      </Seccion>

      <Seccion titulo="Contexto" derecha="toca para cambiar">
        <div className="l-pildoras">
          {todos.map((tag) => (
            <Pildora
              key={tag.id}
              presionada={session.tag_ids.includes(tag.id)}
              onClick={() => tocar(tag.id)}
            >
              {tag.nombre}
            </Pildora>
          ))}
        </div>
        <p className="l-s3">
          Cada toque se guarda. Con deload, Progreso saca esta sesión de la línea de cada ejercicio
          y del promedio de volumen.
        </p>
      </Seccion>

      <Seccion titulo="Peso corporal">
        <Fila
          titulo="Peso corporal"
          valor={
            bodyweight ? (
              `${formatoPeso(bodyweight.valor)} ${bodyweight.unidad.toLowerCase()}`
            ) : (
              <span className="text-ink2">Sin anotar</span>
            )
          }
        />
      </Seccion>

      {/* Acción destructiva, discreta y al final: poco frecuente. */}
      <div className="l-acts">
        <button type="button" className="tl danger" onClick={alEliminar}>
          {armed ? "Tocar de nuevo para eliminar" : "Eliminar sesión"}
        </button>
      </div>
    </>
  );
}

function TarjetaEjercicio({
  item,
  veredicto,
  verFecha = false,
  gapMs,
}: {
  item: SessionExerciseView;
  veredicto?: InstanceVerdict;
  verFecha?: boolean;
  gapMs: Map<string, number>;
}) {
  const estado = estadoDe(item);
  const slot = item.slot;
  const orden = item.sessionExercise.orden_ejecucion;
  const hayChips =
    orden !== null ||
    (item.isSubstitution && item.slotExercise) ||
    item.isAdHoc ||
    (slot && slot.target_sets !== null && slot.target_reps !== null);

  return (
    <div className="l-ej">
      <div className="l-ej-cab">
        <Link href={`/ejercicio/${item.exercise.id}`} className="tl">
          {item.exercise.nombre}
        </Link>
        {veredicto && <VeredictoLinea item={veredicto} verFecha={verFecha} />}
        {!veredicto && estado === "iniciado_sin_registro" && (
          <span className="l-s l-dn">Se empezó, sin series registradas.</span>
        )}
        {!veredicto && estado === "no_realizado" && <span className="l-s l-dn">No realizado.</span>}
      </div>

      {hayChips && (
        <div className="l-chips">
          {orden !== null && <span>{orden}º</span>}
          {item.isSubstitution && item.slotExercise && (
            <span>sustituye a {item.slotExercise.nombre}</span>
          )}
          {item.isAdHoc && <span>fuera de plantilla</span>}
          {slot && slot.target_sets !== null && slot.target_reps !== null && (
            <span>
              objetivo {slot.target_sets} × {slot.target_reps}
            </span>
          )}
        </div>
      )}

      {estado === "realizado" && (
        <SetLines sets={item.sets} stackLabel={item.exercise.stack_label} gaps={gapMs} />
      )}

      {item.sessionExercise.nota && <p className="l-s mt-2">{item.sessionExercise.nota}</p>}
    </div>
  );
}
