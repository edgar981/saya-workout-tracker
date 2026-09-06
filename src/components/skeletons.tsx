import type { ReactNode } from "react";

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
 * Sin animación todavía (§3.6): son placeholders estáticos, no un shimmer.
 */

/** Bloque de relleno. `bg-surface-2` se lee como placeholder sobre el fondo. */
function Sk({ className }: { className?: string }) {
  return <div className={cn("bg-surface-2 rounded-md", className)} />;
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

/** Cabecera con chevron de volver (hueco transparente, como el botón ghost real)
 *  y título. `title` fijo se pinta real (idéntico al final, sin salto); sin él,
 *  una barra para los títulos que dependen del dato. */
function Head({ title, trailing }: { title?: string; trailing?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 pt-2">
      <div className="size-9 shrink-0" />
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
      <div className="size-9 shrink-0" />
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
    <Screen className="gap-5">
      <header className="pt-5">
        <Sk className="h-3 w-48" />
      </header>
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn("flex items-center gap-3 px-2 py-4", i > 0 && "border-border border-t")}
          >
            <Sk className="h-3 w-4" />
            <div className="flex-1">
              <Sk className="h-4 w-24" />
              <Sk className="mt-1.5 h-3 w-16" />
            </div>
            <Sk className="h-4 w-12" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

// ── /sesion ───────────────────────────────────────────────────────────────
export function SessionSkeleton() {
  return (
    <Screen>
      <header className="flex items-center gap-2.5 pt-2 pb-3">
        <Sk className="h-9 w-20 rounded-full" />
        <div className="flex-1" />
        <Sk className="h-4 w-16" />
      </header>
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-hidden px-4 pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-[46px] w-24 shrink-0" />
        ))}
      </div>
      <div className="bg-border mb-4 h-px w-full" />
      <div className="flex flex-col gap-3">
        <Sk className="h-7 w-44" />
        <Sk className="h-16 rounded-xl" />
        <Sk className="h-28 rounded-xl" />
        <div className="flex gap-2">
          <Sk className="h-11 flex-1" />
          <Sk className="h-11 w-24" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2 pb-2">
        <Sk className="size-10" />
        <Sk className="size-10" />
        <Sk className="ml-auto h-10 w-32" />
      </div>
    </Screen>
  );
}

// ── /historial ──────────────────────────────────────────────────────────────
export function HistorialSkeleton() {
  return (
    <Screen className="gap-3">
      <Head title="Historial" trailing={<Sk className="ml-auto h-4 w-16" />} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-1.5">
            <Sk className="h-4 w-40" />
            <Sk className="h-3 w-32" />
          </Card>
        ))}
      </div>
    </Screen>
  );
}

// ── /historial/[id] ─────────────────────────────────────────────────────────
export function SessionDetailSkeleton() {
  return (
    <Screen className="gap-4">
      <HeadStacked />
      <Card className="flex flex-col gap-2">
        <Sk className="h-4 w-48" />
      </Card>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-2">
          <Sk className="h-4 w-32" />
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-2/3" />
        </Card>
      ))}
    </Screen>
  );
}

// ── /ejercicio/[id] ─────────────────────────────────────────────────────────
export function EjercicioSkeleton() {
  return (
    <Screen className="gap-4">
      <HeadStacked />
      <Sk className="h-3 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-2">
            <Sk className="h-4 w-32" />
            <Sk className="h-3 w-full" />
          </Card>
        ))}
      </div>
    </Screen>
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
    <Screen className="gap-4">
      <Head title="Cerrar sesión" />
      <Sk className="h-4 w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border px-3 py-3">
          <Sk className="h-4 w-24" />
        </div>
      ))}
      <Sk className="mt-2 h-12" />
      <Sk className="h-8 w-40" />
    </Screen>
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
        {Array.from({ length: 8 }).map((_, i) => (
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
