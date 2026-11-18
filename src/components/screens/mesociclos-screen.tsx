"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fila } from "@/components/ui/fila";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contar, rangoMesociclo } from "@/lib/ajustes-resumen";
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
import { MesociclosSkeleton } from "@/components/skeletons";

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function MesociclosScreen() {
  const mesociclos = useLiveQuery(() => listMesociclos(), []);

  if (mesociclos === undefined) {
    return <MesociclosSkeleton />;
  }

  const activo = mesociclos.find((v) => v.mesociclo.activo === 1)?.mesociclo ?? null;

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Mesociclos" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div className="mt-2 rounded-[20px] bg-white/[.035] px-4 py-0.5 shadow-[inset_0_0_0_1px_var(--color-hair)]">
            {mesociclos.map((view) => (
              <FilaMesociclo key={view.mesociclo.id} view={view} />
            ))}
          </div>

          <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              disabled={!activo}
              onClick={() => activo && void duplicateMesociclo(activo.id, `${activo.nombre} copia`)}
            >
              Duplicar el actual
            </Button>
            <Button
              variant="secondary"
              onClick={() => void createEmptyMesociclo(`Mesociclo ${mesociclos.length + 1}`)}
            >
              Crear vacío
            </Button>
          </div>

          <p className="mt-3 text-[13px] leading-[18px] text-ink3">
            Solo uno está activo. Las sesiones guardan el día del mesociclo en que se hicieron.
          </p>
        </main>
      </Hoja>
    </>
  );
}

function FilaMesociclo({ view }: { view: MesocicloView }) {
  const { mesociclo, dias } = view;
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(mesociclo.nombre);
  const { schedule, flush } = useAutosave();
  const activo = mesociclo.activo === 1;

  return (
    <div>
      <Fila
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        titulo={
          <span className="flex items-center gap-2">
            <span className="truncate">{mesociclo.nombre}</span>
            {activo && <Badge className="text-ink">activo</Badge>}
          </span>
        }
        subtitulo={`${rangoMesociclo(mesociclo.iniciado_en, mesociclo.terminado_en, fechaCorta)} · ${contar(dias, "día", "días")}`}
      />

      {abierto && (
        <div className="pb-4">
          {!activo && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void activateMesociclo(mesociclo.id)}
            >
              Activar este mesociclo
            </Button>
          )}

          <div className="mt-5">
            <Label htmlFor={`nombre-${mesociclo.id}`} className="kicker mb-[9px]">
              Nombre
            </Label>
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

          <div className="mt-5">
            <Label htmlFor={`inicio-${mesociclo.id}`} className="kicker mb-[9px]">
              Fecha de inicio
            </Label>
            <Input
              id={`inicio-${mesociclo.id}`}
              type="date"
              value={mesociclo.iniciado_en ?? ""}
              onChange={(e) =>
                void updateMesocicloIniciadoEn(mesociclo.id, e.target.value === "" ? null : e.target.value)
              }
            />
            <p className="mt-2 text-[13px] leading-[18px] text-ink2">
              Desde esta fecha se cuenta la semana del mesociclo en el home. Sin fecha, no se muestra
              número de semana.
            </p>
          </div>

          {activo && (
            <Link href="/plantillas" className="tl mt-5 inline-flex min-h-11 items-center">
              Editar plantillas ›
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
