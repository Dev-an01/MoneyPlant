import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { rupeesToPaise } from "@moneyplant/shared";
import {
  db,
  transactions,
  currentUserId,
  unauthorized,
  dbReady,
  reconcilePending,
  txnToDTO,
} from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/transactions?type=all|expense|investment&q=search
// Returns the committed ledger, newest first.
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();
  await reconcilePending(userId);

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const q = url.searchParams.get("q")?.trim();

  const filters = [eq(transactions.userId, userId), eq(transactions.status, "committed")];
  if (type === "expense" || type === "investment") filters.push(eq(transactions.type, type));
  if (q) {
    const like = `%${q}%`;
    filters.push(or(ilike(transactions.note, like), ilike(transactions.category, like))!);
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.txnTime));

  return Response.json({ transactions: rows.map(txnToDTO) });
}

const createSchema = z.object({
  type: z.enum(["expense", "investment"]),
  category: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().optional(),
  txnTime: z.string().datetime().optional(),
});

// POST /api/transactions — manual add from the dashboard (commits immediately).
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });
  const { type, category, amount, note, txnTime } = parsed.data;

  const now = new Date();
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      type,
      category, // free-form allowed (AI-open taxonomy per PRD §16.5)
      amountPaise: rupeesToPaise(amount),
      note: note ?? null,
      status: "committed",
      stage: "manual",
      txnTime: txnTime ? new Date(txnTime) : now,
      committedAt: now,
    })
    .returning();

  return Response.json({ transaction: txnToDTO(row!) }, { status: 201 });
}
