import { eq } from "drizzle-orm";
import { users } from "@moneyplant/db";
import { db, currentUserId, unauthorized, dbReady } from "@/lib/server";

export const dynamic = "force-dynamic";

// GET /api/telegram/status — is a Telegram chat connected to this account?
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const [u] = await db
    .select({ tg: users.telegramUserId, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  // Mask the phone — show only the last 4 digits.
  const phone = u?.phone ? u.phone.replace(/.(?=.{4})/g, "•") : null;
  return Response.json({ connected: !!u?.tg, phone });
}

// POST /api/telegram/status  { action: "unlink" } — disconnect the Telegram chat.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "unlink") return Response.json({ error: "invalid action" }, { status: 400 });

  await db
    .update(users)
    .set({ telegramUserId: null, telegramLinkCode: null, telegramLinkExpires: null })
    .where(eq(users.id, userId));
  return Response.json({ connected: false });
}
