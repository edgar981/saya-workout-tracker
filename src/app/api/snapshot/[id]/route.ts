import { prisma } from "@/lib/prisma";
import { tokenFromRequest, tokenOk } from "@/lib/backup/server-auth";

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
  if (!tokenOk(tokenFromRequest(req))) {
    return Response.json({ error: "Token inválido o ausente." }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.snapshot.findUnique({
    where: { id },
    select: { payload: true },
  });

  if (!row) return Response.json({ error: "Snapshot no encontrado." }, { status: 404 });
  return Response.json(row.payload);
}
