import { describe, expect, it } from "vitest";
import { buildHome } from "@/lib/home";
import { emptyState, type Entry, type TraderState } from "@/lib/state";

const TODAY = "2026-11-19"; // a Thursday; the filing period is 2026-Q4 (Q3 was due 20 Oct)

function entry(kind: Entry["kind"], amount: number, date: string, id: string, extra: Partial<Entry> = {}): Entry {
  return { id, kind, amount, date, source: "text", createdAt: `${date}T09:00:00.000Z`, ...extra };
}

const trader: TraderState = {
  ...emptyState(),
  onboardingDone: true,
  profile: { name: "Palesa", businessType: "Fruit and veg", district: "Maseru", registered: "yes", language: "en" },
  entries: [
    entry("sale", 400, "2026-11-16", "a"), // Monday
    entry("sale", 150.5, "2026-11-18", "b"),
    entry("sale", 49.5, "2026-11-18", "c"),
    entry("purchase", 300, "2026-11-17", "d"),
    entry("client_money", 1000, "2026-11-19", "e"),
    entry("sale", 1000, "2026-11-03", "f"), // earlier this month
  ],
  returns: [],
};

describe("buildHome", () => {
  it("adds up this week and this month with the ledger", () => {
    const home = buildHome(trader, TODAY);
    expect(home.hasRecords).toBe(true);
    expect(home.totals.this_week).toMatchObject({ moneyIn: 600, moneyOut: 300, profit: 300, clientMoney: 1000 });
    expect(home.totals.this_month).toMatchObject({ moneyIn: 1600, moneyOut: 300, profit: 1300 });
    expect(home.byBusiness).toBeUndefined();
  });

  it("gives one bar per day, Monday to Sunday, with only sales", () => {
    const home = buildHome(trader, TODAY);
    expect(home.week.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(home.week.map((d) => d.moneyIn)).toEqual([400, 0, 200, 0, 0, 0, 0]);
    expect(home.week.map((d) => d.future)).toEqual([false, false, false, false, true, true, true]);
    expect(home.bestDay).toBe("2026-11-16");
  });

  it("has no best day in a week with no sales", () => {
    const home = buildHome({ ...trader, entries: [entry("sale", 50, "2026-11-03", "x")] }, TODAY);
    expect(home.bestDay).toBeUndefined();
  });

  it("shows the next return with the tax estimate so far", () => {
    const home = buildHome(trader, TODAY);
    expect(home.next).toEqual([
      { businessId: "main", period: "2026-Q4", dueDate: "2027-01-20", filed: false, estimate: 32 },
    ]);
  });

  it("lists a late return and leaves out the one that isn't due yet", () => {
    const withOld = { ...trader, entries: [...trader.entries, entry("sale", 500, "2026-08-10", "g")] };
    expect(buildHome(withOld, TODAY).late).toEqual([{ period: "2026-Q3", dueDate: "2026-10-20", businessId: "main" }]);
    const filed = {
      ...withOld,
      returns: [
        { period: "2026-Q3", turnover: 500, taxEstimate: 10, confirmedAt: "2026-10-10T08:00:00.000Z", reference: "MOCK-Q3", paid: true },
      ],
    };
    expect(buildHome(filed, TODAY).late).toEqual([]);
  });

  it("shows a filed return with its reference", () => {
    const filed = {
      ...trader,
      returns: [
        { period: "2026-Q4", turnover: 1600, taxEstimate: 32, confirmedAt: "2026-11-19T08:00:00.000Z", reference: "MOCK-Q4", paid: false },
      ],
    };
    expect(buildHome(filed, TODAY).next[0]).toMatchObject({ filed: true, reference: "MOCK-Q4", estimate: 32 });
  });

  it("splits totals and returns by business for a trader with several", () => {
    const several: TraderState = {
      ...trader,
      businesses: [{ id: "b2", name: "Taxi rank stall" }],
      entries: [...trader.entries, entry("sale", 250, "2026-11-19", "h", { businessId: "b2" })],
    };
    const home = buildHome(several, TODAY);
    expect(home.totals.this_week.moneyIn).toBe(850);
    expect(home.byBusiness?.this_week).toEqual([
      { name: "Fruit and veg", moneyIn: 600, moneyOut: 300, profit: 300 },
      { name: "Taxi rank stall", moneyIn: 250, moneyOut: 0, profit: 250 },
    ]);
    expect(home.next.map((r) => [r.businessName, r.estimate])).toEqual([
      ["Fruit and veg", 32],
      ["Taxi rank stall", 5],
    ]);
  });

  it("works with no records", () => {
    const home = buildHome(emptyState(), TODAY);
    expect(home.hasRecords).toBe(false);
    expect(home.late).toEqual([]);
    expect(home.next[0]).toMatchObject({ period: "2026-Q4", filed: false, estimate: 0 });
  });
});
