"use client";

import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";

/**
 * Ajustes (§2). Los destinos de cada varias semanas (Mesociclos · Plantillas ·
 * Catálogo · Datos) son una pantalla propia, alcanzable desde la barra de
 * navegación.
 *
 * Sin datos ni Dexie: es lista estática de enlaces, así que la ruta se
 * prerenderiza y abre al instante — no necesita `dynamic(ssr:false)` ni
 * esqueleto. Sin cuentas en los subtítulos ni chip de respaldo: consultarían
 * Dexie y cambiarían eso (pendiente del owner).
 */
const DESTINOS: { href: string; titulo: string; subtitulo?: string }[] = [
  { href: "/mesociclos", titulo: "Mesociclos" },
  { href: "/plantillas", titulo: "Plantillas" },
  { href: "/catalogo", titulo: "Catálogo" },
  { href: "/datos", titulo: "Datos", subtitulo: "Respaldo, archivo e integridad" },
];

export default function AjustesScreen() {
  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Ajustes" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
            {DESTINOS.map(({ href, titulo, subtitulo }) => (
              <Fila key={href} href={href} titulo={titulo} subtitulo={subtitulo} chevron />
            ))}
          </div>
        </main>
      </Hoja>
    </>
  );
}
