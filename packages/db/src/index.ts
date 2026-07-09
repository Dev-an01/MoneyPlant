import { sql } from "drizzle-orm";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";
import { SCHEMA_STATEMENTS } from "./ddl";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, readdirSync } from "node:fs";

// Driver-adaptive client.
//   • DATABASE_URL set  → node-postgres (the production path: Neon/Supabase/Docker Postgres).
//   • otherwise         → embedded PGlite (real Postgres compiled to WASM), persisted on
//                         disk. Zero setup — the whole app runs with no external DB server.
// Both use the identical Drizzle schema, so nothing downstream changes.
// Cache the underlying CLIENT (pool / PGlite) on globalThis, not just the drizzle
// wrapper. Next's dev bundler can evaluate this module once per route chunk; caching
// the client guarantees exactly ONE PGlite instance per process (PGlite loads the
// data dir into memory, so a second instance would see stale, divergent state).
const g = globalThis as unknown as {
  __mpPglite?: PGlite;
  __mpPgPool?: pg.Pool;
};

function make(): NodePgDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (url) {
    g.__mpPgPool ??= new pg.Pool({ connectionString: url });
    return drizzlePg(g.__mpPgPool, { schema });
  }
  if (!g.__mpPglite) {
    const dir = process.env.PGLITE_DATA_DIR ?? join(homedir(), ".moneyplant", "pgdata");
    mkdirSync(dir, { recursive: true }); // NODEFS only makes the leaf dir
    // A prior process killed ungracefully leaves a stale postmaster.pid / socket
    // lock that makes the next boot abort ("another server running"). Safe to clear:
    // only one process may open the dir at a time.
    try {
      for (const f of readdirSync(dir)) {
        if (f === "postmaster.pid" || f.startsWith(".s.PGSQL")) rmSync(join(dir, f), { force: true });
      }
    } catch {
      /* fresh dir */
    }
    g.__mpPglite = new PGlite(dir);
  }
  // The pglite adapter exposes the same query API; the cast keeps a single db type.
  return drizzlePglite(g.__mpPglite, { schema }) as unknown as NodePgDatabase<typeof schema>;
}

export const db: NodePgDatabase<typeof schema> = make();

export const driver: "postgres" | "pglite" = process.env.DATABASE_URL ? "postgres" : "pglite";

// Idempotent schema creation — safe to run on every boot.
export async function migrate(): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) await db.execute(sql.raw(stmt));
}

export { schema, SCHEMA_STATEMENTS };
export * from "./schema";
export * from "./valuation";
export * from "./rls";
