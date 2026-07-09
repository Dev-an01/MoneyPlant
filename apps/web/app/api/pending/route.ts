import { and, asc, eq } from "drizzle-orm";
import { db, transactions, currentUserId, unauthorized, dbReady, reconcilePending, pendingToDTO } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/pending — entries still inside the 5-minute grace window.
// Reconciles first so expired ones auto-commit and drop off the list.
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();
  await reconcilePending(userId);

  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.status, "pending")))
    .orderBy(asc(transactions.pendingUntil));

  return Response.json({ pending: rows.map(pendingToDTO) });
}
