import { comprobarAcceso, conCookies } from "@/lib/backup/server-auth";
import { exportarTiempo } from "@/lib/tiempo/servidor";

import { almacenTiempo } from "../almacen";

// Lee la sesión y la base: nunca se prerenderiza ni se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Todas las filas de Tiempo (la copia de «Exportar»). Sólo el owner. */
export async function GET(req: Request): Promise<Response> {
  const acceso = await comprobarAcceso(req);
  if (!acceso.ok) {
    return conCookies(Response.json({ error: "Sin sesión." }, { status: 401 }), acceso);
  }

  const { status, cuerpo } = await exportarTiempo(almacenTiempo);
  return conCookies(Response.json(cuerpo, { status }), acceso);
}
