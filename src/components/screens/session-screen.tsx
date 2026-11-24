"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";

import { ExercisePicker } from "@/components/exercise-picker";
import { claveSerie, ExerciseCard } from "@/components/session/exercise-card";
import { RestCounter } from "@/components/session/rest-counter";
import { dampingDe, destinoPager, goma, resorte } from "@/components/session/resorte";
import { SesionCargando } from "@/components/session/sesion-cargando";
import { SubstitutePicker } from "@/components/session/substitute-picker";
import { Anillo } from "@/components/ui/anillo";
import { Aviso, Panel } from "@/components/ui/panel";
import {
  addAdHocExercise,
  deleteSessionExercise,
  deleteSetGroup,
  getActiveSession,
  loadSessionView,
  updateSessionExerciseNote,
  type SessionExerciseView,
  type SessionView,
} from "@/lib/db/queries";

const INDEX_KEY = (sessionId: string) => `saya:ejercicio:${sessionId}`;
const DESHACER_MS = 4500;
const AVISO_MS = 2600;
const UMBRAL_EJE = 10;

function readIndex(sessionId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(INDEX_KEY(sessionId));
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sinMovimiento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function SessionScreen() {
  const router = useRouter();

  const view = useLiveQuery(async () => {
    const session = await getActiveSession();
    if (!session) return null;
    return loadSessionView(session.id);
  }, []);

  useEffect(() => {
    if (view === null) router.replace("/");
  }, [view, router]);

  if (view === undefined) {
    return <SesionCargando />;
  }
  if (view === null) {
    return <p className="text-ink2 p-6 text-sm">Sin sesión activa.</p>;
  }

  return <ActiveSession key={view.session.id} view={view} />;
}

interface AvisoEstado {
  texto: string;
  deshacer?: () => void;
}

function ActiveSession({ view }: { view: SessionView }) {
  const sessionId = view.session.id;
  const [index, setIndex] = useState(() => readIndex(sessionId));
  const [hoja, setHoja] = useState<"agregar" | "cambiar" | "nota" | null>(null);
  // Lo que se borró y espera su «Deshacer»: se esconde al momento y se borra de
  // verdad a los 4500 ms (o al desmontar la pantalla).
  const [seriesOcultas, setSeriesOcultas] = useState<ReadonlySet<string>>(() => new Set());
  const [quitados, setQuitados] = useState<ReadonlySet<string>>(() => new Set());
  const [aviso, setAviso] = useState<AvisoEstado | null>(null);
  const pendientes = useRef(new Map<string, { timer: number; ejecutar: () => void }>());
  const avisoTimer = useRef(0);

  useEffect(() => {
    window.localStorage.setItem(INDEX_KEY(sessionId), String(index));
  }, [sessionId, index]);

  // Al desmontar, lo pendiente se hace de una vez.
  useEffect(() => {
    const lista = pendientes.current;
    return () => {
      for (const { timer, ejecutar } of lista.values()) {
        window.clearTimeout(timer);
        ejecutar();
      }
      lista.clear();
      window.clearTimeout(avisoTimer.current);
    };
  }, []);

  const items = useMemo(
    () => view.items.filter((i) => !quitados.has(i.sessionExercise.id)),
    [view.items, quitados],
  );
  const n = items.length;
  const safeIndex = n === 0 ? 0 : Math.min(index, n - 1);
  const item: SessionExerciseView | undefined = items[safeIndex];

  // El `creado_en` más reciente de TODA la sesión (cualquier ejercicio): el
  // contador cuenta contra la última serie de la sesión, no del ejercicio, así
  // que cambiar de ejercicio no lo reinicia (§3 / criterio 8).
  const ultimoCreadoEn = useMemo(() => {
    const times = view.items
      .flatMap((i) => i.sets)
      .map((s) => s.creado_en)
      .filter((t): t is string => !!t);
    return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
  }, [view.items]);

  // ── Avisos y borrados con «Deshacer» ──────────────────────────────────────

  const mostrarAviso = (texto: string, deshacer?: () => void) => {
    window.clearTimeout(avisoTimer.current);
    setAviso({ texto, deshacer });
    avisoTimer.current = window.setTimeout(
      () => setAviso(null),
      deshacer ? DESHACER_MS : AVISO_MS,
    );
  };

  const programar = (clave: string, ejecutar: () => void) => {
    const timer = window.setTimeout(() => {
      pendientes.current.delete(clave);
      ejecutar();
    }, DESHACER_MS);
    pendientes.current.set(clave, { timer, ejecutar });
  };

  const cancelar = (clave: string) => {
    const p = pendientes.current.get(clave);
    if (!p) return;
    window.clearTimeout(p.timer);
    pendientes.current.delete(clave);
  };

  const sinClave = (set: ReadonlySet<string>, clave: string): ReadonlySet<string> => {
    const copia = new Set(set);
    copia.delete(clave);
    return copia;
  };

  const borrarSerie = (sessionExerciseId: string, setIndex: number, numero: number) => {
    const clave = claveSerie(sessionExerciseId, setIndex);
    setSeriesOcultas((prev) => new Set(prev).add(clave));
    programar(clave, () => {
      void deleteSetGroup(sessionExerciseId, setIndex).then(() => {
        // Un índice libre puede reusarse: la clave se suelta cuando la consulta ya
        // no ve el grupo.
        window.setTimeout(() => setSeriesOcultas((prev) => sinClave(prev, clave)), 400);
      });
    });
    mostrarAviso(`Serie ${numero} borrada.`, () => {
      cancelar(clave);
      setSeriesOcultas((prev) => sinClave(prev, clave));
      setAviso(null);
    });
  };

  const quitar = (sessionExerciseId: string) => {
    const clave = `quitar:${sessionExerciseId}`;
    setQuitados((prev) => new Set(prev).add(sessionExerciseId));
    programar(clave, () => void deleteSessionExercise(sessionExerciseId));
    mostrarAviso("Quitado de la sesión.", () => {
      cancelar(clave);
      setQuitados((prev) => sinClave(prev, sessionExerciseId));
      setAviso(null);
    });
  };

  const agregar = async (exerciseId: string) => {
    await addAdHocExercise(sessionId, exerciseId);
    setHoja(null);
    // Saltar al recién agregado: queda al final de la lista visual.
    setIndex(n);
  };

  // ── El pager ──────────────────────────────────────────────────────────────

  const pgRef = useRef<HTMLDivElement>(null);
  const trkRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const anilloRef = useRef<HTMLSpanElement>(null);
  const fichas = useRef<(HTMLButtonElement | null)[]>([]);
  const xRef = useRef(0);
  const anchoRef = useRef(0);
  const nRef = useRef(n);
  const destinoRef = useRef(-1);
  const rafRef = useRef(0);
  const animandoRef = useRef(false);
  const arrastre = useRef<{
    id: number;
    x0: number;
    y0: number;
    px0: number;
    eje: "x" | "y" | null;
    muestras: { x: number; t: number }[];
  } | null>(null);
  const suprimirClick = useRef(false);

  const aplicarX = useCallback((x: number) => {
    xRef.current = x;
    const trk = trkRef.current;
    const pg = pgRef.current;
    if (!trk || !pg) return;
    trk.style.transform = `translate3d(${x}px,0,0)`;
    const total = nRef.current;
    const ancho = anchoRef.current || 1;
    const frac = Math.min(Math.max(-x / ancho, 0), Math.max(total - 1, 0));
    const i0 = Math.floor(frac);
    const i1 = Math.min(total - 1, i0 + 1);
    const f = frac - i0;
    // La altura interpola entre la tarjeta actual y la vecina.
    const c0 = trk.children[i0] as HTMLElement | undefined;
    const c1 = trk.children[i1] as HTMLElement | undefined;
    if (c0) {
      const h0 = c0.offsetHeight;
      const h1 = c1 ? c1.offsetHeight : h0;
      pg.style.height = `${h0 + (h1 - h0) * f}px`;
    }
    // El anillo viaja con el deslizamiento; bajo movimiento reducido salta.
    const anillo = anilloRef.current;
    const a = fichas.current[i0];
    if (anillo && a) {
      const b = fichas.current[i1] ?? a;
      const g = sinMovimiento() ? Math.round(f) : f;
      anillo.style.left = `${a.offsetLeft + (b.offsetLeft - a.offsetLeft) * g}px`;
    }
  }, []);

  const animarA = useCallback(
    (destino: number, vx: number) => {
      cancelAnimationFrame(rafRef.current);
      animandoRef.current = false;
      const objetivo = -destino * anchoRef.current;
      if (sinMovimiento() || anchoRef.current === 0) {
        aplicarX(objetivo);
        return;
      }
      animandoRef.current = true;
      let x = xRef.current;
      let v = vx;
      let antes = performance.now();
      const damping = dampingDe(vx);
      const paso = (ahora: number) => {
        const dt = (ahora - antes) / 1000;
        antes = ahora;
        const p = resorte(x, v, objetivo, dt, { damping, response: 0.35 });
        x = p.x;
        v = p.v;
        aplicarX(x);
        if (p.quieto) animandoRef.current = false;
        else rafRef.current = requestAnimationFrame(paso);
      };
      rafRef.current = requestAnimationFrame(paso);
    },
    [aplicarX],
  );

  // Medidas: el ancho del pager y el alto de cada tarjeta (crece al anotar).
  const idsKey = items.map((i) => i.sessionExercise.id).join("|");
  useLayoutEffect(() => {
    nRef.current = n;
    const pg = pgRef.current;
    const trk = trkRef.current;
    if (!pg || !trk) return;
    const medir = () => {
      anchoRef.current = pg.clientWidth;
      // En reposo la tarjeta actual manda: se recoloca sin animar.
      if (arrastre.current?.eje !== "x" && !animandoRef.current) {
        aplicarX(-Math.min(destinoRef.current, nRef.current - 1) * anchoRef.current);
      } else {
        aplicarX(xRef.current);
      }
    };
    anchoRef.current = pg.clientWidth;
    if (destinoRef.current === -1) {
      destinoRef.current = safeIndex;
      aplicarX(-safeIndex * anchoRef.current);
    } else {
      aplicarX(xRef.current);
    }
    const ro = new ResizeObserver(medir);
    ro.observe(pg);
    for (const c of Array.from(trk.children)) ro.observe(c);
    return () => ro.disconnect();
    // `safeIndex` sólo importa la primera vez (la posición guardada).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, n, aplicarX]);

  // El índice cambió (ficha, alta o baja): el pager va a su tarjeta con el resorte.
  useEffect(() => {
    if (n === 0) return;
    if (destinoRef.current === safeIndex) return;
    destinoRef.current = safeIndex;
    animarA(safeIndex, 0);
  }, [safeIndex, n, animarA]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // La tira de fichas muestra la actual: si queda a menos de 20 px de un borde, se desplaza.
  useEffect(() => {
    const tira = chipsRef.current;
    const ficha = fichas.current[safeIndex];
    if (!tira || !ficha) return;
    const izq = ficha.offsetLeft;
    const der = izq + ficha.offsetWidth;
    let destino: number | null = null;
    if (izq < tira.scrollLeft + 20) destino = Math.max(0, izq - 20);
    else if (der > tira.scrollLeft + tira.clientWidth - 20) destino = der + 20 - tira.clientWidth;
    if (destino !== null) {
      tira.scrollTo({ left: destino, behavior: sinMovimiento() ? "auto" : "smooth" });
    }
  }, [safeIndex, n]);

  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    if (n < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("input,textarea,.dv,[data-nodrag]")) return;
    cancelAnimationFrame(rafRef.current);
    animandoRef.current = false;
    arrastre.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      px0: xRef.current,
      eje: null,
      muestras: [{ x: e.clientX, t: e.timeStamp }],
    };
  };

  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (a.eje === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL_EJE) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Gana el vertical: se suelta y el scroll es normal. El pager no se movió.
        arrastre.current = null;
        if (xRef.current !== -destinoRef.current * anchoRef.current) animarA(destinoRef.current, 0);
        return;
      }
      a.eje = "x";
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    a.muestras.push({ x: e.clientX, t: e.timeStamp });
    if (a.muestras.length > 6) a.muestras.shift();
    const ancho = anchoRef.current;
    const minimo = -(nRef.current - 1) * ancho;
    let x = a.px0 + dx;
    if (x > 0) x = goma(x, ancho);
    else if (x < minimo) x = minimo - goma(minimo - x, ancho);
    aplicarX(x);
  };

  const alSoltar = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    arrastre.current = null;
    if (a.eje !== "x") return;
    suprimirClick.current = true;
    window.setTimeout(() => {
      suprimirClick.current = false;
    }, 0);
    const m = a.muestras;
    let vx = 0;
    if (m.length > 1 && e.timeStamp - m[m.length - 1].t < 80) {
      const dt = (m[m.length - 1].t - m[0].t) / 1000;
      if (dt > 0) vx = (m[m.length - 1].x - m[0].x) / dt;
    }
    const destino = destinoPager({
      x: xRef.current,
      vx,
      ancho: anchoRef.current,
      indice: destinoRef.current,
      total: nRef.current,
    });
    destinoRef.current = destino;
    setIndex(destino);
    animarA(destino, vx);
  };

  // ── Lo que se pinta ───────────────────────────────────────────────────────

  return (
    <div className="ses">
      {/* La cabeza: salida que deja la sesión abierta, el día y el contador desde la
          última serie. La pantalla pinta su propia cabeza y su propia hoja (la regla
          U de globals.css desenvuelve la del shell). */}
      <header className="stop">
        {/* Volver a Hoy SIN cerrar: la sesión sigue activa (§1). No toca Dexie; Hoy
            no rebota porque no autorredirecciona a /sesion. Volver a entrar reanuda
            en el mismo ejercicio (saya:ejercicio:<id>). */}
        <Link href="/" aria-label="Volver al home sin cerrar la sesión" className="back">
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
          Volver
        </Link>
        <span className="day">{view.routineDay?.nombre ?? "Sesión libre"}</span>
        <RestCounter lastCreadoEn={ultimoCreadoEn} />
      </header>

      <div
        className="hoja"
        data-propia=""
        style={{ "--ventana": "70px", "--hoja-pb": "0px", marginTop: 12 } as CSSProperties}
      >
        <main className="mx-auto flex w-full max-w-md flex-col px-4 pt-4">
          {n === 0 || !item ? (
            <>
              <p className="h3 rise" style={{ marginTop: 36, "--i": 0 } as CSSProperties}>
                Sin ejercicios
              </p>
              <div className="acts">
                <button type="button" className="btn2 w" onClick={() => setHoja("agregar")}>
                  + Ejercicio
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Salto directo, en orden_visual. Este orden NO cambia según lo que
                  vayas ejecutando: una lista que se reacomoda sola entre series
                  desorienta. */}
              <div
                ref={chipsRef}
                className="chips rise"
                role="tablist"
                aria-label="Ejercicios"
                style={{ "--i": 0 } as CSSProperties}
              >
                {items.map((other, i) => (
                  <button
                    key={other.sessionExercise.id}
                    ref={(el) => {
                      fichas.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    className={i === safeIndex ? "chip cur" : "chip"}
                    aria-selected={i === safeIndex}
                    aria-label={other.exercise.nombre}
                    data-hecho={other.sets.some((s) => s.reps > 0) ? "" : undefined}
                    onClick={() => {
                      if (i !== safeIndex) setIndex(i);
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="chip add"
                  aria-label="Agregar ejercicio"
                  onClick={() => setHoja("agregar")}
                >
                  +
                </button>
                <span ref={anilloRef} className="cring" aria-hidden="true">
                  <Anillo redondo />
                </span>
              </div>

              <div
                ref={pgRef}
                className="pg rise"
                style={{ "--i": 1 } as CSSProperties}
                onPointerDown={alBajar}
                onPointerMove={alMover}
                onPointerUp={alSoltar}
                onPointerCancel={alSoltar}
                onClickCapture={(e) => {
                  if (suprimirClick.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <div ref={trkRef} className="trk">
                  {items.map((it, i) => (
                    <ExerciseCard
                      key={it.sessionExercise.id}
                      item={it}
                      sessionId={sessionId}
                      posicion={i + 1}
                      total={n}
                      activa={i === safeIndex}
                      ocultas={seriesOcultas}
                      onNota={() => setHoja("nota")}
                      onBorrarSerie={borrarSerie}
                      onQuitar={quitar}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <nav aria-label="Sesión" className="sbot">
            {item && (
              <button
                type="button"
                className="btn2 sw"
                aria-label={`Cambiar ${item.exercise.nombre}`}
                onClick={() => setHoja("cambiar")}
              >
                Cambiar
              </button>
            )}
            <Link href="/sesion/cerrar" className="btn2">
              Cerrar sesión
            </Link>
          </nav>
        </main>
      </div>

      {hoja === "agregar" && (
        <HojaAgregar
          enSesion={view.items.map((i) => i.exercise.id)}
          onPick={(id) => void agregar(id)}
          alCerrar={() => setHoja(null)}
        />
      )}
      {hoja === "cambiar" && item && (
        <Panel
          abierto
          alCerrar={() => setHoja(null)}
          titulo="Cambiar ejercicio"
          className="ses-hoja"
        >
          <p className="s r24-sub">{item.exercise.nombre}</p>
          <SubstitutePicker
            item={item}
            enSesion={view.items.map((i) => i.exercise.id)}
            onDone={() => setHoja(null)}
          />
        </Panel>
      )}
      {hoja === "nota" && item && <HojaNota item={item} alCerrar={() => setHoja(null)} />}

      {aviso && (
        <Aviso conBarraAgente>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span>{aviso.texto}</span>
            {aviso.deshacer && (
              <button
                type="button"
                className="tl"
                style={{ minHeight: 36 }}
                onClick={aviso.deshacer}
              >
                Deshacer
              </button>
            )}
          </div>
        </Aviso>
      )}
    </div>
  );
}

/** «Agregar ejercicio del catálogo»: el catálogo sin lo que ya está en la sesión. */
function HojaAgregar({
  enSesion,
  onPick,
  alCerrar,
}: {
  enSesion: string[];
  onPick: (exerciseId: string) => void;
  alCerrar: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  return (
    <Panel abierto alCerrar={alCerrar} titulo="Agregar ejercicio del catálogo" className="ses-hoja">
      <input
        type="search"
        className="tin"
        style={{ marginTop: 16 }}
        placeholder="Buscar…"
        aria-label="Buscar en el catálogo"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <ExercisePicker
        variante="filas"
        sufijo="mas"
        filtro={filtro}
        excludeIds={enSesion}
        onPick={(exercise) => onPick(exercise.id)}
      />
    </Panel>
  );
}

/** «Nota del ejercicio»: se guarda al tocar «Listo» y al cerrar de cualquier otra forma, si cambió. */
function HojaNota({ item, alCerrar }: { item: SessionExerciseView; alCerrar: () => void }) {
  const original = item.sessionExercise.nota ?? "";
  const [texto, setTexto] = useState(original);

  const cerrar = () => {
    if (texto !== original) {
      void updateSessionExerciseNote(item.sessionExercise.id, texto.trim() || null);
    }
    alCerrar();
  };

  return (
    <Panel abierto alCerrar={cerrar} titulo="Nota del ejercicio" className="ses-hoja">
      <p className="s r24-sub">{item.exercise.nombre}</p>
      <textarea
        className="tin"
        style={{ marginTop: 16 }}
        placeholder="Máquina distinta, molestia, agarre…"
        aria-label="Nota del ejercicio"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="acts">
        <button type="button" className="btn big w" onClick={cerrar}>
          Listo
        </button>
      </div>
    </Panel>
  );
}
