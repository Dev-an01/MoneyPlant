import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { rupeesToPaise } from "@moneyplant/shared";
import { db, holdings, currentUserId, unauthorized, dbReady, holdingToDTO } from "@/lib/server";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  ticker: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  invested: z.number().nonnegative().optional(),
  current: z.number().nonnegative().optional(),
  units: z.number().nullable().optional(),
});

// PATCH /api/holdings/:id
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const d = parsed.data;
  if (d.name !== undefined) patch.name = d.name;
  if (d.ticker !== undefined) patch.ticker = d.ticker;
  if (d.type !== undefined) patch.type = d.type;
  if (d.units !== undefined) patch.units = d.units;
  if (d.invested !== undefined) patch.investedPaise = rupeesToPaise(d.invested);
  if (d.current !== undefined) {
    patch.currentPaise = rupeesToPaise(d.current);
    patch.lastValuedAt = new Date();
  }

  const [row] = await db
    .update(holdings)
    .set(patch)
    .where(and(eq(holdings.id, params.id), eq(holdings.userId, userId)))
    .returning();

  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ holding: holdingToDTO(row) });
}

// DELETE /api/holdings/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const [row] = await db
    .delete(holdings)
    .where(and(eq(holdings.id, params.id), eq(holdings.userId, userId)))
    .returning();

  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
