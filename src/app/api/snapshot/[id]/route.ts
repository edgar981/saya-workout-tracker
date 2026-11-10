import { prisma } from "@/lib/prisma";
import { comprobarAcceso, conCookies } from "@/lib/backup/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga el payload completo de un snapshot — el `{ manifest, data }` tal cual
 * se empujó. Es lo único que consume el flujo de restauración, que lo mete por
 * el mismo import que un archivo.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const acceso = await comprobarAcceso(req);
  if (!acceso.ok) {
    return conCookies(
      Response.json({ error: "Sin sesión." }, { status: 401 }),
      acceso,
    );
  }

  const { id } = await params;
  const row = await prisma.snapshot.findUnique({
    where: { id },
    select: { payload: true },
  });

  if (!row) {
    return conCookies(
      Response.json({ error: "Snapshot no encontrado." }, { status: 404 }),
      acceso,
    );
  }
  return conCookies(Response.json(row.payload), acceso);
}
