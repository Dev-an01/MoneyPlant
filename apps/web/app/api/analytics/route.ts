import { and, eq } from "drizzle-orm";
import type { AnalyticsDTO, CategorySlice, DayPoint, MonthPoint } from "@moneyplant/shared";
import {
  db,
  transactions,
  holdings,
  currentUserId,
  unauthorized,
  dbReady,
  reconcilePending,
  holdingToDTO,
} from "@/lib/server";

export const dynamic = "force-dynamic";

// All grouping is done in UTC so month/day buckets are stable regardless of the
// server's locale. Volume for a personal tracker is small — aggregate in JS.
const monthKey = (d: Date) => d.toISOString().slice(0, 7); // "2026-06"
const dayOfMonth = (d: Date) => d.getUTCDate();

function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function addMonths(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return monthKey(d);
}

function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

// GET /api/analytics?month=YYYY-MM  (defaults to the current calendar month)
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();
  await reconcilePending(userId);

  const url = new URL(req.url);
  const selected = url.searchParams.get("month") ?? monthKey(new Date());
  const prevKey = addMonths(selected, -1);

  const [txRows, holdingRows] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.status, "committed"))),
    db.select().from(holdings).where(eq(holdings.userId, userId)),
  ]);

  // Rupee amounts keyed for fast rollups.
  const tx = txRows.map((r) => ({
    type: r.type as "expense" | "investment",
    category: r.category,
    note: r.note,
    amount: r.amountPaise / 100,
    date: r.txnTime,
    key: monthKey(r.txnTime),
  }));

  const inMonth = tx.filter((t) => t.key === selected);
  const expensesThisMonth = inMonth.filter((t) => t.type === "expense");
  const investThisMonth = inMonth.filter((t) => t.type === "investment");

  const sum = (arr: { amount: number }[]) => arr.reduce((a, t) => a + t.amount, 0);
  const expenseTotal = sum(expensesThisMonth);
  const investTotal = sum(investThisMonth);
  const lastMonthExpense = sum(tx.filter((t) => t.key === prevKey && t.type === "expense"));
  const deltaPct = lastMonthExpense ? ((expenseTotal - lastMonthExpense) / lastMonthExpense) * 100 : 0;
  const savingsRatePct = expenseTotal + investTotal ? (investTotal / (expenseTotal + investTotal)) * 100 : 0;

  // By-category (expenses), sorted desc.
  const catMap = new Map<string, number>();
  for (const t of expensesThisMonth) catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  const byCategory: CategorySlice[] = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      pct: expenseTotal ? (amount / expenseTotal) * 100 : 0,
    }));

  // Investment split by category (for the Insights "by type" breakdown).
  const invCatMap = new Map<string, number>();
  for (const t of investThisMonth) invCatMap.set(t.category, (invCatMap.get(t.category) ?? 0) + t.amount);
  const investByCategory: CategorySlice[] = [...invCatMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      pct: investTotal ? (amount / investTotal) * 100 : 0,
    }));

  // Daily expense series for the selected month.
  const dayMap = new Map<number, number>();
  for (const t of expensesThisMonth) dayMap.set(dayOfMonth(t.date), (dayMap.get(dayOfMonth(t.date)) ?? 0) + t.amount);
  const daily: DayPoint[] = [];
  for (let day = 1; day <= daysInMonth(selected); day++) daily.push({ day, value: dayMap.get(day) ?? 0 });

  // Top expenses this month.
  const topExpenses = [...expensesThisMonth]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((t) => ({ category: t.category, note: t.note, amount: t.amount }));

  // 6-month trend (the selected month and the five before it).
  const sixKeys = Array.from({ length: 6 }, (_, i) => addMonths(selected, -(5 - i)));
  const spendByKey = new Map<string, number>();
  const investByKey = new Map<string, number>();
  for (const t of tx) {
    const target = t.type === "expense" ? spendByKey : investByKey;
    target.set(t.key, (target.get(t.key) ?? 0) + t.amount);
  }
  const sixMonthSpend: MonthPoint[] = sixKeys.map((k) => ({
    key: k,
    label: new Date(`${k}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    value: spendByKey.get(k) ?? 0,
    hasData: (spendByKey.get(k) ?? 0) > 0,
  }));
  const sixMonthInvest: MonthPoint[] = sixKeys.map((k) => ({
    key: k,
    label: new Date(`${k}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    value: investByKey.get(k) ?? 0,
    hasData: (investByKey.get(k) ?? 0) > 0,
  }));

  // Months for the selector: every month with any data, plus the current one.
  const monthsSet = new Set<string>([...spendByKey.keys(), ...investByKey.keys(), selected, monthKey(new Date())]);
  const months: MonthPoint[] = [...monthsSet]
    .sort()
    .map((k) => ({
      key: k,
      label: monthLabel(k),
      value: spendByKey.get(k) ?? 0,
      hasData: (spendByKey.get(k) ?? 0) > 0 || (investByKey.get(k) ?? 0) > 0,
    }));

  // Portfolio.
  const dtoHoldings = holdingRows.map(holdingToDTO);
  const invested = dtoHoldings.reduce((a, h) => a + h.invested, 0);
  const current = dtoHoldings.reduce((a, h) => a + h.current, 0);
  const pnl = current - invested;
  const pnlPct = invested ? (pnl / invested) * 100 : 0;

  const payload: AnalyticsDTO = {
    month: { key: selected, label: monthLabel(selected) },
    expenseTotal,
    investTotal,
    lastMonthExpense,
    deltaPct,
    txCount: inMonth.length,
    savingsRatePct,
    byCategory,
    investByCategory,
    daily,
    topExpenses,
    sixMonthSpend,
    sixMonthInvest,
    months,
    portfolio: { invested, current, pnl, pnlPct, holdings: dtoHoldings },
  };

  return Response.json(payload);
}
