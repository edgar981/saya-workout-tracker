"use client";

import Link from "next/link";
import { History, House, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Barra de navegación persistente (§2). Tres destinos fijos. La sección activa
 * se marca con tinta plena; el resto queda atenuado — NO se usa el acento, que
 * está reservado a acción/sesión activa/completar y no debe competir aquí
 * (DECISIONES.md §10).
 *
 * La visibilidad la decide `AppShell` por ruta: esta barra NO aparece en
 * `/sesion` ni en `/sesion/cerrar` (ahí el alto vale más y no hay a dónde ir
 * durante el registro). Los chevrones de vuelta de cada pantalla se conservan:
 * la barra no los sustituye.
 */
function section(pathname: string): "inicio" | "historial" | "ajustes" {
  if (pathname === "/") return "inicio";
  // El historial de un ejercicio (/ejercicio/[id]) es historial, no ajustes.
  if (pathname.startsWith("/historial") || pathname.startsWith("/ejercicio")) return "historial";
  // /ajustes y los destinos de configuración que agrupa (mesociclos, plantillas,
  // catálogo, datos y sus subrutas).
  return "ajustes";
}

const ITEMS = [
  { key: "inicio", href: "/", label: "Inicio", Icon: House },
  { key: "historial", href: "/historial", label: "Historial", Icon: History },
  { key: "ajustes", href: "/ajustes", label: "Ajustes", Icon: Settings },
] as const;

export function NavBar({ pathname }: { pathname: string }) {
  const active = section(pathname);
  return (
    <nav
      aria-label="Navegación principal"
      className="border-border bg-bg/90 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex h-14 w-full max-w-md items-stretch">
        {ITEMS.map(({ key, href, label, Icon }) => {
          const on = active === key;
          return (
            <Link
              key={key}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px]",
                on ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
