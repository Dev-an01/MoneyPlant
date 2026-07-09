import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { rupeesToPaise } from "@moneyplant/shared";
import { db, transactions, currentUserId, unauthorized, dbReady, txnToDTO } from "@/lib/server";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  category: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  type: z.enum(["expense", "investment"]).optional(),
});

// PATCH /api/transactions/:id — inline edit (category / note / amount / type).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.category !== undefined) patch.category = parsed.data.category;
  if (parsed.data.note !== undefined) patch.note = parsed.data.note;
  if (parsed.data.type !== undefined) patch.type = parsed.data.type;
  if (parsed.data.amount !== undefined) patch.amountPaise = rupeesToPaise(parsed.data.amount);

  const [row] = await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.id, params.id), eq(transactions.userId, userId)))
    .returning();

  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ transaction: txnToDTO(row) });
}

// DELETE /api/transactions/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const [row] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, params.id), eq(transactions.userId, userId)))
    .returning();

  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
