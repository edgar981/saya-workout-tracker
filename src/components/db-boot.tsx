"use client";

import { useEffect } from "react";
import { applyCatalogCorrections, seedIfEmpty } from "@/lib/db/seed";

/**
 * Siembra el catálogo la primera vez y aplica las correcciones puntuales sobre un
 * catálogo ya sembrado. Vive en un useEffect a propósito: es el único lugar donde
 * se garantiza que no corre en el servidor, y Dexie no existe fuera del navegador.
 */
export function DbBoot() {
  useEffect(() => {
    void (async () => {
      await seedIfEmpty();
      // Después del seed (o de no hacerlo, si ya había datos): en una instalación
      // fresca el catálogo ya nace corregido y esto es no-op; en una existente,
      // arregla el registro viejo. Idempotente (ver applyCatalogCorrections).
      await applyCatalogCorrections();
    })().catch((err) => {
      console.error("[saya] el arranque de la base falló:", err);
    });
  }, []);

  return null;
}
