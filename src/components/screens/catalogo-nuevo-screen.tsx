"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { GruposPicker } from "@/components/grupos-picker";
import { Button } from "@/components/ui/button";
import { Cabeza, Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pildora } from "@/components/ui/pildora";
import { createExercise } from "@/lib/db/queries";
import type { AddedUnit, Exercise, Laterality, UnitType, WeightBasis } from "@/lib/db/types";
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
  const [grupos, setGrupos] = useState<Exercise["grupos"]>({});

  const crear = async () => {
    if (nombre.trim() === "") return;
    await createExercise({
      nombre: nombre.trim(),
      unit_type: unitType,
      weight_basis: usaBasis(unitType) ? basis : null,
      added_unit: usaAddedUnit(unitType) ? addedUnit : null,
      stack_label: usaStackLabel(unitType) ? stackLabel.trim() || "disc" : null,
      laterality_default: lateralidad,
      grupos,
    });
    router.push("/catalogo");
  };

  return (
    <>
      <div className="px-4">
        <Cabeza titulo="Ejercicio nuevo" empujada />
      </div>
      <Hoja empujada>
        <main className="mx-auto w-full max-w-md p-4">
          <div>
            <Label htmlFor="nuevo-nombre" className="kicker mb-[9px]">
              Nombre
            </Label>
            <Input
              id="nuevo-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              aria-label="Nombre"
            />
          </div>

          <div className="mt-5">
            <Label className="kicker mb-[9px]">Unidad</Label>
            <div className="flex flex-wrap gap-1.5">
              {UNIDADES.map((u) => (
                <Pildora
                  key={u.valor}
                  presionada={unitType === u.valor}
                  onClick={() => setUnitType(u.valor)}
                >
                  {u.etiqueta}
                </Pildora>
              ))}
            </div>
            <p className="mt-2 text-[13px] leading-[18px] text-ink2">
              Se fija con la primera serie y queda en cada serie que registres.
            </p>
          </div>

          {usaBasis(unitType) && (
            <div className="mt-5">
              <Label className="kicker mb-[9px]">Base del peso</Label>
              <div className="flex gap-1.5">
                <Pildora
                  className="flex-1"
                  presionada={basis === "TOTAL"}
                  onClick={() => setBasis("TOTAL")}
                >
                  Total
                </Pildora>
                <Pildora
                  className="flex-1"
                  presionada={basis === "PER_IMPLEMENT"}
                  onClick={() => setBasis("PER_IMPLEMENT")}
                >
                  Por mancuerna
                </Pildora>
              </div>
            </div>
          )}

          {usaAddedUnit(unitType) && (
            <div className="mt-5">
              <Label className="kicker mb-[9px]">Unidad del peso añadido</Label>
              <div className="flex gap-1.5">
                {(["KG", "LB"] as const).map((u) => (
                  <Pildora
                    key={u}
                    className="flex-1"
                    presionada={addedUnit === u}
                    onClick={() => setAddedUnit(u)}
                  >
                    {u}
                  </Pildora>
                ))}
              </div>
            </div>
          )}

          {usaStackLabel(unitType) && (
            <div className="mt-5">
              <Label htmlFor="nuevo-stack" className="kicker mb-[9px]">
                Etiqueta del stack
              </Label>
              <Input
                id="nuevo-stack"
                value={stackLabel}
                onChange={(e) => setStackLabel(e.target.value)}
                placeholder="disc"
              />
            </div>
          )}

          <div className="mt-5">
            <Label className="kicker mb-[9px]">Lateralidad</Label>
            <div className="flex gap-1.5">
              <Pildora
                className="flex-1"
                presionada={lateralidad === "BILATERAL"}
                onClick={() => setLateralidad("BILATERAL")}
              >
                Bilateral
              </Pildora>
              <Pildora
                className="flex-1"
                presionada={lateralidad === "UNILATERAL"}
                onClick={() => setLateralidad("UNILATERAL")}
              >
                Unilateral
              </Pildora>
            </div>
          </div>

          <div className="mt-5">
            <Label className="kicker mb-[9px]">Grupos musculares</Label>
            <GruposPicker value={grupos} onChange={setGrupos} />
          </div>

          <Button
            className="mt-6 w-full"
            onClick={() => void crear()}
            disabled={nombre.trim() === ""}
          >
            Crear ejercicio
          </Button>
          {nombre.trim() === "" && (
            <p className="mt-2 text-[13px] leading-[18px] text-ink3">Falta el nombre.</p>
          )}
        </main>
      </Hoja>
    </>
  );
}
