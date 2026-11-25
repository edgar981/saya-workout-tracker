/**
 * Reglas de navegación de Cromo líquido, PURAS: sin React ni `window`, para
 * probarlas en entorno `node`. El shell y la barra sólo las consumen.
 *
 * La navegación de las áreas es la barra de abajo, sólo con iconos. Las demás
 * pantallas se «empujan» y llevan la píldora «‹ Área»; en una sesión no hay
 * navegación.
 */

export type IconoArea = "hoy" | "cuerpo" | "dinero" | "tiempo";

export interface Area {
  href: string;
  etiqueta: string;
  icono: IconoArea;
}

/** Las áreas que existen, en el orden de la barra. */
export const AREAS: readonly Area[] = [
  { href: "/", etiqueta: "Hoy", icono: "hoy" },
  { href: "/cuerpo", etiqueta: "Cuerpo", icono: "cuerpo" },
  { href: "/dinero", etiqueta: "Dinero", icono: "dinero" },
  { href: "/tiempo", etiqueta: "Tiempo", icono: "tiempo" },
];

export type Nivel = "area" | "sesion" | "empujada";
export type Como = "push" | "pop" | "reset";
export type Modo = "replace" | "back" | "push";

/** `usePathname` entrega la ruta sin query; se acepta también la barra final. */
export function normalizarRuta(ruta: string): string {
  if (ruta.length > 1 && ruta.endsWith("/")) return ruta.replace(/\/+$/, "") || "/";
  return ruta;
}

/** Índice de la pestaña de una ruta de área, o null si no es la raíz de un área. */
export function indiceDeArea(ruta: string): number | null {
  const r = normalizarRuta(ruta);
  const i = AREAS.findIndex((a) => a.href === r);
  return i === -1 ? null : i;
}

export function nivelDeRuta(ruta: string): Nivel {
  const r = normalizarRuta(ruta);
  if (r === "/sesion" || r === "/sesion/cerrar") return "sesion";
  if (indiceDeArea(r) !== null) return "area";
  return "empujada";
}

const ETIQUETAS_FIJAS: Record<string, string> = {
  "/": "Hoy",
  "/cuerpo": "Cuerpo",
  "/dinero": "Dinero",
  "/tiempo": "Tiempo",
  "/historial": "Historial",
  "/progreso": "Progreso",
  "/ajustes": "Ajustes",
  "/mesociclos": "Mesociclos",
  "/plantillas": "Plantillas",
  "/catalogo": "Catálogo",
  "/catalogo/nuevo": "Ejercicio nuevo",
  "/datos": "Datos",
  "/sesion": "Sesión",
};

/** La etiqueta que la píldora muestra cuando ESTA ruta es el destino. */
export function etiquetaDeRuta(ruta: string): string {
  const r = normalizarRuta(ruta);
  const fija = ETIQUETAS_FIJAS[r];
  if (fija) return fija;
  if (/^\/historial\/[^/]+$/.test(r)) return "Sesión";
  if (/^\/ejercicio\/[^/]+$/.test(r)) return "Ejercicio";
  // La maqueta pone el nombre del día; leerlo es una consulta que el shell no hace.
  if (/^\/plantillas\/[^/]+$/.test(r)) return "Día";
  return "Hoy";
}

/** Padre fijo (FIX): la pantalla siempre sube a este padre. */
function padreFijo(r: string): string | null {
  if (r === "/historial" || r === "/progreso") return "/cuerpo";
  if (/^\/plantillas\/[^/]+$/.test(r)) return "/plantillas";
  if (r === "/catalogo/nuevo") return "/catalogo";
  return null;
}

/** Destino en frío (FALL): sin entrada anterior en la pila. */
function destinoEnFrio(r: string): string {
  if (/^\/historial\/[^/]+$/.test(r) || /^\/ejercicio\/[^/]+$/.test(r)) return "/historial";
  if (r === "/ajustes") return "/";
  if (r === "/mesociclos" || r === "/plantillas" || r === "/catalogo" || r === "/datos") {
    return "/ajustes";
  }
  return "/";
}

export interface AccionAtras {
  destino: string;
  etiqueta: string;
  modo: Modo;
  /** La pila se vacía al llegar: queda sólo el destino. */
  vaciar: boolean;
}

/**
 * Qué hace «‹» en `ruta` (con su `busqueda`, p. ej. «?desde=cierre») dada la
 * `pila` de rutas visitadas (la última es la ruta actual). El primer caso que
 * aplica gana: cierre → padre fijo → historia real → frío.
 */
export function accionAtras(ruta: string, busqueda: string, pila: readonly string[]): AccionAtras {
  const r = normalizarRuta(ruta);
  const anterior = pila.length >= 2 ? normalizarRuta(pila[pila.length - 2]) : null;

  // 1. Detalle abierto desde el cierre: la entrada de atrás es /sesion, ya cerrada.
  if (/^\/historial\/[^/]+$/.test(r) && new URLSearchParams(busqueda).get("desde") === "cierre") {
    return { destino: "/", etiqueta: etiquetaDeRuta("/"), modo: "replace", vaciar: true };
  }

  // 2. Padre fijo.
  const padre = padreFijo(r);
  if (padre !== null) {
    return {
      destino: padre,
      etiqueta: etiquetaDeRuta(padre),
      modo: anterior === padre ? "back" : "push",
      vaciar: true,
    };
  }

  // 3. La historia real.
  if (anterior !== null) {
    return { destino: anterior, etiqueta: etiquetaDeRuta(anterior), modo: "back", vaciar: false };
  }

  // 4. En frío.
  const destino = destinoEnFrio(r);
  return { destino, etiqueta: etiquetaDeRuta(destino), modo: "push", vaciar: true };
}

/**
 * La pila de rutas del shell. Llegar a la raíz de un área la deja en `[ruta]`
 * (tocar una pestaña limpia la historia); `pop` quita la última si la penúltima
 * es la ruta y si no queda `[ruta]`; `reset` deja `[ruta]`; `push` agrega salvo
 * que la última ya sea esa ruta.
 */
export function siguientePila(pila: readonly string[], ruta: string, como: Como): string[] {
  const r = normalizarRuta(ruta);
  if (indiceDeArea(r) !== null || como === "reset") return [r];
  if (como === "pop") {
    return pila.length >= 2 && normalizarRuta(pila[pila.length - 2]) === r
      ? pila.slice(0, -1)
      : [r];
  }
  return pila.length > 0 && normalizarRuta(pila[pila.length - 1]) === r ? [...pila] : [...pila, r];
}
