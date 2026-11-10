import { esCorreoPermitido } from "@/lib/auth/correo-permitido";

/**
 * La regla de acceso al respaldo durante la transición (DECISIONES.md §14, «La
 * transición del token»): se entra con la sesión del login o con el token.
 * Módulo puro: sin `server-only`, sin Better Auth y sin `process.env`, para
 * probarlo sin servidor.
 *
 * - `correoSesion`: el correo de la sesión, o nada si no hay sesión.
 * - `correoPermitido`: el valor de AUTH_ALLOWED_EMAIL, o nada si falta.
 * - `tokenValido`: si el token del encabezado coincide con BACKUP_TOKEN.
 */
export function accesoPermitido(
  correoSesion: string | null | undefined,
  correoPermitido: string | null | undefined,
  tokenValido: boolean,
): boolean {
  if (tokenValido) return true;
  if (!correoSesion) return false;
  return esCorreoPermitido(correoSesion, correoPermitido);
}
