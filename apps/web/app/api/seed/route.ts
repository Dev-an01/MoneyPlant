import { eq } from "drizzle-orm";
import { rupeesToPaise } from "@moneyplant/shared";
import { db, transactions, holdings, currentUserId, unauthorized, dbReady } from "@/lib/server";

export const dynamic = "force-dynamic";

// POST /api/seed — replace the signed-in user's data with a realistic demo set
// (this month + 5 prior months + a portfolio) so every screen has content.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(holdings).where(eq(holdings.userId, userId));

  const now = new Date();
  const today = now.getUTCDate();
  // Spread this month's entries across days 1..today.
  const curDay = (i: number) => (today <= 1 ? 1 : (i % today) + 1);
  const at = (monthsAgo: number, day: number, hour = 12) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day, hour, 0, 0));

  type Row = typeof transactions.$inferInsert;
  const rows: Row[] = [];
  const commit = (
    monthsAgo: number,
    day: number,
    type: "expense" | "investment",
    category: string,
    note: string,
    amount: number,
    hour = 12,
  ) => {
    const t = at(monthsAgo, day, hour);
    rows.push({
      userId,
      type,
      category,
      note,
      amountPaise: rupeesToPaise(amount),
      status: "committed",
      stage: "manual",
      txnTime: t,
      committedAt: t,
    });
  };

  // This month — the detailed view.
  const thisMonth: Array<[("expense" | "investment"), string, string, number]> = [
    ["expense", "Food & Dining", "Dinner at Toit", 1240],
    ["expense", "Coffee & Snacks", "Blue Tokai flat white", 120],
    ["expense", "Groceries", "BigBasket weekly", 2380],
    ["investment", "Mutual Fund", "SIP — Parag Parikh Flexi Cap", 40000],
    ["expense", "Transport", "Uber to airport", 640],
    ["expense", "Electronics & Gadgets", "MacBook Air M3", 66000],
    ["expense", "Food & Dining", "Swiggy — Mexican", 540],
    ["expense", "Bills & Utilities", "Electricity — this month", 2150],
    ["investment", "Stocks / Equity", "HDFC Bank — 25 shares", 35000],
    ["expense", "Coffee & Snacks", "Third Wave", 280],
    ["expense", "Groceries", "Zepto essentials", 870],
    ["expense", "Subscriptions", "Netflix + Spotify", 848],
    ["expense", "Health & Medical", "Apollo pharmacy", 640],
    ["expense", "Transport", "Metro recharge", 500],
  ];
  thisMonth.forEach(([type, category, note, amount], i) =>
    commit(0, curDay(i), type, category, note, amount, 20 - (i % 12)),
  );

  // Prior 5 months — enough for the 6-month trend + month selector.
  const priorExpense = [52300, 68200, 58400, 61200, 47800]; // 1..5 months ago
  const priorInvest = [65000, 55000, 60000, 50000, 50000];
  for (let m = 1; m <= 5; m++) {
    const exp = priorExpense[m - 1]!;
    // Split the month's expense across a few categories/days.
    commit(m, 4, "expense", "Rent & Housing", "Monthly rent", Math.round(exp * 0.5));
    commit(m, 9, "expense", "Groceries", "Groceries", Math.round(exp * 0.2));
    commit(m, 15, "expense", "Food & Dining", "Eating out", Math.round(exp * 0.18));
    commit(m, 22, "expense", "Shopping", "Shopping", Math.round(exp * 0.12));
    commit(m, 5, "investment", "Mutual Fund", "SIP — Parag Parikh Flexi Cap", priorInvest[m - 1]!);
  }

  await db.insert(transactions).values(rows);

  // [name, ticker, type, invested, current, units] — units let the AMFI batch job
  // revalue mutual funds (current = units × live NAV). Stocks have no free feed.
  const holdingSeed: Array<[string, string, string, number, number, number | null]> = [
    ["Parag Parikh Flexi Cap", "PPFAS · Direct Growth", "Mutual Fund", 240000, 298400, 3510],
    ["Nifty 50 Index Fund", "UTI · Direct Growth", "Mutual Fund", 120000, 133900, 4184],
    ["SBI Small Cap", "SBI · Direct Growth", "Mutual Fund", 60000, 71200, 375],
    ["HDFC Bank", "HDFCBANK · NSE", "Stock", 35000, 37650, 25],
    ["Infosys", "INFY · NSE", "Stock", 48000, 42300, 30],
  ];
  await db.insert(holdings).values(
    holdingSeed.map(([name, ticker, type, invested, current, units]) => ({
      userId,
      name,
      ticker,
      type,
      investedPaise: rupeesToPaise(invested),
      currentPaise: rupeesToPaise(current),
      units,
      lastValuedAt: now,
    })),
  );

  return Response.json({ ok: true, transactions: rows.length, holdings: holdingSeed.length });
}
