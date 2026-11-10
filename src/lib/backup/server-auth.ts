import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { accesoPermitido } from "./acceso";

/**
 * Auth del endpoint de respaldo. Durante la transición del login (DECISIONES.md
 * §14, «La transición del token») se entra con la sesión del login (la del
 * único correo permitido) o con el token de BACKUP_TOKEN. El token no es
 * seguridad fuerte —el cliente lo lleva embebido en el bundle— pero es
 * proporcional para datos de gimnasio de una persona (§9); la sesión es la
 * credencial real y el token sale cuando el teléfono tenga el cliente nuevo.
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

export type Acceso = {
  ok: boolean;
  /** Set-Cookie que produjo leer la sesión (renovación), para copiarlos a la respuesta. */
  setCookies: string[];
};

/**
 * Decide el acceso de las rutas del respaldo. La sesión se lee SIEMPRE, también
 * con token válido, para que se renueve (§14). Cualquier error al leerla
 * (variables ausentes, base inalcanzable) cuenta como «sin sesión»: la decisión
 * sigue con el token y la sesión nunca produce un 500. Nada de lo leído se
 * escribe en la consola.
 */
export async function comprobarAcceso(req: Request): Promise<Acceso> {
  let correoSesion: string | null = null;
  let setCookies: string[] = [];
  try {
    const { getAuth } = await import("@/lib/auth/servidor");
    const { headers, response } = await getAuth().api.getSession({
      headers: req.headers,
      returnHeaders: true,
    });
    correoSesion = response?.user?.email ?? null;
    setCookies = headers.getSetCookie();
  } catch {
    correoSesion = null;
    setCookies = [];
  }
  const ok = accesoPermitido(
    correoSesion,
    process.env.AUTH_ALLOWED_EMAIL,
    tokenOk(tokenFromRequest(req)),
  );
  return { ok, setCookies };
}

/** Copia a la respuesta los Set-Cookie de la renovación. Sin ellos, no cambia nada. */
export function conCookies(res: Response, acceso: Acceso): Response {
  for (const c of acceso.setCookies) res.headers.append("set-cookie", c);
  return res;
}
