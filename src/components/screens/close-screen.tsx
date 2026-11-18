"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { fechaCorta } from "@/components/progress/estado";
import { CloseSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { ErrorEnLinea, Vacio } from "@/components/ui/estados";
import { Input } from "@/components/ui/input";
import { Pildora } from "@/components/ui/pildora";
import { Textarea } from "@/components/ui/textarea";
import { unidadPorDefecto } from "@/lib/cerrar";
import { formatoPeso, resumirPeso } from "@/lib/cuerpo";
import { db } from "@/lib/db/db";
import {
  closeSession,
  countActiveSlots,
  discardSession,
  getActiveSession,
  listSessionSummaries,
} from "@/lib/db/queries";
import { backupNow } from "@/lib/backup/client";
import { antiguedad, lineaCierre } from "@/lib/hoy";
import { parsePeso } from "@/lib/peso";
import { useNavegando } from "@/lib/use-navegando";

/** Ventana en la que el botón de descarte queda armado. */
const ARMED_MS = 5000;

/** El mismo objeto de estilo que usa Sesión (la hoja empieza bajo la barra `.stop`). */
const ESTILO_HOJA = {
  "--ventana": "70px",
  "--hoja-pb": "0px",
  marginTop: 12,
} as CSSProperties;

function Barra() {
  return (
    <header className="stop two">
      <Link href="/sesion" aria-label="Volver a la sesión" className="stop-back">
        <b aria-hidden="true">‹</b> Volver a la sesión
      </Link>
    </header>
  );
}

function Campo({
  titulo,
  derecha,
  children,
}: {
  titulo: string;
  derecha?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="fg">
      <div className="sec-cab">
        <h2 className="kicker">{titulo}</h2>
        {derecha != null && <span className="kicker kicker-d">{derecha}</span>}
      </div>
      {children}
    </section>
  );
}

export default function CloseScreen() {
  const router = useRouter();
  // La sesión abierta y lo que la línea de cierre necesita (las mismas lecturas y
  // cuentas que Hoy), más los pesos para el marcador y el «Último». Sólo lectura.
  const datos = useLiveQuery(async () => {
    const session = await getActiveSession();
    if (!session) return null;
    const summaries = await listSessionSummaries();
    const resumen = summaries.find((s) => s.session.id === session.id);
    const total = session.routine_day_id ? await countActiveSlots(session.routine_day_id) : 0;
    const dia = resumen?.routineDay?.nombre ?? null;
    const pesos = await db.bodyweightLogs.toArray();
    return {
      session,
      dia,
      total,
      hechos: resumen?.ejerciciosConSeries ?? 0,
      series: resumen?.totalSeries ?? 0,
      pesos,
    };
  }, []);
  const tags = useLiveQuery(() => db.sessionTags.toArray(), []);

  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [weight, setWeight] = useState("");
  const [unidadTocada, setUnidadTocada] = useState<"KG" | "LB" | null>(null);
  const [armed, setArmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  // Al cerrar/descartar navegamos nosotros; la bandera evita que la sesión activa
  // desapareciendo por nuestra propia acción rebote al home (el efecto de abajo) o
  // pinte "sin sesión activa" (el render de abajo). Ver useNavegando.
  const { navegando, marcar, reponer } = useNavegando();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (datos === null && !navegando) router.replace("/");
  }, [datos, navegando, router]);

  if (datos === undefined) {
    return <CloseSkeleton />;
  }
  if (datos === null) {
    // Si desapareció por nuestro propio cierre/descarte, ya vamos en camino al
    // detalle/home: el esqueleto cubre el hueco hasta que aterriza el replace, en
    // vez de parpadear "sin sesión activa" (gemelo del destello de la tarjeta en
    // Hoy).
    if (navegando) return <CloseSkeleton />;
    return (
      <>
        <header className="stop two">
          <Link href="/" aria-label="Volver" className="stop-back">
            <b aria-hidden="true">‹</b> Volver
          </Link>
        </header>
        <div className="hoja" data-propia="" style={ESTILO_HOJA}>
          <main className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
            <Vacio
              titulo="Sin sesión activa."
              texto="No hay nada que cerrar."
              salida={
                <Button asChild variant="secondary">
                  <Link href="/">Ir a Hoy</Link>
                </Button>
              }
            />
          </main>
        </div>
      </>
    );
  }

  const { session } = datos;
  const parsedWeight = parsePeso(weight);
  const ultimoPeso = resumirPeso(datos.pesos);
  // La que el usuario tocó; mientras no toque ninguna, la del último peso anotado.
  const weightUnit = unidadTocada ?? unidadPorDefecto(datos.pesos);
  const unidadElegida = weightUnit === "KG" ? "kg" : "lb";
  const marcador =
    ultimoPeso && ultimoPeso.unidad === unidadElegida ? formatoPeso(ultimoPeso.ultimo) : "—";
  const hace = antiguedad(session.iniciada_en, new Date());

  const close = async () => {
    setSaving(true);
    setError(false);
    marcar();
    let discarded: boolean;
    try {
      ({ discarded } = await closeSession(session.id, {
        nota: note.trim() === "" ? null : note.trim(),
        tagIds: selected,
        // Sin esto, "+25kg" en dominadas no tiene denominador y la progresión en
        // BODYWEIGHT_PLUS es no interpretable (DECISIONES.md §3.4).
        bodyweight: parsedWeight === null ? null : { valor: parsedWeight, unidad: weightUnit },
      }));
    } catch {
      // El cierre rechazó: nada se navegó, así que se repone la bandera y se
      // muestra el error. Los datos no se tocaron; «Reintentar» repite el cierre.
      setSaving(false);
      reponer();
      setError(true);
      return;
    }
    window.localStorage.removeItem(`saya:ejercicio:${session.id}`);
    if (discarded) {
      // No había nada que guardar (ni series ni nota/tags/peso): closeSession la
      // descartó como "Descartar sesión". No hay detalle que mostrar ni registro
      // nuevo que respaldar, así que al home directo, sin backupNow.
      router.replace("/");
      return;
    }
    // Respaldo a Postgres: dispara y olvida, ya con `cerrada_en` escrito. NO se
    // espera (no bloquea el cierre ni la navegación) y no lanza: si falla —sin
    // señal, servidor caído— queda "pendiente" y se reintenta al abrir la app.
    void backupNow();
    // Al cerrar, ir al detalle de ESTA sesión: es donde vive el veredicto y
    // evita dejar al usuario sin salida. `?desde=cierre` le dice al detalle que el
    // "volver" debe ir al home (§3), no al historial: se llegó aquí por cerrar, no
    // por navegar desde /historial.
    router.replace(`/historial/${session.id}?desde=cierre`);
  };

  const discard = async () => {
    marcar();
    await discardSession(session.id);
    window.localStorage.removeItem(`saya:ejercicio:${session.id}`);
    router.replace("/");
  };

  return (
    <>
      <Barra />
      <div className="hoja" data-propia="" style={ESTILO_HOJA}>
        <main className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
          <h1 className="tit-2">Cerrar sesión</h1>
          <p className="dek mt-1.5">
            {lineaCierre({
              dia: datos.dia,
              hace: hace === "recién" ? "recién empezada" : hace,
              hechos: datos.hechos,
              total: datos.total,
              series: datos.series,
            })}
          </p>
          <p className="dek">Todo esto es opcional.</p>

          <Campo titulo="Nota" derecha={note.trim() === "" ? null : "escrita"}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Nota"
              placeholder="Qué pasó hoy que no se ve en los números."
            />
          </Campo>

          <Campo titulo="Contexto" derecha={selected.length === 0 ? null : `${selected.length}`}>
            <div className="pills">
              {(tags ?? []).map((tag) => {
                const on = selected.includes(tag.id);
                return (
                  <Pildora
                    key={tag.id}
                    presionada={on}
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id],
                      )
                    }
                  >
                    {tag.nombre}
                  </Pildora>
                );
              })}
            </div>
          </Campo>

          <Campo titulo="Peso corporal">
            <Input
              variante="cifra"
              unidad={unidadElegida}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
              placeholder={marcador}
              aria-label="Peso corporal"
            />
            <div className="pills mt-3">
              {(["KG", "LB"] as const).map((unit) => (
                <Pildora
                  key={unit}
                  presionada={weightUnit === unit}
                  onClick={() => setUnidadTocada(unit)}
                >
                  {unit.toLowerCase()}
                </Pildora>
              ))}
            </div>
            {ultimoPeso && (
              <p className="fg-hint">
                Último: {formatoPeso(ultimoPeso.ultimo)} {ultimoPeso.unidad} ·{" "}
                {fechaCorta(ultimoPeso.ultimaFecha)}
              </p>
            )}
          </Campo>

          {error && (
            <ErrorEnLinea className="mt-6">
              <p>No se pudo cerrar la sesión.</p>
              <p className="err-s">Tus datos no se tocaron.</p>
            </ErrorEnLinea>
          )}

          <Button
            size="lg"
            className={error ? "mt-3 w-full" : "mt-6 w-full"}
            disabled={saving}
            onClick={() => void close()}
          >
            {error ? "Reintentar" : "Cerrar sesión"}
          </Button>

          {/* Borrado duro permitido (D8), pero los diálogos nativos del navegador
              están prohibidos: la guarda es que el botón hay que tocarlo dos veces
              dentro de una ventana de 5 s. */}
          <div className="mt-2">
            <Button
              variant="link"
              className="danger"
              onClick={() => (armed ? void discard() : setArmed(true))}
            >
              {armed ? "Tocar de nuevo para descartar" : "Descartar sesión"}
            </Button>
          </div>
        </main>
      </div>
    </>
  );
}
