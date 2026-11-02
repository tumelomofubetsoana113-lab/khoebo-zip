import { describe, expect, it } from "vitest";
import { addDecision, checkDecision, DECISIONS_KEY, loadDecisions, saveDecisions } from "@/lib/decisions";

const AT = "2026-11-02T09:00:00.000Z";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("checkDecision", () => {
  it("needs a decision and a reason of at least 10 characters", () => {
    expect(checkDecision("", "Checked the invoices", AT)).toEqual({ ok: false, error: "no_decision" });
    expect(checkDecision("approve", "Checked the invoices", AT)).toEqual({ ok: false, error: "no_decision" });
    expect(checkDecision("agree_review", "  too short  ", AT)).toEqual({ ok: false, error: "reason_too_short" });
    expect(checkDecision("agree_review", "x".repeat(501), AT)).toEqual({ ok: false, error: "reason_too_long" });
    expect(checkDecision("escalate", "  Wallet inflows look like remittances  ", AT)).toEqual({
      ok: true,
      record: { decision: "escalate", reason: "Wallet inflows look like remittances", at: AT },
    });
  });
});

describe("decision log", () => {
  it("keeps the newest first, per trader", () => {
    const first = { decision: "agree_review" as const, reason: "First look at it", at: AT };
    const second = { decision: "change_none" as const, reason: "Remittances confirmed", at: "2026-11-02T10:00:00.000Z" };
    const log = addDecision(addDecision({}, "DEMO-REVIEW", first), "DEMO-REVIEW", second);
    expect(log["DEMO-REVIEW"]).toEqual([second, first]);
    expect(log["TRD-0001"]).toBeUndefined();
  });

  it("saves and loads, and ignores broken data", () => {
    const store = memoryStore();
    expect(loadDecisions(store)).toEqual({});
    const log = addDecision({}, "DEMO-REVIEW", { decision: "escalate", reason: "Needs a supervisor", at: AT });
    expect(saveDecisions(log, store)).toBe(true);
    expect(loadDecisions(store)).toEqual(log);

    store.data.set(DECISIONS_KEY, "{not json");
    expect(loadDecisions(store)).toEqual({});
    store.data.set(DECISIONS_KEY, JSON.stringify({ "DEMO-REVIEW": [{ decision: "delete_all", reason: "x", at: AT }] }));
    expect(loadDecisions(store)).toEqual({});
    expect(loadDecisions(null)).toEqual({});
    expect(saveDecisions(log, null)).toBe(false);
  });
});
