import { pgTable, uuid, text, timestamp, bigint, real, index, uniqueIndex } from "drizzle-orm/pg-core";

// Users — the auth identity + the link to a verified phone / Telegram account.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  // Verified phone (PRD §6.1) — set during Telegram onboarding, nullable until then.
  phone: text("phone").unique(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).unique(),
  // One-time code for securely connecting a Telegram chat to this account.
  telegramLinkCode: text("telegram_link_code").unique(),
  telegramLinkExpires: timestamp("telegram_link_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Transactions — every expense or investment, from the bot or the dashboard.
// Amounts are stored as integer PAISE (minor units) to avoid float drift; the
// API exposes rupees at the boundary. `status` drives the pending → committed
// state machine (PRD §9); `pendingUntil` is the end of the 5-minute grace window.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'expense' | 'investment'
    category: text("category").notNull(),
    subtype: text("subtype"),
    // Amount in integer paise (minor units) — rupees only at the API boundary.
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("INR"),
    note: text("note"),
    status: text("status").notNull().default("pending"), // 'pending' | 'committed' | 'cancelled'
    // When the message was sent / the money moved (from the Telegram message date).
    txnTime: timestamp("txn_time", { withTimezone: true }).notNull().defaultNow(),
    // End of the 5-minute grace window; null once committed/cancelled.
    pendingUntil: timestamp("pending_until", { withTimezone: true }),
    // Provenance — lets ingestion be idempotent per (chat, message).
    sourceChatId: bigint("source_chat_id", { mode: "number" }),
    sourceMessageId: bigint("source_message_id", { mode: "number" }),
    rawMessage: text("raw_message"),
    aiConfidence: real("ai_confidence"),
    stage: text("stage"), // 'keyword' | 'ai' | 'manual'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUserStatus: index("tx_user_status_idx").on(t.userId, t.status),
    byUserTime: index("tx_user_time_idx").on(t.userId, t.txnTime),
    // Idempotent ingestion: the same Telegram message can't create two rows.
    sourceUniq: uniqueIndex("tx_source_uniq").on(t.userId, t.sourceChatId, t.sourceMessageId),
  }),
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Holdings — portfolio positions valued by the batch job (PRD §6.11). Invested
// and current value in paise; per-holding + overall P&L is derived.
export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ticker: text("ticker").notNull(),
    type: text("type").notNull(), // 'Mutual Fund' | 'Stock' | ...
    investedPaise: bigint("invested_paise", { mode: "number" }).notNull(),
    currentPaise: bigint("current_paise", { mode: "number" }).notNull(),
    units: real("units"),
    lastValuedAt: timestamp("last_valued_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("holdings_user_idx").on(t.userId),
  }),
);

export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;
