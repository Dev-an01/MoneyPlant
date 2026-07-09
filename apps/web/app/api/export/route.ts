import { and, desc, eq } from "drizzle-orm";
import { db, transactions, currentUserId, unauthorized, dbReady, reconcilePending } from "@/lib/server";

export const dynamic = "force-dynamic";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/export — full transaction history as CSV (Privacy & Trust page, PRD §6.9).
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();
  await reconcilePending(userId);

  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.status, "committed")))
    .orderBy(desc(transactions.txnTime));

  const header = ["Date", "Type", "Category", "Note", "Amount (INR)"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.txnTime.toISOString().slice(0, 10)),
        csvCell(r.type),
        csvCell(r.category),
        csvCell(r.note ?? ""),
        csvCell((r.amountPaise / 100).toFixed(2)),
      ].join(","),
    );
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="moneyplant-export.csv"`,
    },
  });
}
