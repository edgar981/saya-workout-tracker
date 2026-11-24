"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { Orbe } from "@/components/agente/orbe";
import {
  conduciendo,
  leerBarra,
  movimientoReducido,
  ponerBarra,
  registrarBarra,
  ultimoCambioBarra,
} from "@/components/barra-estado";
import {
  EPS_BARRA,
  RESPUESTA_PASTILLA,
  UMBRAL_ARRASTRE_PX,
  agregarMuestra,
  crearResorte,
  ejeDe,
  inicioTiron,
  pastillaAlSoltar,
  pastillaArrastre,
  reglaRueda,
  reglaScroll,
  reglaTiron,
  velocidad,
  type MemoriaRueda,
  type MemoriaScroll,
  type Muestra,
  type Resorte,
} from "@/lib/barra";
import { AREAS, indiceDeArea, type IconoArea as Icono } from "@/lib/navegacion";

/**
 * Navegación de las áreas (SAYA-R2-2): la barra de vidrio de ABAJO, sólo con
 * iconos, con el orbe del agente a su derecha, y la píldora de atrás `.pback`
 * arriba. Tres estados (oculta, recogida, llena) que mueve `barra-estado.ts` con
 * resortes; aquí sólo se pinta, se registra el elemento y se leen los gestos.
 * Las pestañas se ven en las rutas `area`; en las `empujada` la barra está oculta
 * y se ve la píldora; en `sesion` el shell no monta nada.
 *
 * La activa se marca con la pastilla `.bind` (vidrio blanco) y NUNCA con el
 * acento cromo (DECISIONES.md §10).
 */

const TRAZOS: Record<Icono, ReactNode> = {
  hoy: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
    </>
  ),
  cuerpo: <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
  dinero: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10.5h18M15.5 15h2.5" />
    </>
  ),
  tiempo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
};

function IconoArea({ icono }: { icono: Icono }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[icono]}
    </svg>
  );
}

interface Arrastre {
  x0: number;
  y0: number;
  muestras: Muestra[];
  eje: "x" | "y" | null;
  base: number;
  ancho: number;
}

export function NavBar({
  pathname,
  nivel,
  etiqueta,
  alAtras,
}: {
  pathname: string;
  nivel: "area" | "empujada";
  /** La etiqueta del DESTINO de la píldora. */
  etiqueta: string;
  alAtras: () => void;
}) {
  const router = useRouter();
  const idx = indiceDeArea(pathname);
  const n = AREAS.length;

  // La pastilla se queda en la última área vista mientras la barra está oculta.
  const [ultimo, setUltimo] = useState(idx ?? 0);
  if (idx !== null && idx !== ultimo) setUltimo(idx);
  const activo = idx ?? ultimo;

  const navRef = useRef<HTMLElement>(null);
  const bbarRef = useRef<HTMLDivElement>(null);
  const bindRef = useRef<HTMLSpanElement>(null);
  const pastilla = useRef<Resorte | null>(null);
  const inicial = useRef(true);
  const arrastre = useRef<Arrastre | null>(null);
  const suprimir = useRef(false);
  const anterior = useRef<{ pathname: string; nivel: string } | null>(null);

  // Registrar la barra y crear el resorte de la pastilla.
  useEffect(() => {
    const nav = navRef.current;
    const baja = nav ? registrarBarra(nav) : undefined;
    pastilla.current = crearResorte(
      (x) => {
        const b = bindRef.current;
        if (b) b.style.transform = "translate3d(" + (x * 100).toFixed(2) + "%,0,0)";
      },
      { respuesta: RESPUESTA_PASTILLA, eps: EPS_BARRA, reducido: movimientoReducido },
    );
    inicial.current = true;
    return () => {
      pastilla.current?.parar();
      pastilla.current = null;
      baja?.();
    };
  }, []);

  // La pastilla: al montar se pone; después se desliza.
  useEffect(() => {
    const p = pastilla.current;
    if (!p) return;
    if (inicial.current) {
      inicial.current = false;
      p.poner(activo);
    } else {
      p.ir(activo);
    }
  }, [activo]);

  // El estado de la barra con la ruta.
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = { pathname, nivel };
    if (nivel === "empujada") {
      ponerBarra("oculta", { ahora: true });
      return;
    }
    if (antes && antes.nivel === "area") {
      // De un área a otra: de llena queda recogida; si no, se queda.
      if (antes.pathname !== pathname && leerBarra() === "llena") ponerBarra("recogida");
      return;
    }
    ponerBarra("oculta", { ahora: true });
  }, [pathname, nivel]);

  // Los gestos del scroll, sólo en las áreas.
  useEffect(() => {
    if (nivel !== "area") return;
    const enHoy = pathname === "/";
    const ignorar = (e: Event) =>
      leerBarra() === "llena" ||
      conduciendo() ||
      (e.target instanceof Element && e.target.closest('[role="dialog"]') !== null);

    let memScroll: MemoriaScroll = { y0: window.scrollY, acc: 0 };
    let memRueda: MemoriaRueda = { wa: 0, tUlt: 0 };
    let ty0: number | null = null;

    const alScroll = (e: Event) => {
      if (ignorar(e)) return;
      const r = reglaScroll(memScroll, {
        y: window.scrollY,
        max: document.documentElement.scrollHeight - window.innerHeight,
        ahora: performance.now(),
        ultimoCambio: ultimoCambioBarra(),
        estado: leerBarra(),
      });
      memScroll = r.memoria;
      if (r.poner) ponerBarra(r.poner);
    };
    const alRueda = (e: WheelEvent) => {
      if (ignorar(e)) return;
      const r = reglaRueda(memRueda, {
        deltaY: e.deltaY,
        scrollTop: window.scrollY,
        ahora: performance.now(),
        ultimoCambio: ultimoCambioBarra(),
        estado: leerBarra(),
      });
      memRueda = r.memoria;
      if (r.poner) ponerBarra(r.poner);
    };
    const alTocar = (e: TouchEvent) => {
      if (ignorar(e)) return;
      ty0 = e.touches.length === 1 ? inicioTiron(window.scrollY, e.touches[0].clientY) : null;
    };
    const alMover = (e: TouchEvent) => {
      if (ignorar(e) || e.touches.length !== 1) return;
      const poner = reglaTiron(ty0, e.touches[0].clientY, leerBarra());
      if (poner) {
        ty0 = null;
        ponerBarra(poner);
      }
    };

    window.addEventListener("scroll", alScroll, { passive: true });
    if (!enHoy) {
      window.addEventListener("wheel", alRueda, { passive: true });
      window.addEventListener("touchstart", alTocar, { passive: true });
      window.addEventListener("touchmove", alMover, { passive: true });
    }
    return () => {
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("wheel", alRueda);
      window.removeEventListener("touchstart", alTocar);
      window.removeEventListener("touchmove", alMover);
    };
  }, [nivel, pathname]);

  function tocar(i: number) {
    if (i === activo) {
      if (leerBarra() !== "llena") {
        window.scrollTo({ top: 0, behavior: movimientoReducido() ? "auto" : "smooth" });
      }
      return;
    }
    pastilla.current?.ir(i);
    router.push(AREAS[i].href);
  }

  function alTeclado(e: KeyboardEvent<HTMLDivElement>) {
    const paso = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (paso === 0) return;
    e.preventDefault();
    const i = Math.min(n - 1, Math.max(0, activo + paso));
    if (i === activo) return;
    const pestanas = bbarRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    pestanas?.[i]?.focus();
    tocar(i);
  }

  function alBajar(e: PointerEvent<HTMLDivElement>) {
    suprimir.current = false;
    arrastre.current = {
      x0: e.clientX,
      y0: e.clientY,
      muestras: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
      eje: null,
      base: 0,
      ancho: 1,
    };
  }

  function alMoverPuntero(e: PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    const p = pastilla.current;
    if (!a || !p || a.eje === "y") return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (a.eje === null) {
      const eje = ejeDe(dx, dy, UMBRAL_ARRASTRE_PX);
      if (eje === null) return;
      a.eje = eje;
      if (eje === "y") return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* el puntero ya no existe */
      }
      a.base = p.x;
      a.ancho = Math.max(1, (e.currentTarget.clientWidth - 8) / n);
      p.parar();
    }
    a.muestras = agregarMuestra(a.muestras, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    p.poner(pastillaArrastre(a.base, dx, a.ancho, n));
  }

  function soltar(e: PointerEvent<HTMLDivElement>, cancelado: boolean) {
    const a = arrastre.current;
    arrastre.current = null;
    const p = pastilla.current;
    if (!a || !p || a.eje !== "x") return;
    suprimir.current = true;
    const vx = cancelado ? 0 : velocidad(a.muestras, e.timeStamp).vx;
    const i = pastillaAlSoltar(p.x, vx, a.ancho, n);
    p.ir(i, { v: vx / a.ancho, amortiguacion: Math.abs(vx / a.ancho) > 2 ? 0.86 : 1 });
    if (i !== activo) router.push(AREAS[i].href);
  }

  function anularClic(e: MouseEvent<HTMLDivElement>) {
    if (!suprimir.current) return;
    suprimir.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <>
      <nav ref={navRef} aria-label="Navegación principal" className="navg">
        <div
          ref={bbarRef}
          className="bbar"
          role="tablist"
          aria-label="Áreas"
          style={{ "--n": n } as CSSProperties}
          onKeyDown={alTeclado}
          onPointerDown={alBajar}
          onPointerMove={alMoverPuntero}
          onPointerUp={(e) => soltar(e, false)}
          onPointerCancel={(e) => soltar(e, true)}
          onClickCapture={anularClic}
        >
          <span ref={bindRef} className="bind" aria-hidden="true" />
          {AREAS.map((a, i) => (
            <button
              key={a.href}
              type="button"
              role="tab"
              className="bt"
              aria-label={a.etiqueta}
              aria-selected={i === activo}
              tabIndex={i === activo ? 0 : -1}
              onClick={() => tocar(i)}
            >
              <IconoArea icono={a.icono} />
            </button>
          ))}
        </div>
        <Orbe />
      </nav>
      <button
        type="button"
        className="pback"
        data-oculto={nivel === "empujada" ? undefined : ""}
        aria-label={`Volver a ${etiqueta}`}
        onClick={alAtras}
      >
        <b aria-hidden="true">‹</b>
        {etiqueta}
      </button>
    </>
  );
}
