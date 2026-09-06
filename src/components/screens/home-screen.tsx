"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, ChevronRight, Database, Flag, History, ListChecks } from "lucide-react";

import { db } from "@/lib/db/db";
import {
  countActiveSlots,
  getActiveSession,
  listSessionSummaries,
  startSession,
} from "@/lib/db/queries";
import { cn } from "@/lib/utils";

/** Semana ISO — la que decide "SEMANA 36" en la orientación de la cabecera. */
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = (date.getUTCDay() + 6) % 7; // lunes = 0
  date.setUTCDate(date.getUTCDate() - dow + 3); // jueves de esta semana
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDow = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDow + 3);
  return 1 + Math.round((date.getTime() - firstThu.getTime()) / (7 * 86_400_000));
}

/** `JUE 5 SEP · SEMANA 36`: la línea de orientación, no el wordmark, encabeza. */
function cabecera(ahora: Date): string {
  const dia = ahora.toLocaleDateString("es", { weekday: "short" }).replace(".", "").toUpperCase();
  const mes = ahora
    .toLocaleDateString("es", { month: "short" })
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
  return `${dia} ${ahora.getDate()} ${mes} · SEMANA ${isoWeek(ahora)}`;
}

/**
 * Antigüedad relativa corta de la sesión abierta (§2). Es lo que decide si vas a
 * retomarla ("hace 41 min") o si quedó abierta de un entrenamiento ya terminado
 * ("hace 3 días"). Dentro del día, minutos/horas; luego, días de calendario para
 * que "ayer" sea ayer y no depender de la hora exacta.
 */
function antiguedad(iso: string, ahora: Date): string {
  const inicio = new Date(iso);
  const min = Math.floor((ahora.getTime() - inicio.getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;

  const diaInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const diaAhora = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.round((diaAhora.getTime() - diaInicio.getTime()) / 86_400_000);
  if (dias === 0) return `hace ${Math.floor(min / 60)} h`;
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/** Días de calendario desde una fecha `YYYY-MM-DD` de sesión hasta hoy (§2). */
function diasDesde(fechaISO: string, ahora: Date): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  return Math.round((hoy - then) / 86_400_000);
}

function formatHace(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} d`;
}

export default function HomeScreen() {
  const router = useRouter();
  // Navegación en curso hacia /sesion: mientras está en vuelo se suprime la
  // TARJETA de sesión abierta (misma idea que el ref `navegando` de close-screen,
  // FLUJOS.md §2.3). Aquí es ESTADO, no un ref: la bandera se lee en el render
  // (la condición de la tarjeta), y React prohíbe leer refs en render. Como
  // estado, además, reponerla re-renderiza sola — así la tarjeta de una sesión
  // legítima reaparece en el error sin depender de que algo más dispare un
  // re-render.
  const [navegando, setNavegando] = useState(false);

  // `?? null` para distinguir "cargando" (undefined) de "no hay sesión activa"
  // (null). El home NO redirige a /sesion cuando hay sesión activa: en su lugar
  // muestra la tarjeta protagonista (abajo). Así salir de la sesión al home es un
  // estado estable — sin esto, salir rebotaría de vuelta (FLUJOS.md §2.3).
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, []);

  const days = useLiveQuery(async () => {
    const list = await db.routineDays.orderBy("orden").toArray();
    return Promise.all(
      list.map(async (day) => ({
        day,
        // Solo slots activos: el conteo debe coincidir con la plantilla real
        // (que ya filtra por activo en /plantillas). Ver §2.
        ejercicios: await countActiveSlots(day.id),
      })),
    );
  }, []);

  // Resúmenes de sesión (solo lectura). Alimentan dos cosas: el progreso de la
  // tarjeta abierta y el `hace X d` por día. No se toca ninguna query; se deriva
  // en el render de lo que ya devuelve listSessionSummaries.
  const summaries = useLiveQuery(async () => listSessionSummaries(), []);

  if (active === undefined || days === undefined || summaries === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Abriendo…</p>;
  }

  // Una sola lectura del reloj para toda la pantalla (cabecera, antigüedad y
  // `hace X d`), pasada a los helpers. El contenido solo se renderiza tras
  // resolver los liveQuery (cliente), así que esto nunca corre en SSR y no hay
  // desajuste de hidratación.
  const ahora = new Date();

  // `hace X d` = días desde la última sesión CERRADA con series reales de ese
  // routine_day_id. Los summaries vienen descendentes por fecha, pero se toma el
  // mínimo por si acaso. Un día nunca entrenado no entra al mapa → vacío honesto.
  const haceByDay = new Map<string, number>();
  for (const s of summaries) {
    const rd = s.session.routine_day_id;
    if (!rd || s.session.activa !== 0 || s.totalSeries <= 0) continue;
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
  const nombreSesion = activeDay?.day.nombre ?? "Sesión";
  const progreso =
    total > 0
      ? `${hechos} / ${total} hechos · ${series} series`
      : `${series} ${series === 1 ? "serie" : "series"}`;

  // La bandera de navegación suprime la tarjeta durante startSession: al tocar un
  // día, la sesión nueva ya está activa ANTES de que llegue el replace, y sin
  // esto la tarjeta asomaría un instante (criterio 7).
  const mostrarSesion = !!active && !navegando;

  const start = async (routineDayId: string) => {
    setNavegando(true);
    try {
      await startSession(routineDayId);
      router.replace("/sesion");
    } catch (err) {
      // Solo en el error: la navegación no ocurrió y el home sigue montado, así
      // que hay que reponer la bandera — dejarla en true suprimiría la tarjeta de
      // una sesión legítima sin error visible. NO va en un `finally`: en el camino
      // feliz debe seguir en true a través del replace (la navegación tarda más
      // que el re-render del liveQuery), y resetearla ahí reintroduciría el
      // parpadeo antes de que la navegación complete.
      setNavegando(false);
      console.error("[saya] no se pudo empezar la sesión:", err);
    }
  };

  const dayRow = (day: { id: string; nombre: string }, ejercicios: number, i: number) => {
    const dias = haceByDay.get(day.id);
    const entrenado = dias !== undefined;
    return (
      <button
        key={day.id}
        type="button"
        onClick={() => void start(day.id)}
        className={cn(
          "hover:bg-surface-2 flex items-center gap-3 px-2 py-4 text-left transition-colors",
          i > 0 && "border-border border-t",
        )}
      >
        <span className="text-faint w-5 shrink-0 text-center font-mono text-xs font-semibold tabular-nums">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block text-[15px] font-medium">{day.nombre}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">{ejercicios} ejercicios</span>
        </span>
        {/* El dato que decide qué entrenar: DM Mono, tinta plena, se lee primero.
            Un día nunca entrenado muestra el vacío honesto, en atenuado (§2). */}
        <span
          className={cn(
            "shrink-0 font-mono text-sm font-medium tabular-nums",
            entrenado ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {entrenado ? formatHace(dias) : "nunca"}
        </span>
      </button>
    );
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 p-4">
      {/* Cabecera (ambos estados): la orientación encabeza; el wordmark, chico y
          discreto, deja de ser el elemento dominante (§2). */}
      <header className="flex items-baseline justify-between pt-5">
        <p className="text-muted-foreground font-mono text-[11px] font-medium tracking-[0.14em]">
          {cabecera(ahora)}
        </p>
        <span className="text-foreground/60 text-sm font-semibold tracking-tight">saya</span>
      </header>

      {mostrarSesion ? (
        <>
          {/* Sesión abierta: la tarjeta manda. Retomar cuesta un tap y el verde
              la marca como estado activo (el único acento). */}
          <Link
            href="/sesion"
            className="border-primary bg-surface block overflow-hidden rounded-2xl border"
          >
            <div className="bg-primary text-primary-foreground flex items-center gap-2 px-4 py-2.5">
              <span className="bg-primary-foreground size-1.5 rounded-full" />
              <span className="font-mono text-[10px] font-medium tracking-[0.12em] uppercase">
                Sesión abierta
              </span>
              <span className="ml-auto font-mono text-[10px] opacity-85">
                {antiguedad(active!.iniciada_en, ahora)}
              </span>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-baseline gap-2.5">
                <Flag className="text-foreground size-4 shrink-0 self-center" />
                <span className="text-foreground text-xl font-semibold">{nombreSesion}</span>
              </div>
              {total > 0 && (
                <div className="mt-3 flex items-center gap-1">
                  {Array.from({ length: total }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < hechos ? "bg-primary" : "bg-border",
                      )}
                    />
                  ))}
                </div>
              )}
              <p className="text-foreground mt-3 font-mono text-[11px] tabular-nums">{progreso}</p>
              <p className="text-primary mt-3 text-[13px] font-semibold">Continuar donde ibas →</p>
            </div>
          </Link>

          <div className="flex flex-col">
            <p className="text-muted-foreground mb-1 px-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase">
              Empezar otro día
            </p>
            {days.map(({ day, ejercicios }, i) => dayRow(day, ejercicios, i))}
          </div>
        </>
      ) : (
        <>
          {/* Sin sesión: la lista de días ES la pantalla. La app no propone. */}
          <p className="text-muted-foreground -mt-2 text-sm">
            Elige el día. La app no propone ninguno.
          </p>
          <div className="flex flex-col">
            {days.map(({ day, ejercicios }, i) => dayRow(day, ejercicios, i))}
          </div>
        </>
      )}

      {/* Pie (ambos estados). Historial se separa: entrada con peso de contenido,
          es visita frecuente (el veredicto vive ahí). Plantillas · Catálogo ·
          Respaldo se agrupan atenuados: son configuración de cada varias semanas.
          Sin rutas nuevas, sin tab bar — reagrupación de los enlaces existentes. */}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Link
          href="/historial"
          className="border-border bg-surface flex items-center gap-3 rounded-xl border px-4 py-3.5"
        >
          <History className="text-muted-foreground size-4 shrink-0" />
          <span className="text-foreground flex-1 text-sm font-medium">Historial</span>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </Link>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/plantillas"
            className="border-border bg-surface text-muted-foreground flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium"
          >
            <ListChecks className="size-4" />
            Plantillas
          </Link>
          <Link
            href="/catalogo"
            className="border-border bg-surface text-muted-foreground flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium"
          >
            <BookOpen className="size-4" />
            Catálogo
          </Link>
          <Link
            href="/datos"
            className="border-border bg-surface text-muted-foreground flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium"
          >
            <Database className="size-4" />
            Respaldo
          </Link>
        </div>
      </div>
    </main>
  );
}
