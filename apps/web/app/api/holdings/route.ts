import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { rupeesToPaise } from "@moneyplant/shared";
import { db, holdings, currentUserId, unauthorized, dbReady, holdingToDTO } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/holdings — portfolio positions with derived P&L.
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const rows = await db
    .select()
    .from(holdings)
    .where(eq(holdings.userId, userId))
    .orderBy(asc(holdings.name));

  return Response.json({ holdings: rows.map(holdingToDTO) });
}

const createSchema = z.object({
  name: z.string().min(1),
  ticker: z.string().min(1),
  type: z.string().min(1),
  invested: z.number().nonnegative(),
  current: z.number().nonnegative(),
  units: z.number().optional(),
});

// POST /api/holdings — add a position.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body" }, { status: 400 });
  const { name, ticker, type, invested, current, units } = parsed.data;

  const [row] = await db
    .insert(holdings)
    .values({
      userId,
      name,
      ticker,
      type,
      investedPaise: rupeesToPaise(invested),
      currentPaise: rupeesToPaise(current),
      units: units ?? null,
      lastValuedAt: new Date(),
    })
    .returning();

  return Response.json({ holding: holdingToDTO(row!) }, { status: 201 });
}
