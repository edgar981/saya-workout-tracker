"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronLeft, Flag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db/db";
import { closeSession, discardSession, getActiveSession } from "@/lib/db/queries";
import { backupNow } from "@/lib/backup/client";
import { cn } from "@/lib/utils";

/** Ventana en la que el botón de descarte queda armado. */
const ARMED_MS = 5000;

export default function CloseScreen() {
  const router = useRouter();
  const session = useLiveQuery(async () => (await getActiveSession()) ?? null, []);
  const tags = useLiveQuery(() => db.sessionTags.toArray(), []);

  const [openNote, setOpenNote] = useState(false);
  const [openTags, setOpenTags] = useState(false);
  const [openWeight, setOpenWeight] = useState(false);

  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<"KG" | "LB">("KG");
  const [armed, setArmed] = useState(false);
  const [saving, setSaving] = useState(false);
  // Al cerrar/descartar navegamos nosotros; el efecto de abajo no debe rebotar
  // al home cuando la sesión activa desaparece por nuestra propia acción.
  const navegando = useRef(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (session === null && !navegando.current) router.replace("/");
  }, [session, router]);

  if (session === undefined) {
    return <p className="text-muted-foreground p-6 text-sm">Cargando…</p>;
  }
  if (session === null) {
    return <p className="text-muted-foreground p-6 text-sm">Sin sesión activa.</p>;
  }

  const parsedWeight = (() => {
    const cleaned = weight.replace(",", ".").replace(/[^\d.]/g, "");
    if (cleaned === "") return null;
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  })();

  const close = async () => {
    setSaving(true);
    navegando.current = true;
    await closeSession(session.id, {
      nota: note.trim() === "" ? null : note.trim(),
      tagIds: selected,
      // Sin esto, "+25kg" en dominadas no tiene denominador y la progresión en
      // BODYWEIGHT_PLUS es no interpretable (DECISIONES.md §3.4).
      bodyweight: parsedWeight === null ? null : { valor: parsedWeight, unidad: weightUnit },
    });
    window.localStorage.removeItem(`saya:ejercicio:${session.id}`);
    // Respaldo a Postgres: dispara y olvida, ya con `cerrada_en` escrito. NO se
    // espera (no bloquea el cierre ni la navegación) y no lanza: si falla —sin
    // señal, servidor caído— queda "pendiente" y se reintenta al abrir la app.
    void backupNow();
    // Al cerrar, ir al detalle de ESTA sesión: es donde vive el veredicto y
    // evita dejar al usuario sin salida. El descarte sí va al home (no hay
    // sesión que mostrar).
    router.replace(`/historial/${session.id}`);
  };

  const discard = async () => {
    navegando.current = true;
    await discardSession(session.id);
    window.localStorage.removeItem(`saya:ejercicio:${session.id}`);
    router.replace("/");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/sesion" aria-label="Volver a la sesión">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Cerrar sesión</h1>
      </header>

      <p className="text-muted-foreground text-sm">Todo esto es opcional.</p>

      <Section
        label="Nota"
        open={openNote}
        onToggle={() => setOpenNote((v) => !v)}
        hint={note.trim() === "" ? null : "escrita"}
      >
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Qué pasó hoy que no se ve en los números."
        />
      </Section>

      <Section
        label="Contexto"
        open={openTags}
        onToggle={() => setOpenTags((v) => !v)}
        hint={selected.length === 0 ? null : `${selected.length}`}
      >
        <div className="flex flex-wrap gap-1.5">
          {(tags ?? []).map((tag) => {
            const on = selected.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id],
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  on ? "bg-primary text-primary-foreground border-transparent" : "text-foreground",
                )}
              >
                {tag.nombre}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        label="Peso corporal"
        open={openWeight}
        onToggle={() => setOpenWeight((v) => !v)}
        hint={parsedWeight === null ? null : `${parsedWeight} ${weightUnit.toLowerCase()}`}
      >
        <div className="flex gap-2">
          <Input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
            placeholder="—"
            aria-label="Peso corporal"
            className="flex-1"
          />
          {(["KG", "LB"] as const).map((unit) => (
            <Button
              key={unit}
              variant={weightUnit === unit ? "default" : "outline"}
              onClick={() => setWeightUnit(unit)}
              className="w-16"
            >
              {unit.toLowerCase()}
            </Button>
          ))}
        </div>
      </Section>

      <Button size="lg" className="mt-2" disabled={saving} onClick={() => void close()}>
        <Flag /> Cerrar sesión
      </Button>

      {/* Borrado duro permitido (D8), pero los diálogos nativos del navegador
          están prohibidos: la guarda es que el botón hay que tocarlo dos veces
          dentro de una ventana de 5 s. */}
      <Button
        variant={armed ? "destructive" : "ghost"}
        size="sm"
        className={armed ? "" : "text-muted-foreground"}
        onClick={() => (armed ? void discard() : setArmed(true))}
      >
        <Trash2 />
        {armed ? "Tocar de nuevo para descartar" : "Descartar sesión"}
      </Button>
    </main>
  );
}

function Section({
  label,
  hint,
  open,
  onToggle,
  children,
}: {
  label: string;
  hint: string | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
      >
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
        <ChevronDown className={cn("ml-auto size-4", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
