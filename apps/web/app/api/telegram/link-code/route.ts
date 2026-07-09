import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { users } from "@moneyplant/db";
import { db, currentUserId, unauthorized, dbReady } from "@/lib/server";

export const dynamic = "force-dynamic";

const CODE_TTL_MIN = 15;

// POST /api/telegram/link-code — mint a short-lived one-time code for THIS user and
// return a Telegram deep link. The user opens it; the bot links their chat securely.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  await dbReady();

  const code = randomBytes(6).toString("hex"); // 12 chars
  const expires = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000);
  await db
    .update(users)
    .set({ telegramLinkCode: code, telegramLinkExpires: expires })
    .where(eq(users.id, userId));

  const username = process.env.NEXT_PUBLIC_BOT_USERNAME || process.env.BOT_USERNAME || "";
  const deepLink = username ? `https://t.me/${username}?start=${code}` : null;
  return Response.json({ code, deepLink, botUsername: username || null, expiresInMin: CODE_TTL_MIN });
}
