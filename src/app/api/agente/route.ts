import { comprobarAcceso, conCookies } from "@/lib/backup/server-auth";
import { MAX_CUERPO_BYTES } from "@/lib/agente/contrato";
import { atenderPedido } from "@/lib/agente/llamada";
import { modeloDe } from "@/lib/agente/modelo";
import { almacenDinero } from "@/app/api/dinero/almacen";
import { almacenTiempo } from "@/app/api/tiempo/almacen";

// Lee el entorno y la sesión: nunca se prerenderiza ni se cachea.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Pregúntale a tus datos». Sólo el owner (la sesión del login). Sin sesión no
 * se lee el cuerpo, no se mira la llave y no se llama al modelo.
 */
export async function POST(req: Request): Promise<Response> {
  const acceso = await comprobarAcceso(req);
  if (!acceso.ok) {
    return conCookies(Response.json({ error: "Sin sesión." }, { status: 401 }), acceso);
  }

  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_CUERPO_BYTES) {
    return conCookies(
      Response.json({ error: "El cuerpo es demasiado grande." }, { status: 413 }),
      acceso,
    );
  }

  const texto = await req.text();
  const { status, cuerpo } = await atenderPedido({
    clave: process.env.ANTHROPIC_API_KEY,
    modelo: modeloDe({ ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL }),
    texto,
    fetch,
    leer: async () => {
      const [dinero, tiempo] = await Promise.all([almacenDinero.todo(), almacenTiempo.todo()]);
      return { dinero, tiempo };
    },
  });
  return conCookies(Response.json(cuerpo, { status }), acceso);
}
