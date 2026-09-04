import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Auth del endpoint de respaldo. Sin auth de usuario, el token en variable de
 * entorno es lo único que separa un push legítimo de una escritura casual de
 * un tercero. No es seguridad fuerte —el cliente lleva el token embebido en el
 * bundle— pero es proporcional para datos de gimnasio de una persona
 * (DECISIONES.md §9).
 */

/**
 * Comparación de tiempo constante. `timingSafeEqual` exige buffers de igual
 * largo, así que se comparan los SHA-256 (siempre 32 bytes): así ni el largo
 * del token filtra por el tiempo de respuesta.
 */
export function tokenOk(provided: string | null | undefined): boolean {
  const expected = process.env.BACKUP_TOKEN;
  if (!expected) return false; // sin token configurado, nadie escribe
  if (!provided) return false;

  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Lee el token del header estándar de esta app. */
export function tokenFromRequest(req: Request): string | null {
  return req.headers.get("x-backup-token");
}
