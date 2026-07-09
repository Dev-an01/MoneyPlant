-- Row-Level Security (PRD §11) — defense-in-depth on top of the app's per-query
-- user scoping. This is OPT-IN because it changes the connection model.
--
-- WHY OPT-IN: the app connects as a superuser (postgres), which BYPASSES RLS. For
-- RLS to actually enforce, the app must connect as a NON-superuser role and set the
-- current user id per request. Enabling it therefore requires three things:
--   1. Run this file once (creates the role + policies).
--   2. Point DATABASE_URL at the moneyplant_app role.
--   3. Wrap every transactions/holdings query in withUser() (see src/rls.ts) so the
--      `app.user_id` GUC is set inside the transaction.
--
-- Apply:  psql "$DATABASE_URL" -f packages/db/sql/rls.sql
--         (or: psql -h 127.0.0.1 -p 5544 -U postgres -d moneyplant -f ...)

-- 1. A least-privilege application role (no BYPASSRLS, not the table owner).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'moneyplant_app') THEN
    CREATE ROLE moneyplant_app LOGIN PASSWORD 'moneyplant_app';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO moneyplant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, transactions, holdings TO moneyplant_app;

-- users has NO RLS: auth (lookup by email) and registration happen before a user
-- context exists. Isolation for users comes from the app layer.

-- 2. Enable + FORCE RLS on the financial tables (FORCE so even the table owner is
--    subject to policies; the app role is not the owner regardless).
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE  ROW LEVEL SECURITY;
ALTER TABLE holdings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings     FORCE  ROW LEVEL SECURITY;

-- 3. Policies: a row is visible/writable only when it belongs to the current
--    request's user, taken from the `app.user_id` session variable.
DROP POLICY IF EXISTS tx_isolation ON transactions;
CREATE POLICY tx_isolation ON transactions
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

DROP POLICY IF EXISTS holdings_isolation ON holdings;
CREATE POLICY holdings_isolation ON holdings
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);
