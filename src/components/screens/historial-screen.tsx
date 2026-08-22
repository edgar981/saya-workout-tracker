"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listSessionSummaries } from "@/lib/db/queries";

function formatFecha(iso: string): string {
  // Partido a mano: new Date('2026-08-14') se parsea como UTC y muestra el día
  // anterior en América.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function HistorialScreen() {
  const summaries = useLiveQuery(() => listSessionSummaries(), []);

  if (summaries === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Cargando…</p>;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Historial</h1>
        <span className="text-muted-foreground ml-auto text-xs">{summaries.length} sesiones</span>
      </header>

      {summaries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Todavía no hay sesiones registradas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {summaries.map(({ session, routineDay, ejerciciosConSeries, totalSeries, tags, tieneNota }) => (
            <Link
              key={session.id}
              href={`/historial/${session.id}`}
              className="hover:bg-accent flex flex-col gap-1.5 rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatFecha(session.fecha)}</span>
                <span className="text-muted-foreground text-xs">
                  {routineDay?.nombre ?? "Sesión libre"}
                </span>
                {session.activa === 1 && (
                  <Badge variant="default" className="text-[10px]">
                    en curso
                  </Badge>
                )}
                <ChevronRight className="text-muted-foreground ml-auto size-4" />
              </div>

              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="tabular-nums">
                  {ejerciciosConSeries} ejercicios · {totalSeries} series
                </span>
                {tieneNota && <MessageSquare className="size-3.5" />}
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="text-[10px]">
                      {tag.nombre}
                    </Badge>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
