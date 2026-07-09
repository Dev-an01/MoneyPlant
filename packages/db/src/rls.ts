// Row-Level Security helper (PRD §11). Runs `fn` inside a transaction with the
// `app.user_id` session variable set, so the RLS policies in sql/rls.sql scope
// every query to the current user. Use this in place of `db` for all
// transactions/holdings access once RLS is enabled and DATABASE_URL points at the
// moneyplant_app role. Until then it's a harmless pass-through (superuser bypasses
// RLS), so it's safe to adopt incrementally.
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "./index";
import * as schema from "./schema";

export function withUser<T>(
  userId: string,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // set_config(..., is_local=true) is transaction-scoped — safe with pooling.
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    return fn(tx as unknown as NodePgDatabase<typeof schema>);
  });
}
