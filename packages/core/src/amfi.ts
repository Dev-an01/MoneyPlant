// Mutual-fund valuation via AMFI's free daily NAV feed (PRD §6.11 batch job).
// AMFI publishes every scheme's NAV as a semicolon-delimited text file; we parse
// it and fuzzy-match a holding's scheme name to its current NAV. No API key.
export interface NavRecord {
  code: string;
  name: string;
  nav: number;
}

const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

export async function fetchAmfiNavs(url = AMFI_URL): Promise<NavRecord[]> {
  const res = await fetch(url, { headers: { "user-agent": "MoneyPlant/0.1" } });
  if (!res.ok) throw new Error(`AMFI fetch failed: ${res.status}`);
  return parseAmfiNavs(await res.text());
}

// Data lines have 6 semicolon-separated fields; the first is a numeric scheme code.
// Fund-house headers and blank lines are skipped.
export function parseAmfiNavs(text: string): NavRecord[] {
  const out: NavRecord[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 6) continue;
    const code = parts[0]!.trim();
    if (!/^\d+$/.test(code)) continue;
    const nav = Number(parts[4]!.trim());
    if (!Number.isFinite(nav) || nav <= 0) continue;
    out.push({ code, name: parts[3]!.trim(), nav });
  }
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Best-effort match of a holding's scheme name to an AMFI record. Requires all
 * query tokens to appear in the candidate; prefers Direct + Growth plans, then
 * the shortest (least-qualified) name. Returns null when nothing matches.
 */
export function matchNav(schemeName: string, records: NavRecord[]): NavRecord | null {
  const tokens = norm(schemeName).split(" ").filter(Boolean);
  if (!tokens.length) return null;

  let best: NavRecord | null = null;
  let bestScore = -Infinity;
  for (const r of records) {
    const name = norm(r.name);
    // Match on whole words (a Set), so "50" doesn't match inside "500".
    const words = new Set(name.split(" "));
    if (!tokens.every((t) => words.has(t))) continue;
    let score = 0;
    if (name.includes("direct")) score += 2;
    if (name.includes("growth")) score += 2;
    if (name.includes("idcw") || name.includes("dividend")) score -= 2;
    score -= name.length / 100; // prefer the least-qualified name among ties
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}
