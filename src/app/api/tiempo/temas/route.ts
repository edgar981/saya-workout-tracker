import { comprobarAcceso, conCookies } from "@/lib/backup/server-auth";
import { MAX_CUERPO_TIEMPO_BYTES, crearTema, origenPermitido } from "@/lib/tiempo/servidor";

import { almacenTiempo } from "../almacen";

// Lee la sesión y la base: nunca se prerenderiza ni se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anota un tema. Sesión, origen y tope del cuerpo, en ese orden, antes de tocar la base. */
export async function POST(req: Request): Promise<Response> {
  const acceso = await comprobarAcceso(req);
  if (!acceso.ok) {
    return conCookies(Response.json({ error: "Sin sesión." }, { status: 401 }), acceso);
  }

  if (!origenPermitido(req.headers.get("origin"), process.env.BETTER_AUTH_URL)) {
    return conCookies(Response.json({ error: "Origen no permitido." }, { status: 403 }), acceso);
  }

  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_CUERPO_TIEMPO_BYTES) {
    return conCookies(
      Response.json({ error: "El cuerpo es demasiado grande." }, { status: 413 }),
      acceso,
    );
  }

  const texto = await req.text();
  if (texto.length > MAX_CUERPO_TIEMPO_BYTES) {
    return conCookies(
      Response.json({ error: "El cuerpo es demasiado grande." }, { status: 413 }),
      acceso,
    );
  }

  const { status, cuerpo } = await crearTema(texto, almacenTiempo);
  return conCookies(Response.json(cuerpo, { status }), acceso);
}
