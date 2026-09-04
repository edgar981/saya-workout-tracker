import { prisma } from "@/lib/prisma";
import { validateSnapshotBody, type SnapshotMeta } from "@/lib/backup/protocol";
import { tokenFromRequest, tokenOk } from "@/lib/backup/server-auth";

// Prisma necesita Node (no edge). Y estas rutas leen/escriben la base: nunca se
// prerenderizan ni se cachean.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorized = () =>
  Response.json({ error: "Token inválido o ausente." }, { status: 401 });

/**
 * Recibe un volcado completo y lo guarda como una fila nueva (append-only).
 * Valida antes de tocar la base; si algo no cuadra, 4xx sin escribir.
 */
export async function POST(req: Request): Promise<Response> {
  if (!tokenOk(tokenFromRequest(req))) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "El cuerpo no es JSON válido." }, { status: 400 });
  }

  const parsed = validateSnapshotBody(raw);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const snap = await prisma.snapshot.create({
    data: {
      schema_version: parsed.schema_version,
      counts: parsed.counts,
      payload: parsed.body as object,
    },
    select: { id: true, creado_en: true, schema_version: true, counts: true },
  });

  const meta: SnapshotMeta = {
    id: snap.id,
    creado_en: snap.creado_en.toISOString(),
    schema_version: snap.schema_version,
    counts: snap.counts as Record<string, number>,
  };
  return Response.json(meta, { status: 201 });
}

/** Lista los snapshots recientes (metadata, sin payload) para la restauración. */
export async function GET(req: Request): Promise<Response> {
  if (!tokenOk(tokenFromRequest(req))) return unauthorized();

  const rows = await prisma.snapshot.findMany({
    orderBy: { creado_en: "desc" },
    take: 50,
    select: { id: true, creado_en: true, schema_version: true, counts: true },
  });

  const snapshots: SnapshotMeta[] = rows.map((r) => ({
    id: r.id,
    creado_en: r.creado_en.toISOString(),
    schema_version: r.schema_version,
    counts: r.counts as Record<string, number>,
  }));
  return Response.json({ snapshots });
}
