"use client";

import { useState } from "react";

/**
 * Bandera de "navegación en curso tras una escritura propia en Dexie".
 *
 * El patrón que resuelve: una acción escribe en Dexie (cerrar sesión, descartar,
 * empezar sesión, eliminar) y acto seguido navega con `router.replace`/`push`.
 * Pero la escritura dispara PRIMERO un re-render reactivo (`useLiveQuery`) con el
 * estado ya cambiado —la sesión activa desaparece, el detalle deja de existir—, y
 * el replace aterriza un tick después. En ese hueco la pantalla pintaría un vacío
 * falso: "sin sesión activa", "esta sesión no existe", o la tarjeta que se
 * esfuma. La bandera cubre el hueco: mientras está en alto, el render muestra el
 * estado de carga (o esconde la tarjeta) en vez del vacío.
 *
 * Es ESTADO, no un ref: se lee en el render (React prohíbe leer refs ahí) y, al
 * reponerla, re-renderiza sola. `marcar()` va ANTES de escribir+navegar.
 * `reponer()` va SOLO en el error, donde la navegación no ocurrió y la pantalla
 * sigue montada (dejarla en alto escondería el contenido legítimo). En el camino
 * feliz NO se repone: debe seguir en alto a través del replace, porque la
 * navegación tarda más que el re-render reactivo y resetearla reintroduciría el
 * parpadeo. Ver FLUJOS.md §2.3.
 */
export function useNavegando(): {
  navegando: boolean;
  marcar: () => void;
  reponer: () => void;
} {
  const [navegando, setNavegando] = useState(false);
  return {
    navegando,
    marcar: () => setNavegando(true),
    reponer: () => setNavegando(false),
  };
}
