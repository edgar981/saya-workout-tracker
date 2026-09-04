"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExercise } from "@/lib/db/queries";
import type { AddedUnit, Laterality, UnitType, WeightBasis } from "@/lib/db/types";
import { UNIDADES, usaAddedUnit, usaBasis, usaStackLabel } from "@/lib/catalogo-units";

/**
 * Crear ejercicio. Antes reemplazaba la lista con `useState`; ahora es una ruta
 * propia (/catalogo/nuevo), así que el gesto atrás vuelve al catálogo sin perder
 * lo ya guardado (el borrador del formulario no está guardado; la lista sí sigue
 * intacta). Al crear, se navega de vuelta al catálogo.
 */
export default function CatalogoNuevoScreen() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("LB");
  const [basis, setBasis] = useState<WeightBasis>("TOTAL");
  const [addedUnit, setAddedUnit] = useState<AddedUnit>("KG");
  const [stackLabel, setStackLabel] = useState("disc");
  const [lateralidad, setLateralidad] = useState<Laterality>("BILATERAL");

  const crear = async () => {
    if (nombre.trim() === "") return;
    await createExercise({
      nombre: nombre.trim(),
      unit_type: unitType,
      weight_basis: usaBasis(unitType) ? basis : null,
      added_unit: usaAddedUnit(unitType) ? addedUnit : null,
      stack_label: usaStackLabel(unitType) ? stackLabel.trim() || "disc" : null,
      laterality_default: lateralidad,
    });
    router.push("/catalogo");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/catalogo" aria-label="Volver">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Ejercicio nuevo</h1>
      </header>

      <Input
        id="nuevo-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre"
        aria-label="Nombre"
      />

      <div className="flex flex-col gap-1.5">
        <Label>Unidad</Label>
        <div className="flex flex-wrap gap-1.5">
          {UNIDADES.map((u) => (
            <Button
              key={u.valor}
              variant={unitType === u.valor ? "default" : "outline"}
              size="sm"
              onClick={() => setUnitType(u.valor)}
            >
              {u.etiqueta}
            </Button>
          ))}
        </div>
      </div>

      {usaBasis(unitType) && (
        <div className="flex flex-col gap-1.5">
          <Label>Base del peso</Label>
          <div className="flex gap-1.5">
            <Button
              variant={basis === "TOTAL" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setBasis("TOTAL")}
            >
              Total
            </Button>
            <Button
              variant={basis === "PER_IMPLEMENT" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setBasis("PER_IMPLEMENT")}
            >
              Por mancuerna
            </Button>
          </div>
        </div>
      )}

      {usaAddedUnit(unitType) && (
        <div className="flex flex-col gap-1.5">
          <Label>Unidad del peso añadido</Label>
          <div className="flex gap-1.5">
            {(["KG", "LB"] as const).map((u) => (
              <Button
                key={u}
                variant={addedUnit === u ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAddedUnit(u)}
              >
                {u.toLowerCase()}
              </Button>
            ))}
          </div>
        </div>
      )}

      {usaStackLabel(unitType) && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nuevo-stack">Etiqueta del stack</Label>
          <Input
            id="nuevo-stack"
            value={stackLabel}
            onChange={(e) => setStackLabel(e.target.value)}
            placeholder="disc"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Lateralidad</Label>
        <div className="flex gap-1.5">
          <Button
            variant={lateralidad === "BILATERAL" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setLateralidad("BILATERAL")}
          >
            Bilateral
          </Button>
          <Button
            variant={lateralidad === "UNILATERAL" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setLateralidad("UNILATERAL")}
          >
            Unilateral
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        La unidad queda fija en cuanto registres la primera serie: se snapshotea en cada SetLog y
        cambiarla después partiría el histórico.
      </p>

      <Button onClick={() => void crear()} disabled={nombre.trim() === ""}>
        Crear
      </Button>
    </main>
  );
}
