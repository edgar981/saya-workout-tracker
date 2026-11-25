import { comprobarAcceso, conCookies } from "@/lib/backup/server-auth";
import { exportarDinero } from "@/lib/dinero/servidor";

import { almacenDinero } from "../almacen";

// Lee la sesión y la base: nunca se prerenderiza ni se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Todas las filas de Dinero, con toda su historia (la copia de «Exportar»). Sólo el owner. */
export async function GET(req: Request): Promise<Response> {
  const acceso = await comprobarAcceso(req);
  if (!acceso.ok) {
    return conCookies(Response.json({ error: "Sin sesión." }, { status: 401 }), acceso);
  }

  const { status, cuerpo } = await exportarDinero(almacenDinero);
  return conCookies(Response.json(cuerpo, { status }), acceso);
}
