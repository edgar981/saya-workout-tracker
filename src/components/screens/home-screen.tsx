"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import {
  arribaBarraLlena,
  conducirBarra,
  conduciendo,
  empezarConducir,
  movimientoReducido,
  soltarBarra,
} from "@/components/barra-estado";
import { DayPreviewSheet } from "@/components/day-preview-sheet";
import { HomeSkeleton } from "@/components/skeletons";
import { Anillo } from "@/components/ui/anillo";
import { buttonVariants } from "@/components/ui/button";
import { BloqueError } from "@/components/ui/estados";
import { ALTO_CABEZA_PX, Cabeza, Hoja } from "@/components/ui/hoja";
import { agregarMuestra, crearResorte, ejeDe, velocidad, type Muestra, type Resorte } from "@/lib/barra";
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
  alturaBaja,
  decidirSoltar,
  EPS_HOJA,
  MEMORIA_RUEDA_HOJA,
  pintarHoja,
  progresoHoja,
  puntosSpark,
  reclamaToque,
  reglaRuedaHoja,
  RESPUESTA_HOJA,
  seguirHoja,
  SPARK_H,
  SPARK_N,
  SPARK_W,
  UMBRAL_TOQUE_PX,
  valorDia,
} from "@/lib/hoja-hoy";
import {
  diasDesde,
  estadoSesion,
  fechaCabeza,
  fechaDiaMes,
  lineaSesionTesela,
  semanaMesociclo,
  subtituloHoy,
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
            <section className="sube" style={{ "--i": 1 } as CSSProperties}>
              <BloqueError
                titulo="No se pudieron leer tus datos en este teléfono."
                primaria
                alReintentar={() => setIntento((n) => n + 1)}
              />
            </section>
          </main>
        </Hoja>
      </>
    );
  }

  return <Contenido vista={lectura.vista} />;
}

/** ¿El evento nace donde la hoja no manda (un diálogo, la barra, un campo)? */
function nace(e: Event): boolean {
  const t = e.target;
  return t instanceof Element && t.closest('[role="dialog"], .navg, input, textarea') !== null;
}

interface Acciones {
  alternar(abajo?: boolean): void;
  releer(): void;
}

/**
 * La hoja de vidrio de Hoy que baja con el dedo, la rueda o el asa (`wireHoy` de la
 * maqueta). Todo movimiento es un `Resorte` cerrado en el tiempo: ninguno depende de
 * que los cuadros corran. El estado vivo va en refs; `baja` en estado sólo cambia al
 * asentarse, para el `aria-label` del asa.
 */
function useHojaDeHoy() {
  const hojaRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);
  const acciones = useRef<Acciones | null>(null);
  const [baja, setBaja] = useState(false);

  useEffect(() => {
    const hoja = hojaRef.current;
    const bento = bentoRef.current;
    if (!hoja || !bento) return;

    let montado = true;
    let Y = 300;
    let abajo = false;
    let rueda = MEMORIA_RUEDA_HOJA;
    let resto: HTMLElement[] = [];
    let quitarClick: (() => void) | null = null;

    const leerResto = () => {
      resto = Array.from(bento.children).slice(1) as HTMLElement[];
    };
    leerResto();

    const pintar = (y: number) => {
      const P = pintarHoja(y, Y);
      hoja.style.transform = P.transform;
      for (const t of resto) {
        t.style.opacity = P.opacidad;
        t.style.visibility = P.oculta ? "hidden" : "";
      }
      if (conduciendo()) conducirBarra(progresoHoja(y, Y));
    };

    const resorte: Resorte = crearResorte(pintar, {
      respuesta: RESPUESTA_HOJA,
      eps: EPS_HOJA,
      reducido: movimientoReducido,
    });

    const medir = () => {
      const primera = bento.firstElementChild as HTMLElement | null;
      if (!primera) return;
      const abajoPrimera =
        hoja.getBoundingClientRect().top - resorte.x + primera.offsetTop + primera.offsetHeight;
      Y = alturaBaja(arribaBarraLlena(), abajoPrimera);
    };

    const empezar = () => {
      if (!abajo && resorte.x <= 0.5) {
        empezarConducir(true);
        medir();
      } else {
        empezarConducir(false);
      }
      resorte.parar();
      for (const t of resto) t.style.animation = "none";
    };

    const asentar = (a: boolean) => {
      if (!montado) return;
      abajo = a;
      setBaja(a);
      document.documentElement.toggleAttribute("data-hoja-baja", a);
      if (!a) {
        hoja.style.transform = "";
        for (const t of resto) {
          t.style.opacity = "";
          t.style.visibility = "";
        }
      }
      soltarBarra(a);
    };

    const seguir = (y: number) => {
      resorte.poner(seguirHoja(y, Y));
    };

    const soltar = (vy: number) => {
      const d = decidirSoltar(resorte.x, vy, Y);
      resorte.ir(d.baja ? Y : 0, {
        v: vy,
        amortiguacion: d.amortiguacion,
        listo: () => asentar(d.baja),
      });
    };

    const alternar = (destino?: boolean) => {
      const actual = resorte.enMarcha() ? resorte.destino > 0 : abajo;
      const quiere = destino ?? !actual;
      if (quiere === actual) return;
      window.scrollTo(0, 0);
      empezar();
      resorte.ir(quiere ? Y : 0, { listo: () => asentar(quiere) });
    };

    acciones.current = {
      alternar,
      releer() {
        leerResto();
        if (abajo) pintar(resorte.x);
      },
    };

    // Tras un gesto reclamado, el clic que sigue no abre la tesela ni el asa.
    const tragarClick = () => {
      quitarClick?.();
      const f = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        quitar();
      };
      const id = window.setTimeout(() => quitar(), 400);
      const quitar = () => {
        window.removeEventListener("click", f, true);
        window.clearTimeout(id);
        if (quitarClick === quitar) quitarClick = null;
      };
      quitarClick = quitar;
      window.addEventListener("click", f, true);
    };

    /* el dedo */
    let toque: {
      x0: number;
      y0: number;
      estado: "espera" | "muerto" | "mio";
      muestras: Muestra[];
      base: number;
    } | null = null;

    const alEmpezarToque = (e: TouchEvent) => {
      if (nace(e) || e.touches.length !== 1) return;
      toque = {
        x0: e.touches[0].clientX,
        y0: e.touches[0].clientY,
        estado: "espera",
        muestras: [],
        base: 0,
      };
    };
    const alMoverToque = (e: TouchEvent) => {
      const t = toque;
      if (!t || t.estado === "muerto") return;
      const p = e.touches[0];
      if (t.estado === "espera") {
        const r = reclamaToque(p.clientX - t.x0, p.clientY - t.y0, abajo, window.scrollY);
        if (r === "espera") return;
        if (r === "muerto") {
          t.estado = "muerto";
          return;
        }
        t.y0 = p.clientY;
        empezar();
        t.base = resorte.x;
        t.estado = "mio";
        return;
      }
      if (e.cancelable) e.preventDefault();
      t.muestras = agregarMuestra(t.muestras, { x: p.clientX, y: p.clientY, t: e.timeStamp });
      seguir(t.base + (p.clientY - t.y0));
    };
    const alSoltarToque = (e: TouchEvent) => {
      const t = toque;
      toque = null;
      if (!t || t.estado !== "mio") return;
      tragarClick();
      soltar(velocidad(t.muestras, e.timeStamp).vy);
    };
    const alCancelarToque = () => {
      const t = toque;
      toque = null;
      if (!t || t.estado !== "mio") return;
      tragarClick();
      soltar(0);
    };

    /* el ratón (para revisar en escritorio) */
    let raton: {
      x0: number;
      y0: number;
      estado: "espera" | "mio";
      muestras: Muestra[];
      base: number;
    } | null = null;

    const alBajarRaton = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || nace(e)) return;
      if (!(abajo || window.scrollY <= 0)) return;
      raton = { x0: e.clientX, y0: e.clientY, estado: "espera", muestras: [], base: 0 };
    };
    const alMoverRaton = (e: PointerEvent) => {
      const m = raton;
      if (!m) return;
      const dx = e.clientX - m.x0;
      const dy = e.clientY - m.y0;
      if (m.estado === "espera") {
        const eje = ejeDe(dx, dy, UMBRAL_TOQUE_PX);
        if (eje === null) return;
        if (eje === "x") {
          raton = null;
          return;
        }
        empezar();
        m.base = resorte.x;
        m.estado = "mio";
        document.body.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
        try {
          (e.target as Element).setPointerCapture(e.pointerId);
        } catch {
          /* sin captura: el gesto sigue en window */
        }
      }
      m.muestras = agregarMuestra(m.muestras, { x: e.clientX, y: e.clientY, t: e.timeStamp });
      seguir(m.base + dy);
    };
    const alSoltarRaton = (e: PointerEvent) => {
      const m = raton;
      raton = null;
      if (!m || m.estado !== "mio") return;
      document.body.style.userSelect = "";
      tragarClick();
      soltar(velocidad(m.muestras, e.timeStamp).vy);
    };
    const alCancelarRaton = () => {
      const m = raton;
      raton = null;
      if (!m || m.estado !== "mio") return;
      document.body.style.userSelect = "";
      tragarClick();
      soltar(0);
    };

    /* la rueda */
    const alRodar = (e: WheelEvent) => {
      if (nace(e)) return;
      const r = reglaRuedaHoja(rueda, {
        deltaY: e.deltaY,
        scrollY: window.scrollY,
        baja: abajo,
        ahora: e.timeStamp,
      });
      rueda = r.memoria;
      if (r.consume && e.cancelable) e.preventDefault();
      if (r.accion === "bajar") alternar(true);
      else if (r.accion === "subir") alternar(false);
    };

    const alRedimensionar = () => {
      if (!abajo) return;
      medir();
      resorte.poner(Y);
    };

    window.addEventListener("touchstart", alEmpezarToque, { passive: true });
    window.addEventListener("touchmove", alMoverToque, { passive: false });
    window.addEventListener("touchend", alSoltarToque);
    window.addEventListener("touchcancel", alCancelarToque);
    window.addEventListener("pointerdown", alBajarRaton);
    window.addEventListener("pointermove", alMoverRaton);
    window.addEventListener("pointerup", alSoltarRaton);
    window.addEventListener("pointercancel", alCancelarRaton);
    window.addEventListener("wheel", alRodar, { passive: false });
    window.addEventListener("resize", alRedimensionar);

    return () => {
      montado = false;
      acciones.current = null;
      window.removeEventListener("touchstart", alEmpezarToque);
      window.removeEventListener("touchmove", alMoverToque);
      window.removeEventListener("touchend", alSoltarToque);
      window.removeEventListener("touchcancel", alCancelarToque);
      window.removeEventListener("pointerdown", alBajarRaton);
      window.removeEventListener("pointermove", alMoverRaton);
      window.removeEventListener("pointerup", alSoltarRaton);
      window.removeEventListener("pointercancel", alCancelarRaton);
      window.removeEventListener("wheel", alRodar);
      window.removeEventListener("resize", alRedimensionar);
      quitarClick?.();
      document.body.style.userSelect = "";
      resorte.parar();
      document.documentElement.removeAttribute("data-hoja-baja");
      if (conduciendo()) soltarBarra(false);
    };
  }, []);

  // Con datos vivos: el bento se vuelve a pintar con la hoja abajo; las teselas
  // nuevas también quedan apagadas.
  useEffect(() => {
    acciones.current?.releer();
  });

  const alternar = useCallback(() => acciones.current?.alternar(), []);

  return { hojaRef, gripRef, bentoRef, baja, alternar };
}

function Contenido({ vista }: { vista: HomeVista }) {
  const { active, mesociclo, days, summaries, pesos } = vista;
  const router = useRouter();
  // Navegación en curso hacia /sesion: mientras está en vuelo se suprime la
  // TESELA de sesión abierta (la sesión nueva ya está activa antes del replace).
  // El patrón —y por qué es estado y no ref— vive en useNavegando.
  const { navegando, marcar, reponer } = useNavegando();
  const { hojaRef, gripRef, bentoRef, baja, alternar } = useHojaDeHoy();

  // Día elegido para la hoja de vista previa (§1). Tocar un día YA NO inicia la
  // sesión: abre esta hoja. Es solo estado de UI; no escribe nada en Dexie.
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Una sola lectura del reloj para toda la pantalla. El contenido solo se
  // renderiza tras resolver el liveQuery (cliente): no hay desajuste de hidratación.
  const ahora = new Date();

  // Días desde la última sesión CERRADA con series reales de ese routine_day_id.
  // Un día nunca entrenado no entra al mapa → «nunca».
  const haceByDay = new Map<string, number>();
  for (const s of summaries) {
    const rd = s.session.routine_day_id;
    if (s.session.activa !== 0 || s.totalSeries <= 0 || !rd) continue;
    const dias = diasDesde(s.session.fecha, ahora);
    const prev = haceByDay.get(rd);
    if (prev === undefined || dias < prev) haceByDay.set(rd, dias);
  }

  // Progreso de la sesión abierta, para la tesela grande.
  const activeSummary = active ? summaries.find((s) => s.session.id === active.id) : undefined;
  const activeDay =
    active?.routine_day_id != null
      ? days.find((d) => d.day.id === active.routine_day_id)
      : undefined;
  const total = activeDay?.ejercicios ?? 0;
  const hechos = activeSummary?.ejerciciosConSeries ?? 0;
  const series = activeSummary?.totalSeries ?? 0;
  const nombreSesion = activeDay?.day.nombre ?? "Sesión libre";

  // La bandera de navegación suprime la tesela durante startSession: al tocar un
  // día, la sesión nueva ya está activa ANTES de que llegue el replace, y sin
  // esto la tesela asomaría un instante.
  const mostrarSesion = !!active && !navegando;

  const start = async (routineDayId: string) => {
    marcar();
    try {
      await startSession(routineDayId);
      router.replace("/sesion");
    } catch (err) {
      // Solo en el error se repone (ver useNavegando): la navegación no ocurrió y
      // Hoy sigue montado, así que dejar la bandera en alto escondería la tesela
      // de una sesión legítima. En el camino feliz NO se repone.
      reponer();
      console.error("[saya] no se pudo empezar la sesión:", err);
    }
  };

  const semana = mesociclo?.iniciado_en ? semanaMesociclo(mesociclo.iniciado_en, ahora) : null;
  const subtitulo = subtituloHoy(mesociclo?.nombre ?? null, semana);
  const peso = resumirPeso(pesos);
  const trazo = peso
    ? puntosSpark(
        peso.serie.slice(-SPARK_N).map((p) => p.valor),
        SPARK_W,
        SPARK_H,
      )
    : null;

  const tesela = (
    <>
      {mostrarSesion && (
        <Link
          href="/sesion"
          className="tile tile-big sube"
          style={{ "--i": 1 } as CSSProperties}
          aria-label={`Continuar ${nombreSesion}`}
        >
          <Anillo />
          <span className="tile-st">
            <span className="vivo" aria-hidden="true" />
            {estadoSesion(active!.iniciada_en, ahora)}
          </span>
          <span className="tile-f2 tile-f2-big">{total > 0 ? `${hechos} / ${total}` : hechos}</span>
          <span className="tile-s tile-s0">{lineaSesionTesela(nombreSesion, series)}</span>
          {total > 0 && (
            <span className="segs" aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <i key={i} className={i < hechos ? "on" : undefined} />
              ))}
            </span>
          )}
          <span className={cn(buttonVariants({ variant: "default" }), "mt-2.5 w-full")}>
            Continuar donde ibas →
          </span>
        </Link>
      )}

      {/* Sólo las áreas que existen. Aprender, Disponible y Pago piden Tiempo y
          Dinero: no se pintan. */}
      <Link href="/cuerpo" className="tile sube" style={{ "--i": 2 } as CSSProperties}>
        <span className="kicker">Peso</span>
        <span className="tile-f2">
          {peso ? (
            <>
              {formatoPeso(peso.ultimo)}
              <span className="tile-u">{peso.unidad}</span>
            </>
          ) : (
            "—"
          )}
        </span>
        {trazo && (
          <svg
            className="spk"
            width={SPARK_W}
            height={SPARK_H}
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            aria-hidden="true"
          >
            <path d={trazo} />
          </svg>
        )}
        {peso && <span className="tile-s">{fechaDiaMes(peso.ultimaFecha)}</span>}
      </Link>
    </>
  );

  const dias =
    days.length > 0 ? (
      <div className="tile tile-dias sube" style={{ "--i": mostrarSesion ? 3 : 1 } as CSSProperties}>
        <span className="kicker">{mostrarSesion ? "Empezar otro día" : "Entrenar"}</span>
        <div className="dstrip">
          {days.map(({ day }, i) => {
            const abierta = mostrarSesion && active!.routine_day_id === day.id;
            const hace = haceByDay.get(day.id);
            return (
              <button
                key={day.id}
                type="button"
                className="dk"
                onClick={() => setSelectedDayId(day.id)}
                aria-label={`${day.nombre}, ${valorDia(hace, abierta, false)}`}
              >
                <b>{i + 1}</b>
                <span>{valorDia(hace, abierta, true)}</span>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="px-4">
        <Cabeza titulo={fechaCabeza(ahora)} subtitulo={subtitulo ?? undefined} ajustes />
      </div>
      <div
        ref={hojaRef}
        className="hoja"
        data-propia=""
        data-tirable=""
        style={{ "--ventana": `${ALTO_CABEZA_PX}px` } as CSSProperties}
      >
        <button
          ref={gripRef}
          type="button"
          className="grip"
          aria-label={baja ? "Subir la hoja" : "Bajar la hoja"}
          onClick={alternar}
        />
        <main className="mx-auto w-full max-w-md p-4">
          <div ref={bentoRef} className="bento">
            {mostrarSesion ? (
              <>
                {tesela}
                {dias}
              </>
            ) : (
              <>
                {dias}
                {tesela}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Hoja de vista previa (§1): tocar un día la abre; el botón es el único
          punto que escribe (reusa start → startSession). */}
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
