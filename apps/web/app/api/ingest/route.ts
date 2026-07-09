import { z } from "zod";
import { ingestMessage, defaultProvider } from "@moneyplant/core";
import { rupeesToPaise, GRACE_WINDOW_SEC } from "@moneyplant/shared";
import { db, transactions, currentUserId, unauthorized, dbReady, pendingToDTO } from "@/lib/server";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().min(1).max(500) });

// POST /api/ingest — the tracker entry point. Parses a free-text line
// ("dinner 1240", "40k mutual fund") into a pending transaction that enters the
// 5-minute grace window. Same pipeline the Telegram bot uses.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });

  const result = await ingestMessage(parsed.data.text, defaultProvider());
  if (result.amount === null) {
    return Response.json(
      { error: "no amount found", hint: "Include an amount, e.g. “coffee 180” or “40k mutual fund”." },
      { status: 422 },
    );
  }

  const now = new Date();
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      type: result.type,
      category: result.category,
      amountPaise: rupeesToPaise(result.amount),
      note: result.note,
      rawMessage: parsed.data.text.trim(),
      status: "pending",
      stage: result.stage,
      aiConfidence: result.confidence,
      txnTime: now,
      pendingUntil: new Date(now.getTime() + GRACE_WINDOW_SEC * 1000),
    })
    .returning();

  return Response.json({ pending: pendingToDTO(row!) }, { status: 201 });
}
