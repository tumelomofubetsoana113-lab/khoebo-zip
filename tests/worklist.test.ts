import { describe, expect, it } from "vitest";
import data from "@/data/worklist.json";
import testResults from "@/data/test_results.json";
import { axisMax } from "@/components/officer/EvidenceChart";
import {
  EMPTY_QUERY,
  filterRows,
  monthShort,
  nextPage,
  PAGE_SIZE,
  parseQuery,
  queryString,
  RULE_ACTIONS,
  sharePct,
  sortRows,
  toggleAction,
  toRow,
  windowLabel,
  WorklistSchema,
  type WorklistRow,
} from "@/lib/worklist";

const worklist = WorklistSchema.parse(data);
const find = (id: string) => worklist.traders.find((t) => t.id === id)!;

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [k, ...keysDeep(v)]);
  }
  return [];
}

describe("data/worklist.json", () => {
  it("has no hidden_ field anywhere", () => {
    expect(keysDeep(data).filter((k) => k.startsWith("hidden_"))).toEqual([]);
    expect(keysDeep(testResults).filter((k) => k.startsWith("hidden_"))).toEqual([]);
  });

  it("refuses an unexpected field", () => {
    const leaky = structuredClone(data) as { traders: Record<string, unknown>[] };
    leaky.traders[0].hidden_situation = "undeclared";
    expect(WorklistSchema.safeParse(leaky).success).toBe(false);
  });

  it("holds 300 simulated traders plus the three demo cases", () => {
    expect(worklist.simulated).toBe(300);
    expect(worklist.traders).toHaveLength(303);
    expect(worklist.pinned).toEqual(["072919658330", "350832593215", "846476991325"]);
    expect(new Set(worklist.traders.map((t) => t.id)).size).toBe(303);
  });

  it("counts every trader once", () => {
    for (const action of RULE_ACTIONS) {
      expect(worklist.counts[action]).toBe(worklist.traders.filter((t) => t.action === action).length);
    }
  });

  it("covers May to October 2026", () => {
    expect(worklist.window).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(windowLabel(worklist.window)).toBe("May to Oct 2026");
    for (const t of worklist.traders) expect(t.months.map((m) => m.month)).toEqual(worklist.window);
  });

  it("is already in the default order", () => {
    const rows = worklist.traders.map(toRow);
    expect(sortRows(rows).map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });
});

describe("the three demo cases", () => {
  it("ordinary: no action, declarations in line", () => {
    const t = find("072919658330");
    expect(t.action).toBe("NO ACTION");
    expect(t.label).toBe("Fruit and vegetable seller, Maseru");
    expect(t.reasons.at(-1)).toMatch(/in line with the available evidence/);
    expect(t.metrics.nilReturns).toBe(0);
  });

  it("seasonal: nil months match months with no evidence, no field follow-up", () => {
    const t = find("350832593215");
    expect(["NO ACTION", "AUTOMATED CHECK-IN"]).toContain(t.action);
    expect(t.district).toBe("Mokhotlong");
    const nil = t.months.filter((m) => m.filed && m.declared === 0);
    expect(nil.length).toBeGreaterThan(0);
    for (const m of nil) expect(m.evidenceMin).toBe(0);
    expect(t.reasons.join(" ")).toMatch(/Nil months match months with no trading evidence/);
  });

  it("review: human review with the mobile money guardrail", () => {
    const t = find("846476991325");
    expect(t.action).toBe("HUMAN REVIEW");
    expect(t.district).toBe("Berea");
    expect(t.metrics.declared).toBe(0);
    expect(t.months.every((m) => m.purchases === 0)).toBe(true);
    expect(t.reasons.join(" ")).toMatch(/remittances or family support/);
  });
});

const row = (over: Partial<WorklistRow>): WorklistRow => ({
  id: "100000000001",
  label: null,
  sector: "Street food",
  district: "Maseru",
  action: "none",
  declared: 0,
  evidenceMin: 0,
  evidenceMonths: 0,
  nilReturns: 0,
  ...over,
});

describe("filters", () => {
  const rows = [
    row({ id: "100000000001", action: "followup", district: "Berea" }),
    row({ id: "100000000002", action: "review", sector: "Hair salon" }),
    row({ id: "846476991325", label: "General dealer, Berea", action: "review", district: "Berea" }),
    row({ id: "699995807895", action: "none" }),
  ];

  it("reads and writes the URL query", () => {
    const q = parseQuery(new URLSearchParams("action=review,bogus,followup&district=Berea&q=trd"));
    expect(q).toEqual({ actions: ["followup", "review"], district: "Berea", sector: "", search: "trd" });
    expect(queryString(q)).toBe("?action=followup%2Creview&district=Berea&q=trd");
    expect(queryString(EMPTY_QUERY)).toBe("");
    expect(parseQuery(new URLSearchParams(queryString(q).slice(1)))).toEqual(q);
  });

  it("filters by action, district, sector and ID", () => {
    const ids = (q: Partial<typeof EMPTY_QUERY>) => filterRows(rows, { ...EMPTY_QUERY, ...q }).map((r) => r.id);
    expect(ids({})).toHaveLength(4);
    expect(ids({ actions: ["review"] })).toEqual(["100000000002", "846476991325"]);
    expect(ids({ actions: ["review"], district: "Berea" })).toEqual(["846476991325"]);
    expect(ids({ sector: "Hair salon" })).toEqual(["100000000002"]);
    expect(ids({ search: " 99580 " })).toEqual(["699995807895"]);
    expect(ids({ search: "general dealer" })).toEqual(["846476991325"]);
  });

  it("toggles an action on and off, keeping the action order", () => {
    const on = toggleAction(toggleAction(EMPTY_QUERY, "none"), "followup");
    expect(on.actions).toEqual(["followup", "none"]);
    expect(toggleAction(on, "followup").actions).toEqual(["none"]);
  });

  it("sorts by action, then the gap between evidence and declared", () => {
    const sorted = sortRows([
      row({ id: "A", action: "none", evidenceMin: 9000 }),
      row({ id: "B", action: "followup", evidenceMin: 1000 }),
      row({ id: "C", action: "followup", evidenceMin: 5000, declared: 1000 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["C", "B", "A"]);
  });
});

describe("display helpers", () => {
  it("names months and shares", () => {
    expect(monthShort("2026-09")).toBe("Sep");
    expect(sharePct(35, 303)).toBe(12);
    expect(sharePct(0, 0)).toBe(0);
  });

  it("rounds the chart axis up", () => {
    expect(axisMax(0)).toBe(1000);
    expect(axisMax(13_780)).toBe(20_000);
    expect(axisMax(3_290)).toBe(4_000);
    expect(axisMax(74_430)).toBe(80_000);
  });
});

describe("paging", () => {
  it("adds a full page, or whatever is left", () => {
    expect(PAGE_SIZE).toBe(50);
    expect(nextPage(50, 303)).toBe(50);
    expect(nextPage(300, 303)).toBe(3);
    expect(nextPage(303, 303)).toBe(0);
    expect(nextPage(35, 35)).toBe(0);
  });
});
