import { prisma } from "@/lib/prisma";
import type { SnapshotMeta } from "@/lib/backup/protocol";
import { tokenFromRequest, tokenOk } from "@/lib/backup/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Metadata del último snapshot (fecha, schema_version, counts). Sin payload. */
export async function GET(req: Request): Promise<Response> {
  if (!tokenOk(tokenFromRequest(req))) {
    return Response.json({ error: "Token inválido o ausente." }, { status: 401 });
  }

  const row = await prisma.snapshot.findFirst({
    orderBy: { creado_en: "desc" },
    select: { id: true, creado_en: true, schema_version: true, counts: true },
  });

  const latest: SnapshotMeta | null = row
    ? {
        id: row.id,
        creado_en: row.creado_en.toISOString(),
        schema_version: row.schema_version,
        counts: row.counts as Record<string, number>,
      }
    : null;

  return Response.json({ latest });
}
