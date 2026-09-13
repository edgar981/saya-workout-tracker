"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronDown, ChevronLeft, Copy, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activateMesociclo,
  createEmptyMesociclo,
  duplicateMesociclo,
  listMesociclos,
  renameMesociclo,
  updateMesocicloIniciadoEn,
  type MesocicloView,
} from "@/lib/db/queries";
import { useAutosave } from "@/lib/use-autosave";
import { useVolver } from "@/lib/use-volver";
import { cn } from "@/lib/utils";
import { MesociclosSkeleton } from "@/components/skeletons";

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function rango(m: MesocicloView["mesociclo"]): string {
  if (!m.iniciado_en) return "sin fecha de inicio";
  if (m.terminado_en) return `${fechaCorta(m.iniciado_en)} – ${fechaCorta(m.terminado_en)}`;
  return `desde ${fechaCorta(m.iniciado_en)}`;
}

export default function MesociclosScreen() {
  // Alcanzable desde /ajustes; el chevron sigue el historial real. Ver use-volver.
  const volver = useVolver("/ajustes");
  const mesociclos = useLiveQuery(() => listMesociclos(), []);

  if (mesociclos === undefined) {
    return <MesociclosSkeleton />;
  }

  const activo = mesociclos.find((v) => v.mesociclo.activo === 1)?.mesociclo ?? null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button variant="ghost" size="icon-sm" onClick={volver} aria-label="Volver">
          <ChevronLeft />
        </Button>
        <h1 className="text-lg font-semibold">Mesociclos</h1>
      </header>

      <p className="text-muted-foreground text-sm">
        El plan vigente es el mesociclo activo. Cambiar de plan es activar otro, no editar el actual
        en sitio: la composición del viejo queda intacta para el histórico.
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={!activo}
          onClick={() => activo && void duplicateMesociclo(activo.id, `${activo.nombre} copia`)}
        >
          <Copy /> Duplicar el actual
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => void createEmptyMesociclo(`Mesociclo ${mesociclos.length + 1}`)}
        >
          <Plus /> Crear vacío
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {mesociclos.map((view) => (
          <FilaMesociclo key={view.mesociclo.id} view={view} />
        ))}
      </div>
    </main>
  );
}

function FilaMesociclo({ view }: { view: MesocicloView }) {
  const { mesociclo, dias } = view;
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(mesociclo.nombre);
  const { schedule, flush } = useAutosave();
  const activo = mesociclo.activo === 1;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{mesociclo.nombre}</span>
            {activo && (
              <Badge variant="default" className="text-[10px]">
                activo
              </Badge>
            )}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {rango(mesociclo)} · {dias} {dias === 1 ? "día" : "días"}
          </span>
        </span>
        <ChevronDown className={cn("text-muted-foreground size-4", abierto && "rotate-180")} />
      </button>

      {abierto && (
        <div className="flex flex-col gap-3 border-t p-3">
          {!activo && (
            <Button size="sm" onClick={() => void activateMesociclo(mesociclo.id)}>
              <Check /> Activar este mesociclo
            </Button>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`nombre-${mesociclo.id}`}>Nombre</Label>
            <Input
              id={`nombre-${mesociclo.id}`}
              value={nombre}
              onChange={(e) => {
                const val = e.target.value;
                setNombre(val);
                schedule(() => {
                  const limpio = val.trim();
                  if (limpio !== "") void renameMesociclo(mesociclo.id, limpio);
                });
              }}
              onBlur={flush}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`inicio-${mesociclo.id}`}>Fecha de inicio</Label>
            <Input
              id={`inicio-${mesociclo.id}`}
              type="date"
              value={mesociclo.iniciado_en ?? ""}
              onChange={(e) =>
                void updateMesocicloIniciadoEn(mesociclo.id, e.target.value === "" ? null : e.target.value)
              }
            />
            <span className="text-muted-foreground text-xs">
              Desde esta fecha se cuenta la semana del mesociclo en el home. Sin fecha, no se muestra
              número de semana.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
