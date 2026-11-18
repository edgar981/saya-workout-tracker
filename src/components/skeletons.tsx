import type { ReactNode } from "react";

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
function Sk({ className }: { className?: string }) {
  return <div className={cn("sk", className)} />;
}

/** El mismo contenedor que usan las pantallas reales, para que el ancho, el
 *  padding y el min-height coincidan exactos. */
function Screen({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col p-4", className)}>
      {children}
    </main>
  );
}

/** Cabecera con título. `title` fijo se pinta real (idéntico al final, sin salto);
 *  sin él, una barra para los títulos que dependen del dato. `chevron` deja el
 *  hueco del botón de volver: sólo lo conserva `/sesion/cerrar`, que sigue con el suyo
 *  (las demás lo perdieron: el «‹» ahora vive en la píldora del shell). */
function Head({
  title,
  trailing,
  chevron,
}: {
  title?: string;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <header className="flex items-center gap-2 pt-2">
      {chevron && <div className="size-9 shrink-0" />}
      {title ? (
        <h1 className="text-lg font-semibold">{title}</h1>
      ) : (
        <Sk className="h-6 w-40" />
      )}
      {trailing}
    </header>
  );
}

/** Cabecera de dos líneas (título + subtítulo derivados del dato). */
function HeadStacked() {
  return (
    <header className="flex items-center gap-2 pt-2">
      <div className="min-w-0">
        <Sk className="h-6 w-44" />
        <Sk className="mt-1.5 h-3 w-28" />
      </div>
    </header>
  );
}

/** Tarjeta con borde, igual que las tarjetas reales de las listas. */
function Card({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("rounded-lg border p-3", className)}>{children}</div>;
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
            <span className="sr-only">Cargando…</span>
            <div aria-hidden="true">
              {/* La tarjeta del anillo. */}
              <Sk className="h-[218px] w-full rounded-[24px]" />
              <Sk className="mt-[30px] h-[11px] w-[34%]" />
              <div className="mt-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="fila">
                    <Sk className="h-3 w-5" />
                    <div className="flex-1">
                      <Sk className="h-4 w-24" />
                    </div>
                    <Sk className="h-4 w-14" />
                  </div>
                ))}
              </div>
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
    <Screen className="gap-4">
      <Head title="Plantillas" />
      <div className="flex flex-col gap-1.5">
        <Sk className="h-3 w-full" />
        <Sk className="h-3 w-2/3" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border px-4 py-4">
            <Sk className="h-5 w-16" />
            <Sk className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── /plantillas/[dayId] ─────────────────────────────────────────────────────
export function PlantillaDiaSkeleton() {
  return (
    <Screen className="gap-3">
      <Head trailing={<Sk className="ml-auto h-4 w-16" />} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <Sk className="h-4 w-40" />
              <Sk className="mt-1.5 h-3 w-20" />
            </div>
            <Sk className="size-4" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── /catalogo ───────────────────────────────────────────────────────────────
export function CatalogoSkeleton() {
  return (
    <Screen className="gap-3">
      <Head title="Catálogo" trailing={<Sk className="ml-auto h-4 w-16" />} />
      <Sk className="h-10" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <Sk className="h-4 w-44" />
            <Sk className="mt-1.5 h-3 w-24" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── /catalogo/nuevo ─────────────────────────────────────────────────────────
export function CatalogoNuevoSkeleton() {
  return (
    <Screen className="gap-4">
      <Head title="Ejercicio nuevo" />
      <Sk className="h-11" />
      <div className="flex flex-col gap-1.5">
        <Sk className="h-4 w-16" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-9 w-16" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Sk className="h-4 w-20" />
        <div className="flex gap-1.5">
          <Sk className="h-9 w-24" />
          <Sk className="h-9 w-24" />
        </div>
      </div>
      <Sk className="mt-2 h-12" />
    </Screen>
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
    <Screen className="gap-4">
      <Head title="Respaldo" trailing={<Sk className="ml-auto h-4 w-28" />} />
      <div className="flex flex-col gap-1.5">
        <Sk className="h-3 w-full" />
        <Sk className="h-3 w-3/4" />
      </div>
      <div className="rounded-lg border">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b px-3 py-2 last:border-b-0"
          >
            <Sk className="h-3 w-28" />
            <Sk className="h-3 w-6" />
          </div>
        ))}
      </div>
      <Sk className="h-40 rounded-lg" />
      <Sk className="h-12" />
    </Screen>
  );
}

// ── /mesociclos ─────────────────────────────────────────────────────────────
export function MesociclosSkeleton() {
  return (
    <Screen className="gap-3">
      <Head title="Mesociclos" />
      <div className="flex flex-col gap-1.5">
        <Sk className="h-3 w-full" />
        <Sk className="h-3 w-2/3" />
      </div>
      <div className="flex gap-2">
        <Sk className="h-9 flex-1" />
        <Sk className="h-9 flex-1" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <Sk className="h-4 w-32" />
            <Sk className="mt-1.5 h-3 w-40" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── /ajustes ────────────────────────────────────────────────────────────────
export function AjustesSkeleton() {
  return (
    <Screen className="gap-3">
      <Head title="Ajustes" />
      <Sk className="h-4 w-64" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3.5">
            <Sk className="size-4 shrink-0" />
            <Sk className="h-4 w-24 flex-1" />
            <Sk className="size-4 shrink-0" />
          </div>
        ))}
      </div>
    </Screen>
  );
}
