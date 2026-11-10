/**
 * El error de las acciones de la cuenta (DECISIONES.md §14): una sola línea,
 * sea cual sea la razón. Puro: sin Better Auth en tiempo de ejecución.
 *
 * Forma medida en better-auth 1.7.18: sin red, `fetch` rechaza y la llamada
 * LANZA un TypeError sin status (@better-fetch/fetch/dist/index.js:514); la
 * lectura de sesión lo guarda en `error` (client/session-atom.mjs:115-122).
 */

export const MENSAJE_NO_SE_PUDO = "No se pudo.";

/**
 * ¿Es un fetch caído? Un error sin status cuyo mensaje es el de Chrome
 * «Failed to fetch», Safari «Load failed» o Firefox «NetworkError when…».
 * Un TypeError con otro mensaje no cuenta.
 */
export function esSinRed(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { message?: unknown; status?: unknown };
  const status = typeof e.status === "number" ? e.status : 0;
  return status === 0 && typeof e.message === "string" && /failed to fetch|load failed|network ?error/i.test(e.message);
}
