// Local Postgres cluster manager — zero credentials, no Docker.
// Creates (once) and runs a dedicated trust-auth PostgreSQL cluster using the
// PostgreSQL binaries already on the machine, on a private port. This is a real
// multi-connection Postgres, so the app's node-postgres pool works reliably
// across every Next module context (embedded/in-memory DBs do not).
//
//   node packages/db/scripts/pg.mjs start|stop|status
//
// Override with env: PG_BIN (path to pg binaries), MONEYPLANT_PGDATA, MONEYPLANT_PGPORT.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const WIN = platform() === "win32";
const DATA = process.env.MONEYPLANT_PGDATA ?? join(homedir(), ".moneyplant", "pg17");
const PORT = process.env.MONEYPLANT_PGPORT ?? "5544";
const DB = process.env.MONEYPLANT_PGDATABASE ?? "moneyplant";
const LOG = join(homedir(), ".moneyplant", "pg.log");

function findBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  if (WIN) {
    const root = "C:\\Program Files\\PostgreSQL";
    if (existsSync(root)) {
      const versions = readdirSync(root)
        .filter((v) => /^\d+$/.test(v))
        .sort((a, b) => Number(b) - Number(a));
      for (const v of versions) {
        const bin = join(root, v, "bin");
        if (existsSync(join(bin, "pg_ctl.exe"))) return bin;
      }
    }
    return ""; // last resort: rely on PATH
  }
  return ""; // unix: assume pg_ctl/initdb/createdb are on PATH
}

const BIN = findBin();
const exe = (name) => (BIN ? join(BIN, WIN ? `${name}.exe` : name) : name);
const run = (name, args) => spawnSync(exe(name), args, { stdio: "inherit" });

const url = `postgres://postgres@127.0.0.1:${PORT}/${DB}`;
const action = process.argv[2] ?? "start";

if (action === "start") {
  if (!existsSync(join(DATA, "PG_VERSION"))) {
    console.log(`Creating a fresh Postgres cluster at ${DATA} …`);
    mkdirSync(DATA, { recursive: true });
    const r = run("initdb", ["-D", DATA, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"]);
    if (r.status !== 0) {
      console.error("initdb failed. Is PostgreSQL installed? Set PG_BIN to its bin/ directory.");
      process.exit(1);
    }
  }
  const status = spawnSync(exe("pg_ctl"), ["-D", DATA, "status"], { stdio: "ignore" });
  if (status.status === 0) {
    console.log("Postgres is already running.");
  } else {
    run("pg_ctl", ["-D", DATA, "-o", `-p ${PORT} -h 127.0.0.1`, "-l", LOG, "start"]);
  }
  // Ensure the database exists (silent — harmless if it already does).
  spawnSync(exe("createdb"), ["-h", "127.0.0.1", "-p", PORT, "-U", "postgres", DB], { stdio: "ignore" });
  console.log(`\n✓ Postgres running on 127.0.0.1:${PORT} — database "${DB}"`);
  console.log(`  apps/web/.env.local →  DATABASE_URL=${url}`);
} else if (action === "stop") {
  run("pg_ctl", ["-D", DATA, "stop", "-m", "fast"]);
} else if (action === "status") {
  run("pg_ctl", ["-D", DATA, "status"]);
} else {
  console.error(`Unknown action "${action}". Use: start | stop | status`);
  process.exit(1);
}
