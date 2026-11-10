/**
 * Texto para Edgar a partir del error de una llamada del cliente de Better Auth
 * (DECISIONES.md §14). Puro: sin Better Auth en tiempo de ejecución.
 *
 * Formas medidas en better-auth 1.7.18:
 *  - Las llamadas del cliente devuelven `{ data, error }` y NO lanzan por una
 *    respuesta de error; `error` es `{ ...cuerpo, status, statusText }`
 *    (@better-fetch/fetch/dist/index.js:586-592). Los errores de la API traen
 *    `code` (BASE_ERROR_CODES). Sin red, `fetch` rechaza y la llamada LANZA un
 *    TypeError (index.js:514, sin captura); la lectura de sesión lo guarda en
 *    `error` (client/session-atom.mjs:115-122).
 *  - El límite de intentos responde 429 con `{ message }` y sin `code`
 *    (api/rate-limiter/index.mjs:65).
 *  - El hook de registro lanza `APIError("FORBIDDEN", { message })` sin `code`:
 *    llega como status 403 sin código (src/lib/auth/servidor.ts:59).
 *  - Un passkey cancelado: entrar devuelve message «Auth cancelled» con el
 *    `code` del WebAuthnError o `AUTH_CANCELLED` (passkey/dist/client.mjs:26-35);
 *    agregar devuelve `ERROR_CEREMONY_ABORTED` (client.mjs:126) o, si el
 *    diálogo del sistema se cierra, `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`
 *    (@simplewebauthn/browser identifyRegistrationError.js:59-67).
 */

/** Mínimo por defecto de Better Auth (better-auth/dist/context/create-context.mjs:186). */
export const MINIMO_CONTRASENA = 8;

const CODIGOS_PASSKEY_CANCELADO = new Set([
  "AUTH_CANCELLED",
  "REGISTRATION_CANCELLED",
  "ERROR_CEREMONY_ABORTED",
  "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
]);

interface ErrorLlamada {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  name?: unknown;
}

function esSinRed(e: ErrorLlamada): boolean {
  // Chrome «Failed to fetch», Safari «Load failed», Firefox «NetworkError when…».
  return typeof e.message === "string" && /failed to fetch|load failed|network ?error/i.test(e.message);
}

export function textoDeError(error: unknown): string {
  const e: ErrorLlamada = typeof error === "object" && error !== null ? (error as ErrorLlamada) : {};
  const code = typeof e.code === "string" ? e.code : "";
  const status = typeof e.status === "number" ? e.status : 0;
  const message = typeof e.message === "string" ? e.message : "";

  if (code === "INVALID_EMAIL_OR_PASSWORD") return "Correo o contraseña incorrectos.";
  if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return "Esa cuenta ya existe: entra con la contraseña.";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return `La contraseña es muy corta: mínimo ${MINIMO_CONTRASENA} caracteres.`;
  }
  if (CODIGOS_PASSKEY_CANCELADO.has(code)) return "Se canceló el passkey.";
  if (status === 429) return "Demasiados intentos: espera unos segundos.";
  if (status === 403 && code === "") return "Ese correo no puede tener cuenta.";
  if (status === 0 && esSinRed(e)) return "Sin señal.";

  return message ? `No se pudo: ${message}` : "No se pudo.";
}
