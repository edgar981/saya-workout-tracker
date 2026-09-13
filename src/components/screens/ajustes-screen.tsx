"use client";

import Link from "next/link";
import { BookOpen, CalendarRange, ChevronLeft, ChevronRight, Database, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Configuración (§2). Reemplaza el disclosure que vivía en el pie del home: los
 * destinos de cada varias semanas (Mesociclos · Plantillas · Catálogo · Respaldo)
 * ahora son una pantalla propia, alcanzable desde la barra de navegación.
 *
 * Sin datos ni Dexie: es lista estática de enlaces, así que la ruta se
 * prerenderiza y abre al instante — no necesita `dynamic(ssr:false)` ni
 * esqueleto. El chevron de volver se conserva (la barra no lo sustituye).
 */
const DESTINOS = [
  { href: "/mesociclos", label: "Mesociclos", Icon: CalendarRange },
  { href: "/plantillas", label: "Plantillas", Icon: ListChecks },
  { href: "/catalogo", label: "Catálogo", Icon: BookOpen },
  { href: "/datos", label: "Respaldo", Icon: Database },
];

export default function AjustesScreen() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Ajustes</h1>
      </header>

      <div className="flex flex-col gap-2">
        {DESTINOS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="border-border bg-surface text-muted-foreground flex items-center gap-3 rounded-xl border px-4 py-3.5 text-sm font-medium"
          >
            <Icon className="size-4 shrink-0" />
            <span className="text-foreground flex-1">{label}</span>
            <ChevronRight className="size-4 shrink-0" />
          </Link>
        ))}
      </div>
    </main>
  );
}
