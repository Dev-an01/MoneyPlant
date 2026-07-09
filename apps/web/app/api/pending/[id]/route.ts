import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, transactions, currentUserId, unauthorized, dbReady, txnToDTO } from "@/lib/server";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["commit", "cancel"]) });

// POST /api/pending/:id  { action: "commit" | "cancel" }
// The state-machine transition (PRD §9): commit early, or cancel within the window.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });

  const now = new Date();
  const set =
    parsed.data.action === "commit"
      ? { status: "committed" as const, committedAt: now, pendingUntil: null, updatedAt: now }
      : { status: "cancelled" as const, pendingUntil: null, updatedAt: now };

  // Only a still-pending row can transition — guards against double-commit.
  const [row] = await db
    .update(transactions)
    .set(set)
    .where(
      and(
        eq(transactions.id, params.id),
        eq(transactions.userId, userId),
        eq(transactions.status, "pending"),
      ),
    )
    .returning();

  if (!row) return Response.json({ error: "not found or already resolved" }, { status: 404 });
  return Response.json({ transaction: txnToDTO(row) });
}
