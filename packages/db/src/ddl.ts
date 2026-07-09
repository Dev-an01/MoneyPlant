// Schema DDL as plain, idempotent statements — no side effects, no db handle.
// Shared by migrate() (runs them via the app's connection) and the PGlite socket
// server (applies them to its own instance before serving). Works on PGlite (PG16
// core) and a real Postgres 13+; both ship gen_random_uuid().
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email            text NOT NULL UNIQUE,
    password_hash    text NOT NULL,
    name             text,
    phone            text UNIQUE,
    telegram_user_id bigint UNIQUE,
    created_at       timestamptz NOT NULL DEFAULT now()
  );`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type              text NOT NULL,
    category          text NOT NULL,
    subtype           text,
    amount_paise      bigint NOT NULL,
    currency          text NOT NULL DEFAULT 'INR',
    note              text,
    status            text NOT NULL DEFAULT 'pending',
    txn_time          timestamptz NOT NULL DEFAULT now(),
    pending_until     timestamptz,
    source_chat_id    bigint,
    source_message_id bigint,
    raw_message       text,
    ai_confidence     real,
    stage             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    committed_at      timestamptz,
    updated_at        timestamptz NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS tx_user_status_idx ON transactions (user_id, status);`,
  `CREATE INDEX IF NOT EXISTS tx_user_time_idx ON transactions (user_id, txn_time);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tx_source_uniq ON transactions (user_id, source_chat_id, source_message_id);`,
  `CREATE TABLE IF NOT EXISTS holdings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           text NOT NULL,
    ticker         text NOT NULL,
    type           text NOT NULL,
    invested_paise bigint NOT NULL,
    current_paise  bigint NOT NULL,
    units          real,
    last_valued_at timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS holdings_user_idx ON holdings (user_id);`,
  // One-time Telegram connect code (secure account linking). ALTER so existing DBs upgrade.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code text;`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_expires timestamptz;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_tg_link_code_idx ON users (telegram_link_code);`,
];
