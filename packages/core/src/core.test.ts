import { expect, test, describe } from "bun:test";
import { parseAmount, maskAmount } from "./amount";
import { keywordMatch } from "./categorize";
import { ingestMessage, stubProvider } from "./ingest";
import { parseAmfiNavs, matchNav } from "./amfi";

describe("parseAmount", () => {
  const cases: Array<[string, number]> = [
    ["dinner at toit 1450", 1450],
    ["400", 400],
    ["66k", 66000],
    ["1.5L", 150000],
    ["40k", 40000],
    ["35,000", 35000],
    ["1.2cr", 12000000],
    ["₹2,380", 2380],
    ["1.5 lakh", 150000],
    ["1,00,000", 100000], // Indian grouping
    ["coffee 180", 180],
  ];
  for (const [input, expected] of cases) {
    test(`${input} → ${expected}`, () => {
      expect(parseAmount(input)?.amount).toBe(expected);
    });
  }
  test("no amount → null", () => {
    expect(parseAmount("just a note")).toBeNull();
  });
});

describe("maskAmount", () => {
  test("replaces the amount with <AMT>", () => {
    const p = parseAmount("Dining 400")!;
    expect(maskAmount("Dining 400", p)).toBe("Dining <AMT>");
  });
});

describe("keywordMatch", () => {
  test("classifies investments", () => {
    expect(keywordMatch("sip <AMT>")?.type).toBe("investment");
  });
  test("classifies food", () => {
    expect(keywordMatch("zomato <AMT>")?.category).toBe("Food & Dining");
  });
  test("returns null when unknown", () => {
    expect(keywordMatch("xyzzy <AMT>")).toBeNull();
  });
});

describe("ingestMessage", () => {
  test("parses amount + category + note", async () => {
    const r = await ingestMessage("swiggy dinner 540", stubProvider);
    expect(r.amount).toBe(540);
    expect(r.type).toBe("expense");
    expect(r.category).toBe("Food & Dining");
    expect(r.stage).toBe("keyword");
  });
  test("falls back to stub for unknown text", async () => {
    const r = await ingestMessage("random thing 99", stubProvider);
    expect(r.amount).toBe(99);
    expect(r.stage).toBe("ai");
    expect(r.category).toBe("Other / Misc");
  });
});

describe("AMFI NAV", () => {
  const sample = [
    "Scheme Code;ISIN;ISIN2;Scheme Name;Net Asset Value;Date",
    "",
    "PPFAS Mutual Fund",
    "122639;INF123;INF124;Parag Parikh Flexi Cap Fund - Direct Plan - Growth;91.29;07-Jul-2026",
    "120716;INF200;INF201;HSBC Nifty 50 Index Fund - Direct Growth;28.68;07-Jul-2026",
    "111111;INF300;INF302;DSP Nifty 500 Index Fund - Direct - Growth;9.70;07-Jul-2026",
    "bad;line;here",
  ].join("\n");

  test("parses data rows, skips headers", () => {
    const recs = parseAmfiNavs(sample);
    expect(recs.length).toBe(3);
    expect(recs[0]!.nav).toBeCloseTo(91.29);
  });

  test("matches whole words — '50' does not match '500'", () => {
    const recs = parseAmfiNavs(sample);
    const m = matchNav("Nifty 50 Index Fund", recs);
    expect(m?.name).toContain("Nifty 50");
  });

  test("prefers Direct + Growth", () => {
    const recs = parseAmfiNavs(sample);
    expect(matchNav("Parag Parikh Flexi Cap", recs)?.nav).toBeCloseTo(91.29);
  });
});
