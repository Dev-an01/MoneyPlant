-- Manual fallback to create the schema with psql, if you prefer not to use
-- drizzle-kit. The recommended dev path is `bun run --filter @moneyplant/db db:push`.
-- Postgres 13+ provides gen_random_uuid() built in.

CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE,
  password_hash    text NOT NULL,
  name             text,
  phone            text UNIQUE,
  telegram_user_id bigint UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
