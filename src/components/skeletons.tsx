import type { CSSProperties } from "react";

import { Cabeza, Hoja } from "@/components/ui/hoja";
import { cn } from "@/lib/utils";

/*
 * Esqueletos por pantalla (§3.6 del diagnóstico de transiciones).
 *
 * Cada navegación encadena varias etapas casi-vacías —loading del `dynamic`,
 * hidratación, carga del chunk, `useLiveQuery === undefined`— y antes cada una
 * pintaba fondo con un `<p>` de texto suelto. Estos esqueletos reproducen el
 * layout final de su pantalla (cabecera real, contornos de tarjeta, misma
 * altura) para que ninguna etapa muestre vacío y el dato al llegar no salte.
 *
 * Viven en su propio módulo, NO en el de cada screen: los `page.tsx` los usan
 * como `loading` del `dynamic`, y meterlos en el screen anularía el code-split
 * (el page importaría el screen entero). El mismo esqueleto se reusa en la rama
 * `=== undefined` del screen, así que loading → datos es continuo.
 *
 * Cromo líquido: el bloque `Sk` lleva un barrido de 1.6 s (`.sk` en globals.css,
 * solo anima `transform`; sin barrido bajo `prefers-reduced-motion`). La forma de
 * cada esqueleto por pantalla es la de antes; cada slice de pantalla rehace la suya.
 */

/** Bloque de relleno en forma de píldora, con barrido. */
function Sk({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("sk", className)} style={style} />;
}

// ── / (home) ────────────────────────────────────────────────────────────────
export function HomeSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza
          titulo={<span className="sk inline-block h-[30px] w-[70%] align-middle" />}
          subtitulo={<span className="sk inline-block h-4 w-[45%]" />}
          ajustes
        />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando</span>
            <div className="bento" aria-hidden="true">
              {/* La tesela ancha y la del peso (la única área que existe). */}
              <Sk className="col-span-2 h-[206px] rounded-[24px]" />
              <Sk className="h-[132px] rounded-[24px]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /sesion ───────────────────────────────────────────────────────────────
export function SessionSkeleton() {
  return (
    <>
      <header className="stop">
        <Sk className="h-5 w-20" />
        <Sk className="h-5 w-24" />
        <Sk className="h-5 w-14 justify-self-end" />
      </header>
      <div
        className="hoja"
        data-propia=""
        style={{ "--ventana": "70px", "--hoja-pb": "0px", marginTop: 12 } as React.CSSProperties}
      >
        <main className="mx-auto flex w-full max-w-md flex-col px-4 pt-4">
          <div role="status" aria-busy="true" className="flex-1 pb-4">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <div className="chips">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Sk key={i} className="size-11 shrink-0" />
                ))}
              </div>
              <Sk className="mt-[18px] h-[11px] w-[40%]" />
              <Sk className="mt-3 h-7 w-[60%]" />
              {/* La pasada. */}
              <div className="pas">
                <Sk className="h-[11px] w-[45%]" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="prow">
                    <Sk className="h-3 w-5" />
                    <Sk className="h-4 w-28" />
                  </div>
                ))}
              </div>
              <div className="sets">
                <Sk className="h-[11px] w-10" />
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="set">
                    <Sk className="h-3 w-16" />
                    <div className="campos">
                      <Sk className="h-14 flex-1 rounded-2xl" />
                      <Sk className="h-14 flex-1 rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="sbot" aria-hidden="true">
            <Sk className="size-[50px] shrink-0" />
            <Sk className="size-[50px] shrink-0" />
            <Sk className="ml-auto h-12 w-36" />
          </div>
        </main>
      </div>
    </>
  );
}

// ── /cuerpo ─────────────────────────────────────────────────────────────────
/** Cabeza real (sin salto al llegar el dato) y una hoja con la forma de la
 *  pantalla: kicker, cifra, gráfica y cuatro líneas. */
export function CuerpoSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Cuerpo" subtitulo="Peso, sesiones y progreso" ajustes />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <Sk className="mt-4 h-[38px] w-[58%] rounded-[14px]" />
              <Sk className="mt-[22px] h-[132px] w-full rounded-3xl" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[72%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /tiempo ─────────────────────────────────────────────────────────────────
/** Cabeza real y una hoja con la forma de la pantalla: kicker, cifra, la línea de
 *  la típica, el botón y las filas de «Por tema». */
export function TiempoSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Tiempo" subtitulo="Aprender" ajustes />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <Sk className="mt-4 h-[38px] w-[58%] rounded-[14px]" />
              <Sk className="mt-[14px] h-4 w-[72%]" />
              <Sk className="mt-3 h-12 w-full" />
              <Sk className="mt-[30px] h-[11px] w-[22%]" />
              <Sk className="mt-[18px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /dinero ─────────────────────────────────────────────────────────────────
/** Cabeza real y una hoja con tres bloques: kicker, cifra de 38 px, tres filas y el
 *  botón; kicker y dos filas; kicker, cifra de 32 px y tres filas. */
export function DineroSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Dinero" ajustes />
      </div>
      <Hoja>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <Sk className="mt-4 h-[38px] w-[58%] rounded-[14px]" />
              <Sk className="mt-[18px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
              <Sk className="mt-3 h-12 w-full" />

              <Sk className="mt-[30px] h-[11px] w-[28%]" />
              <Sk className="mt-[18px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[86%]" />

              <Sk className="mt-[30px] h-[11px] w-[30%]" />
              <Sk className="mt-4 h-8 w-[52%] rounded-[14px]" />
              <Sk className="mt-[18px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

/** «Sale en» y «Lo que debes» mientras «Reintentar» vuelve a leer las deudas: la forma de las dos
 *  secciones dibujadas (kicker y tres filas de dos líneas; la segunda, además, la cifra y la fila
 *  de dos botones). Va dentro de la hoja de Dinero, en el lugar del bloque de error. */
export function DeudasSkeleton() {
  const filas = (
    <div className="mt-2">
      {["66%", "54%", "66%"].map((w, i) => (
        <div key={i} className="fila gap-3">
          <div className="min-w-0 flex-1">
            <Sk className="h-[14px]" style={{ width: w }} />
            <Sk className="mt-2 h-[11px] w-[36%]" />
          </div>
          <Sk className="h-[14px] w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true">
        <section className="sec mt-[30px]">
          <Sk className="h-[11px] w-[44%] rounded-[4px]" />
          {filas}
        </section>
        <section className="sec">
          <Sk className="h-[11px] w-[38%] rounded-[4px]" />
          <Sk className="mt-3 h-[34px] w-[52%] rounded-[10px]" />
          {filas}
          <div className="mt-3.5 flex gap-2.5">
            <Sk className="h-12 flex-1 rounded-3xl" />
            <Sk className="h-12 flex-1 rounded-3xl" />
          </div>
        </section>
      </div>
    </div>
  );
}

// ── /historial ──────────────────────────────────────────────────────────────
export function HistorialSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Historial" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <Sk className="mt-4 h-[38px] w-[58%] rounded-[14px]" />
              <Sk className="mt-[22px] h-[132px] w-full rounded-3xl" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[72%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /historial/[id] ─────────────────────────────────────────────────────────
export function SessionDetailSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Sesión" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <Sk className="mt-4 h-[38px] w-[58%] rounded-[14px]" />
              <Sk className="mt-[22px] h-[132px] w-full rounded-3xl" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[72%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /ejercicio/[id] ─────────────────────────────────────────────────────────
export function EjercicioSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Ejercicio" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <Sk className="mt-4 h-[38px] w-[58%] rounded-[14px]" />
              <Sk className="mt-[22px] h-[132px] w-full rounded-3xl" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[72%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /progreso ───────────────────────────────────────────────────────────────
export function ProgresoSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Progreso" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <Sk className="mt-4 h-[38px] w-[58%] rounded-[14px]" />
              <Sk className="mt-[22px] h-[132px] w-full rounded-3xl" />
              <Sk className="mt-[22px] h-4 w-[86%]" />
              <Sk className="mt-[22px] h-4 w-full" />
              <Sk className="mt-[22px] h-4 w-[72%]" />
              <Sk className="mt-[22px] h-4 w-[94%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /plantillas ─────────────────────────────────────────────────────────────
export function PlantillasSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Plantillas" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-4 w-full" />
              <Sk className="mt-2 h-4 w-2/3" />
              <div className="mt-2 rounded-[20px] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Sk key={i} className="my-0 h-[60px] w-full rounded-none" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /plantillas/[dayId] ─────────────────────────────────────────────────────
export function PlantillaDiaSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo={<Sk className="h-[34px] w-40" />} empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[34%]" />
              <div className="mt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Sk key={i} className="mt-2 h-[60px] w-full rounded-2xl" />
                ))}
              </div>
              <Sk className="mt-3 h-12 w-full" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /catalogo ───────────────────────────────────────────────────────────────
export function CatalogoSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Catálogo" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[52px] w-full rounded-2xl" />
              <Sk className="mt-3 h-12 w-full" />
              <div className="mt-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Sk key={i} className="mt-2 h-[60px] w-full rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /catalogo/nuevo ─────────────────────────────────────────────────────────
export function CatalogoNuevoSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Ejercicio nuevo" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-[11px] w-[24%]" />
              <Sk className="mt-[9px] h-[52px] w-full rounded-2xl" />
              <Sk className="mt-5 h-[11px] w-[20%]" />
              <div className="mt-[9px] flex flex-wrap gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Sk key={i} className="h-11 w-16 rounded-[22px]" />
                ))}
              </div>
              <Sk className="mt-5 h-[11px] w-[28%]" />
              <div className="mt-[9px] flex gap-1.5">
                <Sk className="h-11 flex-1 rounded-[22px]" />
                <Sk className="h-11 flex-1 rounded-[22px]" />
              </div>
              <Sk className="mt-6 h-12 w-full" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /sesion/cerrar ──────────────────────────────────────────────────────────
export function CloseSkeleton() {
  return (
    <>
      <header className="stop two">
        <span className="stop-back">
          <b aria-hidden="true">‹</b> Volver a la sesión
        </span>
      </header>
      <div
        className="hoja"
        data-propia=""
        style={{ "--ventana": "70px", "--hoja-pb": "0px", marginTop: 12 } as React.CSSProperties}
      >
        <main className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
          <h1 className="tit-2">Cerrar sesión</h1>
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <div className="dek mt-1.5">
                <Sk className="h-4 w-[80%]" />
              </div>
              <div className="dek">
                <Sk className="h-4 w-[40%]" />
              </div>
              <div className="fg">
                <Sk className="h-[11px] w-[20%]" />
                <Sk className="mt-2.5 h-[52px] w-full rounded-2xl" />
              </div>
              <div className="fg">
                <Sk className="h-[11px] w-[26%]" />
                <div className="pills mt-2.5">
                  <Sk className="h-11 w-24" />
                  <Sk className="h-11 w-20" />
                  <Sk className="h-11 w-28" />
                </div>
              </div>
              <div className="fg">
                <Sk className="h-[11px] w-[34%]" />
                <Sk className="mt-2.5 h-[68px] w-full rounded-[20px]" />
              </div>
              <Sk className="mt-6 h-14 w-full" />
              <Sk className="mt-3 h-4 w-32" />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// ── /datos ──────────────────────────────────────────────────────────────────
export function DataSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Respaldo" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <Sk className="h-4 w-full" />
              <Sk className="mt-2 h-4 w-3/4" />
              <div className="mt-2.5 rounded-2xl shadow-[inset_0_0_0_1px_var(--color-hair)]">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex min-h-9 items-center justify-between border-t border-hair px-3.5 first:border-t-0"
                  >
                    <Sk className="h-3 w-28" />
                    <Sk className="h-3 w-6" />
                  </div>
                ))}
              </div>
              <Sk className="mt-[30px] h-[11px] w-[20%]" />
              <Sk className="mt-3 h-24 w-full rounded-[20px]" />
              <Sk className="mt-[30px] h-[11px] w-[34%]" />
              <Sk className="mt-3 h-12 w-full" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /mesociclos ─────────────────────────────────────────────────────────────
export function MesociclosSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Mesociclos" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <div className="mt-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Sk key={i} className="mt-2 h-[60px] w-full rounded-2xl" />
                ))}
              </div>
              <div className="mt-[18px] flex gap-2.5">
                <Sk className="h-12 w-40" />
                <Sk className="h-12 w-32" />
              </div>
              <Sk className="mt-3 h-4 w-[86%]" />
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}

// ── /ajustes ────────────────────────────────────────────────────────────────
export function AjustesSkeleton() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Ajustes" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div role="status" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              <div className="mt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Sk key={i} className="mt-2 h-[60px] w-full rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </Hoja>
    </>
  );
}
