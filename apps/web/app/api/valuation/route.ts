import { eq } from "drizzle-orm";
import { fetchAmfiNavs } from "@moneyplant/core";
import { revalueMutualFunds } from "@moneyplant/db";
import { db, holdings, currentUserId, unauthorized, dbReady, holdingToDTO } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/valuation — refresh this user's mutual-fund holdings from AMFI NAVs.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  let records;
  try {
    records = await fetchAmfiNavs();
  } catch {
    return Response.json({ error: "Couldn't reach the AMFI NAV feed. Try again shortly." }, { status: 502 });
  }

  const result = await revalueMutualFunds(records, userId);
  const rows = await db.select().from(holdings).where(eq(holdings.userId, userId));
  return Response.json({ ...result, holdings: rows.map(holdingToDTO) });
}
