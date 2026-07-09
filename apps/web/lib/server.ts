// Server-only helpers shared by every route handler: auth guard, one-time DB
// readiness, the pending → committed reconciliation, and DTO mappers.
import { and, eq, lte, sql } from "drizzle-orm";
import { db, migrate, transactions, holdings, type Transaction, type Holding } from "@moneyplant/db";
import {
  GRACE_WINDOW_SEC,
  type TxnDTO,
  type TxnType,
  type TxnStatus,
  type PendingDTO,
  type HoldingDTO,
} from "@moneyplant/shared";
import { auth } from "@/auth";

// Ensure the schema exists exactly once per server process (memoized promise).
let ready: Promise<void> | null = null;
export function dbReady(): Promise<void> {
  if (!ready) ready = migrate();
  return ready;
}

/** Returns the signed-in user id, or null (caller responds 401). */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * Promote any of this user's pending entries whose 5-minute grace window has
 * elapsed to committed — the "exactly-once auto-commit" (PRD §9). Idempotent;
 * called at the top of the read paths so state is always current without a cron.
 */
export async function reconcilePending(userId: string): Promise<void> {
  await db
    .update(transactions)
    .set({ status: "committed", committedAt: new Date(), pendingUntil: null, updatedAt: new Date() })
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "pending"),
        lte(transactions.pendingUntil, new Date()),
      ),
    );
}

// ── DTO mappers ────────────────────────────────────────────────────────────
export function txnToDTO(r: Transaction): TxnDTO {
  return {
    id: r.id,
    type: r.type as TxnType,
    category: r.category,
    note: r.note,
    amount: r.amountPaise / 100,
    status: r.status as TxnStatus,
    txnTime: r.txnTime.toISOString(),
    aiConfidence: r.aiConfidence,
    stage: r.stage,
  };
}

export function pendingToDTO(r: Transaction): PendingDTO {
  const endsAt = r.pendingUntil ? r.pendingUntil.getTime() : Date.now();
  return {
    id: r.id,
    amount: r.amountPaise / 100,
    category: r.category,
    type: r.type as TxnType,
    message: r.rawMessage ?? r.note ?? "",
    endsAt,
    totalSec: GRACE_WINDOW_SEC,
  };
}

export function holdingToDTO(r: Holding): HoldingDTO {
  const invested = r.investedPaise / 100;
  const current = r.currentPaise / 100;
  const pnl = current - invested;
  const pnlPct = invested ? (pnl / invested) * 100 : 0;
  return {
    id: r.id,
    name: r.name,
    ticker: r.ticker,
    type: r.type,
    invested,
    current,
    pnl,
    pnlPct,
    lastValuedAt: r.lastValuedAt?.toISOString() ?? null,
  };
}

export { db, transactions, holdings, sql };
