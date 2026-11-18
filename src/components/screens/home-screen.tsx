"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { DayPreviewSheet } from "@/components/day-preview-sheet";
import { fechaCorta } from "@/components/progress/estado";
import { HomeSkeleton } from "@/components/skeletons";
import { Segmentos, TarjetaAnillo } from "@/components/ui/anillo";
import { buttonVariants } from "@/components/ui/button";
import { BloqueError } from "@/components/ui/estados";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { formatoPeso, resumirPeso } from "@/lib/cuerpo";
import { db } from "@/lib/db/db";
import {
  countActiveSlots,
  getActiveMesociclo,
  getActiveSession,
  listRoutineDays,
  listSessionSummaries,
  startSession,
  type SessionSummary,
} from "@/lib/db/queries";
import type { BodyweightLog, Mesociclo, RoutineDay, Session } from "@/lib/db/types";
import {
  diasDesde,
  estadoSesion,
  fechaCabeza,
  formatHace,
  lineaProgreso,
  semanaMesociclo,
  subtituloHoy,
  subtituloPesoHoy,
} from "@/lib/hoy";
import { useNavegando } from "@/lib/use-navegando";
import { cn } from "@/lib/utils";

interface HomeVista {
  active: Session | null;
  mesociclo: Mesociclo | null;
  days: { day: RoutineDay; ejercicios: number }[];
  summaries: SessionSummary[];
  pesos: BodyweightLog[];
}

type Lectura = { ok: true; vista: HomeVista } | { ok: false };

/** Todas las lecturas de Hoy, juntas (sólo lectura de tablas que ya existen). */
async function leerHoy(): Promise<HomeVista> {
  const [active, mesociclo, list, summaries, pesos] = await Promise.all([
    getActiveSession(),
    getActiveMesociclo(),
    listRoutineDays(),
    listSessionSummaries(),
    db.bodyweightLogs.toArray(),
  ]);
  const days = await Promise.all(
    list.map(async (day) => ({
      day,
      // Solo slots activos: el conteo debe coincidir con la plantilla real (§2).
      ejercicios: await countActiveSlots(day.id),
    })),
  );
  return { active: active ?? null, mesociclo: mesociclo ?? null, days, summaries, pesos };
}

export default function HomeScreen() {
  // «Reintentar» vuelve a correr la lectura: cambia la dependencia de la query.
  const [intento, setIntento] = useState(0);
  const lectura = useLiveQuery<Lectura>(async () => {
    try {
      return { ok: true, vista: await leerHoy() };
    } catch {
      return { ok: false };
    }
  }, [intento]);

  if (lectura === undefined) return <HomeSkeleton />;

  if (!lectura.ok) {
    return (
      <>
        <div className="px-4">
          <Cabeza titulo={fechaCabeza(new Date())} ajustes />
        </div>
        <Hoja>
          <main className="mx-auto w-full max-w-md p-4">
            <BloqueError
              titulo="No se pudieron leer tus datos en este teléfono."
              primaria
              alReintentar={() => setIntento((n) => n + 1)}
            />
          </main>
        </Hoja>
      </>
    );
  }

  return <Contenido vista={lectura.vista} />;
}

function Seccion({
  titulo,
  derecha,
  children,
}: {
  titulo: string;
  derecha?: string;
  children: React.ReactNode;
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

function Contenido({ vista }: { vista: HomeVista }) {
  const { active, mesociclo, days, summaries, pesos } = vista;
  const router = useRouter();
  // Navegación en curso hacia /sesion: mientras está en vuelo se suprime la
  // TARJETA de sesión abierta (la sesión nueva ya está activa antes del replace).
  // El patrón —y por qué es estado y no ref— vive en useNavegando.
  const { navegando, marcar, reponer } = useNavegando();

  // Día elegido para la hoja de vista previa (§1). Tocar un día YA NO inicia la
  // sesión: abre esta hoja. Es solo estado de UI; no escribe nada en Dexie.
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Una sola lectura del reloj para toda la pantalla. El contenido solo se
  // renderiza tras resolver el liveQuery (cliente): no hay desajuste de hidratación.
  const ahora = new Date();

  // `hace X d` = días desde la última sesión CERRADA con series reales de ese
  // routine_day_id. Un día nunca entrenado no entra al mapa → «nunca».
  const haceByDay = new Map<string, number>();
  let hayCerradas = false;
  for (const s of summaries) {
    const rd = s.session.routine_day_id;
    if (s.session.activa !== 0 || s.totalSeries <= 0) continue;
    hayCerradas = true;
    if (!rd) continue;
    const dias = diasDesde(s.session.fecha, ahora);
    const prev = haceByDay.get(rd);
    if (prev === undefined || dias < prev) haceByDay.set(rd, dias);
  }

  // Progreso de la sesión abierta, para la tarjeta protagonista.
  const activeSummary = active ? summaries.find((s) => s.session.id === active.id) : undefined;
  const activeDay =
    active?.routine_day_id != null
      ? days.find((d) => d.day.id === active.routine_day_id)
      : undefined;
  const total = activeDay?.ejercicios ?? 0;
  const hechos = activeSummary?.ejerciciosConSeries ?? 0;
  const series = activeSummary?.totalSeries ?? 0;
  const nombreSesion = activeDay?.day.nombre ?? "Sesión libre";

  // La bandera de navegación suprime la tarjeta durante startSession: al tocar un
  // día, la sesión nueva ya está activa ANTES de que llegue el replace, y sin
  // esto la tarjeta asomaría un instante.
  const mostrarSesion = !!active && !navegando;

  const start = async (routineDayId: string) => {
    marcar();
    try {
      await startSession(routineDayId);
      router.replace("/sesion");
    } catch (err) {
      // Solo en el error se repone (ver useNavegando): la navegación no ocurrió y
      // Hoy sigue montado, así que dejar la bandera en alto escondería la tarjeta
      // de una sesión legítima. En el camino feliz NO se repone.
      reponer();
      console.error("[saya] no se pudo empezar la sesión:", err);
    }
  };

  const semana = mesociclo?.iniciado_en ? semanaMesociclo(mesociclo.iniciado_en, ahora) : null;
  const subtitulo = subtituloHoy(mesociclo?.nombre ?? null, semana);
  const peso = resumirPeso(pesos);

  return (
    <>
      <div className="px-4">
        <Cabeza titulo={fechaCabeza(ahora)} subtitulo={subtitulo ?? undefined} ajustes />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          {mostrarSesion && (
            <section className="sec">
              <TarjetaAnillo href="/sesion">
                <p className="text-ink2 flex items-center gap-2 text-[13px] leading-[18px] font-medium">
                  <span className="vivo" aria-hidden="true" />
                  {estadoSesion(active!.iniciada_en, ahora)}
                </p>
                <h2 className="mt-1.5 text-[32px] leading-[1.12] font-semibold tracking-[-.015em] [font-stretch:125%]">
                  {nombreSesion}
                </h2>
                <Segmentos total={total} hechos={hechos} />
                <p className="text-ink2 mt-2.5 text-[13px] leading-[18px] font-normal">
                  {lineaProgreso(hechos, total, series)}
                </p>
                <span className={cn(buttonVariants({ variant: "default" }), "mt-4 w-full")}>
                  Continuar donde ibas →
                </span>
              </TarjetaAnillo>
            </section>
          )}

          {days.length > 0 && (
            <Seccion
              titulo={mostrarSesion ? "Empezar otro día" : "Entrenar"}
              derecha={hayCerradas ? (mesociclo?.nombre ?? undefined) : "Sin sesiones"}
            >
              <div>
                {days.map(({ day, ejercicios }, i) => {
                  const dias = haceByDay.get(day.id);
                  return (
                    <Fila
                      key={day.id}
                      onClick={() => setSelectedDayId(day.id)}
                      indice={String(i + 1).padStart(2, "0")}
                      titulo={day.nombre}
                      subtitulo={`${ejercicios} ${ejercicios === 1 ? "ejercicio" : "ejercicios"}`}
                      valor={
                        dias !== undefined ? formatHace(dias) : <span className="text-ink3">nunca</span>
                      }
                    />
                  );
                })}
              </div>
            </Seccion>
          )}

          {/* Sólo las áreas que existen. Aprender, Disponible y Próximo pago piden
              Tiempo y Dinero (slices 6 y 7): no se pintan. Sin pesos, la sección
              entera no se pinta (O1). */}
          {peso && (
            <Seccion titulo="Tus áreas" derecha="Lo último que anotaste">
              <Fila
                href="/cuerpo"
                titulo="Peso corporal"
                subtitulo={subtituloPesoHoy(peso, fechaCorta)}
                valor={`${formatoPeso(peso.ultimo)} ${peso.unidad}`}
              />
            </Seccion>
          )}
        </main>
      </Hoja>

      {/* Hoja de vista previa (§1): tocar un día la abre; "Empezar" es el único
          punto que escribe (reusa start → startSession). Con sesión abierta de otro
          día, advierte antes de que el usuario toque "Empezar". */}
      {selectedDayId && (
        <DayPreviewSheet
          dayId={selectedDayId}
          sesionAbiertaNombre={active ? nombreSesion : null}
          sesionAbiertaDiaId={active?.routine_day_id ?? null}
          onEmpezar={() => void start(selectedDayId)}
          onClose={() => setSelectedDayId(null)}
        />
      )}
    </>
  );
}
