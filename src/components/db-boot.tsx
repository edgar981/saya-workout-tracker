"use client";

import { useEffect } from "react";
import { seedIfEmpty } from "@/lib/db/seed";

/**
 * Siembra el catálogo la primera vez. Vive en un useEffect a propósito: es el
 * único lugar donde se garantiza que no corre en el servidor, y Dexie no existe
 * fuera del navegador.
 */
export function DbBoot() {
  useEffect(() => {
    seedIfEmpty().catch((err) => {
      console.error("[saya] el seed falló:", err);
    });
  }, []);

  return null;
}
