"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { fechaCorta } from "@/components/progress/estado";
import { geometriaBalance, signo } from "@/components/progress/semanas";
import { resorte } from "@/components/session/resorte";
import type { SemanaBalance } from "@/lib/progress";

/**
 * Balance semanal (§11.6), ronda 2: columnas que se recorren con el dedo, el ratón o
 * las flechas (la maqueta `proV.after`). La semana elegida (`sel`) es estado de la
 * pantalla, que la baja a la cifra y a las celdas. Color de §10: lo positivo en tinta
 * clara, lo negativo en la misma tinta al 50 %, la descarga en contorno; nunca
 * acento, rojo ni verde. La geometría está en `semanas.ts`, con pruebas.
 *
 * El cursor lo lleva un resorte (`session/resorte.ts`). Con movimiento reducido
 * salta a su destino; sigue al dedo igual (es manipulación directa).
 */

const UMBRAL_PX = 6;
const TECLA_MS = 700;

function movimientoReducido(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Gesto {
  x0: number;
  y0: number;
  prev: number;
  /** null = sin decidir · "h" = recorre · "v" = es scroll. */
  eje: "h" | "v" | null;
}

export function BalanceChart({
  semanas,
  sel,
  alElegir,
}: {
  semanas: SemanaBalance[];
  sel: number;
  alElegir: (i: number) => void;
}) {
  const n = semanas.length;
  const geo = useMemo(() => geometriaBalance(semanas), [semanas]);
  const raiz = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const [scrub, setScrub] = useState(false);

  const selRef = useRef(sel);
  const nRef = useRef(n);
  const alElegirRef = useRef(alElegir);
  const fis = useRef({ x: 0, v: 0, raf: 0, ultimo: 0 });
  const gesto = useRef<Gesto | null>(null);
  const tecla = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selRef.current = sel;
    nRef.current = n;
    alElegirRef.current = alElegir;
  }, [sel, n, alElegir]);

  const ancho = () => raiz.current?.clientWidth ?? 0;
  const cx = (i: number) => ((i + 0.5) / Math.max(1, nRef.current)) * ancho();
  const pintar = (x: number) => {
    if (cursor.current) cursor.current.style.transform = `translate3d(${x}px,0,0)`;
  };

  const parar = useCallback(() => {
    if (fis.current.raf) cancelAnimationFrame(fis.current.raf);
    fis.current.raf = 0;
  }, []);

  const saltar = useCallback(
    (x: number) => {
      parar();
      fis.current.x = x;
      fis.current.v = 0;
      pintar(x);
    },
    [parar],
  );

  /** El resorte lleva el cursor a `destino`; al quedar quieto se quita `.scrub`. */
  const asentar = useCallback(
    (destino: number) => {
      parar();
      if (movimientoReducido()) {
        saltar(destino);
        setScrub(false);
        return;
      }
      fis.current.ultimo = 0;
      const paso = (t: number) => {
        const f = fis.current;
        const dt = f.ultimo ? (t - f.ultimo) / 1000 : 1 / 60;
        f.ultimo = t;
        const r = resorte(f.x, f.v, destino, dt, { damping: 1, response: 0.35 });
        f.x = r.x;
        f.v = r.v;
        pintar(r.x);
        if (r.quieto) {
          f.raf = 0;
          setScrub(false);
        } else {
          f.raf = requestAnimationFrame(paso);
        }
      };
      fis.current.raf = requestAnimationFrame(paso);
    },
    [parar, saltar],
  );

  const elegir = (i: number) => {
    const j = Math.min(nRef.current - 1, Math.max(0, i));
    if (j !== selRef.current) {
      selRef.current = j;
      alElegirRef.current(j);
    }
  };

  // En reposo el cursor vive en la columna elegida (invisible hasta el recorrido).
  useEffect(() => {
    if (gesto.current === null && tecla.current === null) saltar(cx(sel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, n, saltar]);

  useEffect(
    () => () => {
      if (fis.current.raf) cancelAnimationFrame(fis.current.raf);
      if (tecla.current) clearTimeout(tecla.current);
    },
    [],
  );

  const xDe = (e: PointerEvent) => {
    const r = raiz.current?.getBoundingClientRect();
    const a = ancho();
    return Math.min(a, Math.max(0, e.clientX - (r?.left ?? 0)));
  };
  const indiceDe = (x: number) => Math.floor((x / Math.max(1, ancho())) * nRef.current);

  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (tecla.current) {
      clearTimeout(tecla.current);
      tecla.current = null;
    }
    gesto.current = { x0: e.clientX, y0: e.clientY, prev: selRef.current, eje: null };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sin captura el recorrido igual funciona dentro del gráfico */
    }
    setScrub(true);
    const x = xDe(e);
    saltar(x);
    elegir(indiceDe(x));
  };

  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || g.eje === "v") return;
    if (g.eje === null) {
      const dx = Math.abs(e.clientX - g.x0);
      const dy = Math.abs(e.clientY - g.y0);
      if (dx <= UMBRAL_PX && dy <= UMBRAL_PX) return;
      g.eje = dy > dx ? "v" : "h";
      if (g.eje === "v") {
        elegir(g.prev);
        setScrub(false);
        return;
      }
    }
    const x = xDe(e);
    saltar(x);
    elegir(indiceDe(x));
  };

  const alSoltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.eje === "v") {
      return;
    }
    asentar(cx(selRef.current));
  };

  const alCancelar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    elegir(g.prev);
    asentar(cx(selRef.current));
  };

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    elegir(selRef.current + (e.key === "ArrowLeft" ? -1 : 1));
    setScrub(true);
    saltar(cx(selRef.current));
    if (tecla.current) clearTimeout(tecla.current);
    tecla.current = setTimeout(() => {
      tecla.current = null;
      setScrub(false);
    }, TECLA_MS);
  };

  const actual = semanas[sel];
  const texto = actual
    ? actual.sesiones === 0
      ? `${fechaCorta(actual.lunes)}, 0 sesiones`
      : `${fechaCorta(actual.lunes)}, ${signo(actual.net)}`
    : undefined;

  return (
    <div
      ref={raiz}
      className={scrub ? "bal scrub" : "bal"}
      role="slider"
      tabIndex={0}
      aria-label="Balance por semana"
      aria-valuemin={1}
      aria-valuemax={n}
      aria-valuenow={sel + 1}
      aria-valuetext={texto}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alCancelar}
      onKeyDown={alTeclear}
    >
      <span className="z" style={{ top: geo.cero }} />
      {semanas.map((s, i) => {
        const b = geo.barras[i];
        const clase = ["bc", b.negativo ? "n" : "", b.deload ? "dl" : "", i === sel ? "sel" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={s.lunes} className={clase} style={{ left: `${b.left}%`, width: `${b.width}%` }}>
            {!b.hueco && <i style={{ top: b.top, height: b.alto }} />}
            <b>{fechaCorta(s.lunes)}</b>
          </span>
        );
      })}
      <span ref={cursor} className="cur" />
    </div>
  );
}
