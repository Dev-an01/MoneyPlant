// Create/upgrade the schema. Uses DATABASE_URL if set, else embedded PGlite.
import { migrate, driver } from "../src/index";

await migrate();
console.log(`✓ schema ready (driver: ${driver})`);
process.exit(0);
