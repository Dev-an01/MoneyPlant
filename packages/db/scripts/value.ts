// Batch portfolio valuation for ALL users (PRD §6.11 / §8 scheduled job).
// Set DATABASE_URL to the shared database, then run on a schedule:
//   DATABASE_URL=postgres://postgres@127.0.0.1:5544/moneyplant bun run scripts/value.ts
import { fetchAmfiNavs } from "@moneyplant/core";
import { migrate, revalueMutualFunds, driver } from "../src/index";

await migrate();
console.log(`Fetching AMFI NAVs (db driver: ${driver}) …`);
const records = await fetchAmfiNavs();
console.log(`Parsed ${records.length} NAVs. Revaluing mutual-fund holdings …`);
const result = await revalueMutualFunds(records);
console.log(`✓ Valued ${result.valued} holding(s); skipped ${result.skipped} (no units or no NAV match).`);
process.exit(0);
