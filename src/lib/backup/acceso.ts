import { esCorreoPermitido } from "@/lib/auth/correo-permitido";

/**
 * La regla de acceso al respaldo (DECISIONES.md §14): se entra sólo con la
 * sesión del login, y sólo si su correo es el permitido. Módulo puro: sin
 * `server-only`, sin Better Auth y sin `process.env`, para probarlo sin
 * servidor.
 *
 * - `correoSesion`: el correo de la sesión, o nada si no hay sesión.
 * - `correoPermitido`: el valor de AUTH_ALLOWED_EMAIL, o nada si falta.
 */
export function accesoPermitido(
  correoSesion: string | null | undefined,
  correoPermitido: string | null | undefined,
): boolean {
  if (!correoSesion) return false;
  return esCorreoPermitido(correoSesion, correoPermitido);
}
