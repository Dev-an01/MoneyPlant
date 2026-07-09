// Portfolio valuation: revalue mutual-fund holdings from AMFI NAVs (PRD §6.11).
// A holding is valued when it has `units` and its scheme name matches an AMFI
// record; current value = units × NAV. Stocks are left untouched (no free feed).
import { and, eq } from "drizzle-orm";
import { matchNav, type NavRecord } from "@moneyplant/core";
import { db } from "./index";
import { holdings } from "./schema";

export interface ValuationResult {
  valued: number;
  skipped: number;
}

export async function revalueMutualFunds(records: NavRecord[], userId?: string): Promise<ValuationResult> {
  const filters = [eq(holdings.type, "Mutual Fund")];
  if (userId) filters.push(eq(holdings.userId, userId));

  const rows = await db
    .select()
    .from(holdings)
    .where(filters.length > 1 ? and(...filters) : filters[0]);

  let valued = 0;
  let skipped = 0;
  const now = new Date();
  for (const h of rows) {
    if (!h.units) {
      skipped++;
      continue;
    }
    const match = matchNav(h.name, records);
    if (!match) {
      skipped++;
      continue;
    }
    await db
      .update(holdings)
      .set({ currentPaise: Math.round(h.units * match.nav * 100), lastValuedAt: now, updatedAt: now })
      .where(eq(holdings.id, h.id));
    valued++;
  }
  return { valued, skipped };
}
