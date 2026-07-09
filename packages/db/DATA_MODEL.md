# MoneyPlant — Postgres Data Model

How data is stored in Postgres. Two parts: **what exists today** (auth phase) and **what we add for the working backend** (PRD §10–§11). A few storage decisions are still open — flagged at the bottom.

---

## 1. What exists now — `users`

Defined in `backend/db/src/schema.ts`, created by `db:push`. This is the only live table.

| column | type | constraints | notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `text` | NOT NULL, UNIQUE | lowercased before insert |
| `password_hash` | `text` | NOT NULL | bcrypt (cost 12) — never the plaintext |
| `name` | `text` | nullable | |
| `phone` | `text` | UNIQUE, nullable | set during Telegram onboarding (PRD §6.1) |
| `telegram_user_id` | `bigint` | UNIQUE, nullable | links the bot identity to the account |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

```sql
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE,
  password_hash    text NOT NULL,
  name             text,
  phone            text UNIQUE,
  telegram_user_id bigint UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

---

## 2. What we add for the working backend (planned, PRD §10)

Two enums + two tables. These get created when we build the API/bot.

### enums
```sql
CREATE TYPE txn_type   AS ENUM ('expense', 'investment');
CREATE TYPE txn_status AS ENUM ('pending', 'committed', 'cancelled');
```

### `transactions` — every logged expense/investment

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → users.id | the RLS / isolation key |
| `type` | `txn_type` | expense \| investment |
| `category` | `text` | curated taxonomy (see CATEGORIES.md) |
| `subtype` | `text` null | e.g. mutual_fund, stock |
| `amount` **or** `amount_enc` | `numeric(14,2)` **or** `bytea` | **storage decision — see §4** |
| `currency` | `text` default `'INR'` | |
| `note` | `text` null | |
| `status` | `txn_status` default `'pending'` | 5-min grace → committed (PRD §9) |
| `txn_time` | `timestamptz` | from the Telegram message date |
| `source_message_id` | `bigint` null | idempotency (PRD §6.2, §9) |
| `ai_confidence` | `numeric` null | set only when the AI stage ran |
| `created_at` | `timestamptz` default `now()` | |
| `committed_at` | `timestamptz` null | when it left the grace window |

Indexes: `(user_id, txn_time desc)` for the ledger/monthly queries; **unique** `(user_id, source_message_id)` to guarantee exactly-once commit on webhook redelivery.

### `holdings` — portfolio positions (batch-valued)

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → users.id | RLS key |
| `instrument` | `text` | MF / stock identifier |
| `invested_amount` **or** `_enc` | `numeric` / `bytea` | same storage decision |
| `current_value` | `numeric` | from the AMFI/NSE batch job |
| `last_valued_at` | `timestamptz` | |

---

## 3. How isolation works (per-user privacy)

Every user-data table carries `user_id`. Because we chose **standalone JWT auth** (not Supabase), Postgres has no built-in `auth.uid()`. Two ways to enforce that a user only ever sees their own rows:

- **App-level (simplest):** the API always adds `WHERE user_id = <jwt.sub>` to every query. Easy, but the guarantee lives in app code.
- **Database-level RLS (PRD §NFR-2, stronger):** enable Row-Level Security and set a per-connection variable the policy reads:
  ```sql
  ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY user_isolation ON transactions
    USING (user_id = current_setting('app.current_user_id')::uuid);
  -- API runs this at the start of each request/transaction:
  SET LOCAL app.current_user_id = '<uuid from the verified JWT>';
  ```
  The DB itself refuses cross-user reads even if app code has a bug. This is the PRD's hard requirement (zero cross-user leakage).

---

## 4. Open decisions (need your call before I create these tables)

1. **How to store amounts.**
   - **(a) Plaintext `numeric`** — simplest; fine for dev; amounts readable in the DB.
   - **(b) Envelope-encrypted `bytea`** (PRD §11) — amount encrypted with a per-user data key wrapped by a master key (KMS or a local key in dev). Strongest privacy, the product's headline promise — but adds key management and means you can't `SUM()` in SQL (aggregation happens in app code after decrypt). Recommended for prod; we can start with (a) in dev behind the same interface and switch.

2. **RLS now or later.**
   - Turn on RLS + policies from the first migration (more setup, real isolation immediately), or ship app-level `WHERE user_id` first and add RLS before beta. PRD treats RLS as a hard requirement, so I recommend wiring it early.

3. **Holdings derivation** — keep `holdings` as a maintained table updated by the batch job, or derive positions from `transactions` on the fly? (PRD lists it as a maintained table.)
