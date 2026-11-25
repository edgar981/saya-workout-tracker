import { comprobarAcceso, conCookies } from "@/lib/backup/server-auth";
import { leerTiempo } from "@/lib/tiempo/servidor";

import { almacenTiempo } from "./almacen";

// Lee la sesión y la base: nunca se prerenderiza ni se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Los temas, los registros desde `?desde=AAAA-MM-DD` y el primer registro. Sólo el owner. */
export async function GET(req: Request): Promise<Response> {
  const acceso = await comprobarAcceso(req);
  if (!acceso.ok) {
    return conCookies(Response.json({ error: "Sin sesión." }, { status: 401 }), acceso);
  }

  const desde = new URL(req.url).searchParams.get("desde");
  const { status, cuerpo } = await leerTiempo(desde, almacenTiempo);
  return conCookies(Response.json(cuerpo, { status }), acceso);
}
