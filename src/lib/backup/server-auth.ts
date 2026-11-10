import "server-only";
import { accesoPermitido } from "./acceso";

/**
 * Auth del endpoint de respaldo (DECISIONES.md §14). El respaldo se usa sólo
 * con la sesión del login, la del único correo permitido; ya no hay token.
 */

export type Acceso = {
  ok: boolean;
  /** Set-Cookie que produjo leer la sesión (renovación), para copiarlos a la respuesta. */
  setCookies: string[];
};

/**
 * Decide el acceso de las rutas del respaldo sólo con la sesión, que se lee
 * siempre para que se renueve (§14). Cualquier error al leerla (variables
 * ausentes, base inalcanzable) cuenta como «sin sesión»: es un 401 y nunca un
 * 500. Nada de lo leído se escribe en la consola.
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
  const ok = accesoPermitido(correoSesion, process.env.AUTH_ALLOWED_EMAIL);
  return { ok, setCookies };
}

/** Copia a la respuesta los Set-Cookie de la renovación. Sin ellos, no cambia nada. */
export function conCookies(res: Response, acceso: Acceso): Response {
  for (const c of acceso.setCookies) res.headers.append("set-cookie", c);
  return res;
}
