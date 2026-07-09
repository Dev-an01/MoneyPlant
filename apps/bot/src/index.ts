// MoneyPlant Telegram bot (grammY, long-polling — no public webhook needed).
// Text a spend/investment, it parses + categorizes (the shared cascade), files a
// PENDING transaction in the 5-minute grace window, and lets you commit/cancel
// inline. Writes to the same Postgres the dashboard reads (via DATABASE_URL).
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { and, eq, gt, lte } from "drizzle-orm";
import { db, migrate, users, transactions } from "@moneyplant/db";
import { ingestMessage, defaultProvider } from "@moneyplant/core";
import { rupeesToPaise, paiseToRupees, GRACE_WINDOW_SEC } from "@moneyplant/shared";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error(
    "BOT_TOKEN is not set. Create a bot with @BotFather, then:\n" +
      "  BOT_TOKEN=123:abc  bun run --filter @moneyplant/bot dev\n" +
      "Also set DATABASE_URL to the same database the web app uses.",
  );
  process.exit(1);
}

const fmt = (paise: number) => "₹" + paiseToRupees(paise).toLocaleString("en-IN");

async function main() {
  await migrate();
  const bot = new Bot(token!);

  // Securely connect a Telegram chat to an account via a one-time code that the
  // dashboard mints (Settings → Connect Telegram). No account detail is guessable.
  async function linkByCode(code: string, telegramId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.telegramLinkCode, code), gt(users.telegramLinkExpires, new Date())))
      .limit(1);
    if (!user) return null;
    // A Telegram id maps to exactly one account — detach it from any previous one.
    await db.update(users).set({ telegramUserId: null }).where(eq(users.telegramUserId, telegramId));
    await db
      .update(users)
      .set({ telegramUserId: telegramId, telegramLinkCode: null, telegramLinkExpires: null })
      .where(eq(users.id, user.id));
    return user;
  }

  const connectHint =
    "Open your MoneyPlant dashboard → *Settings → Connect Telegram* and tap the button. " +
    "That securely links this chat to your account.";

  // Telegram's native share-contact button — the phone is verified by Telegram
  // itself (the user taps to send their own number), satisfying PRD §6.1/§15.
  const phoneKeyboard = new Keyboard().requestContact("📱 Verify my phone").resized().oneTime();
  const linkedMsg = (email: string) =>
    `✅ Connected to *${email}*!\n\nOptionally verify your phone with the button below, then just text me ` +
    "what you spent — “dinner 1240”, “40k mutual fund”, “uber 480”. I hold each entry for 5 minutes so you can fix or cancel.";

  // Deep links (t.me/<bot>?start=<code>) arrive as /start <code>.
  bot.command("start", async (ctx) => {
    const code = ctx.match?.trim();
    if (code) {
      const user = await linkByCode(code, ctx.from!.id);
      if (user) return ctx.reply(linkedMsg(user.email), { parse_mode: "Markdown", reply_markup: phoneKeyboard });
      return ctx.reply(`That connect link is invalid or expired. Generate a fresh one:\n${connectHint}`, {
        parse_mode: "Markdown",
      });
    }
    return ctx.reply(`🌱 *MoneyPlant*\n\n${connectHint}`, { parse_mode: "Markdown" });
  });

  // Manual fallback: paste the code from the dashboard.
  bot.command("link", async (ctx) => {
    const code = ctx.match?.trim();
    if (!code) return ctx.reply(`Usage: /link <code>\n\n${connectHint}`, { parse_mode: "Markdown" });
    const user = await linkByCode(code, ctx.from!.id);
    if (user) return ctx.reply(linkedMsg(user.email), { parse_mode: "Markdown", reply_markup: phoneKeyboard });
    return ctx.reply("That code is invalid or expired.", { parse_mode: "Markdown" });
  });

  // Phone verification (PRD §6.1) — the user taps "Verify my phone", Telegram sends
  // their own verified contact. We accept only the sender's own number.
  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      return ctx.reply("Please share *your own* number using the button.", { parse_mode: "Markdown" });
    }
    const user = await userFor(ctx.from.id);
    if (!user) return ctx.reply("Connect your account first — open your dashboard's Connect link.");

    const phone = contact.phone_number.startsWith("+") ? contact.phone_number : `+${contact.phone_number}`;
    try {
      // A phone maps to one account — detach it from any other, then set it here.
      await db.update(users).set({ phone: null }).where(eq(users.phone, phone));
      await db.update(users).set({ phone }).where(eq(users.id, user.id));
      return ctx.reply(`✅ Phone verified: ${phone}`, { reply_markup: { remove_keyboard: true } });
    } catch {
      return ctx.reply("Couldn’t save that number — try again.");
    }
  });

  async function userFor(telegramId: number) {
    const [u] = await db.select().from(users).where(eq(users.telegramUserId, telegramId)).limit(1);
    return u ?? null;
  }

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // commands handled above
    const user = await userFor(ctx.from.id);
    if (!user) return ctx.reply("Link your account first: /link you@example.com");

    const result = await ingestMessage(text, defaultProvider());
    if (result.amount === null) {
      return ctx.reply("Couldn’t find an amount. Try “coffee 180” or “40k mutual fund”.");
    }

    const now = new Date();
    const [row] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        type: result.type,
        category: result.category,
        amountPaise: rupeesToPaise(result.amount),
        note: result.note,
        rawMessage: text,
        status: "pending",
        stage: result.stage,
        aiConfidence: result.confidence,
        sourceChatId: ctx.chat.id,
        sourceMessageId: ctx.message.message_id,
        txnTime: now,
        pendingUntil: new Date(now.getTime() + GRACE_WINDOW_SEC * 1000),
      })
      .onConflictDoNothing()
      .returning();

    if (!row) return; // duplicate message — already ingested

    const kb = new InlineKeyboard()
      .text("✅ Commit now", `commit:${row.id}`)
      .text("✖ Cancel", `cancel:${row.id}`);
    await ctx.reply(
      `${result.type === "investment" ? "📈" : "💸"} *${fmt(row.amountPaise)}* · ${row.category}\n` +
        `_Auto-commits in 5 min. Fix on the dashboard._`,
      { parse_mode: "Markdown", reply_markup: kb },
    );
  });

  bot.on("callback_query:data", async (ctx) => {
    const [action, id] = ctx.callbackQuery.data.split(":");
    const user = await userFor(ctx.from.id);
    if (!user || (action !== "commit" && action !== "cancel")) return ctx.answerCallbackQuery();

    const now = new Date();
    const set =
      action === "commit"
        ? { status: "committed" as const, committedAt: now, pendingUntil: null, updatedAt: now }
        : { status: "cancelled" as const, pendingUntil: null, updatedAt: now };
    const [row] = await db
      .update(transactions)
      .set(set)
      .where(and(eq(transactions.id, id!), eq(transactions.userId, user.id), eq(transactions.status, "pending")))
      .returning();

    await ctx.answerCallbackQuery(row ? (action === "commit" ? "Committed ✓" : "Cancelled") : "Already resolved");
    if (row) {
      const label = action === "commit" ? "✅ Committed" : "✖ Cancelled";
      await ctx.editMessageText(`${label} · ${fmt(row.amountPaise)} · ${row.category}`);
    }
  });

  // Auto-commit anything past its grace window (the exactly-once commit, PRD §9).
  setInterval(() => {
    db.update(transactions)
      .set({ status: "committed", committedAt: new Date(), pendingUntil: null, updatedAt: new Date() })
      .where(and(eq(transactions.status, "pending"), lte(transactions.pendingUntil, new Date())))
      .catch(() => {});
  }, 30_000);

  bot.catch((err) => console.error("[bot] error:", err.message));
  console.log("🌱 MoneyPlant bot running (long-polling). Press Ctrl+C to stop.");
  await bot.start();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
