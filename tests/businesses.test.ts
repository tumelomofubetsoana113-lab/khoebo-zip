import { describe, expect, it } from "vitest";
import { businessList, MAIN_BUSINESS, resolveBusiness } from "@/lib/businesses";
import { buttonKey } from "@/lib/chat";
import { demoMultiState } from "@/lib/demo";
import { contextBlock } from "@/lib/prompt";
import { emptyState, TraderStateSchema, type Entry, type TraderState } from "@/lib/state";
import { buildStatement, returnsToFile, statementCsv, statementPath } from "@/lib/statement";
import { describeAction, runTool, type ChatAction, type ToolContext } from "@/lib/tools";

const TODAY = "2026-10-29"; // Thursday; current filing period 2026-Q4

function ctx(action?: ChatAction): ToolContext {
  let n = 0;
  return {
    today: TODAY,
    now: "2026-10-29T08:00:00.000Z",
    newId: () => `id${++n}`,
    newReference: () => "MOCK-TEST01",
    source: "text",
    action,
    hasAttachment: true,
  };
}

function entry(kind: Entry["kind"], amount: number, date: string, id: string, businessId?: string): Entry {
  return { id, kind, amount, date, source: "text", createdAt: `${date}T09:00:00.000Z`, ...(businessId ? { businessId } : {}) };
}

const single: TraderState = {
  ...emptyState(),
  onboardingDone: true,
  profile: { businessType: "Spaza / general dealer", district: "Maseru", registered: "yes", language: "en" },
  entries: [entry("sale", 1000, "2026-10-26", "a"), entry("purchase", 400, "2026-10-27", "b")],
};

// Two spaza shops and a salon: the first business plus two more.
const multi: TraderState = {
  ...single,
  profile: { ...single.profile, businessName: "Town shop" },
  businesses: [
    { id: "b2", name: "Ha Thetsane shop", type: "Spaza / general dealer", district: "Maseru" },
    { id: "b3", name: "Salon", type: "Hair or beauty", district: "Maseru" },
  ],
  entries: [
    entry("sale", 1000, "2026-10-26", "a"),
    entry("purchase", 400, "2026-10-27", "b"),
    entry("sale", 600, "2026-10-26", "c", "b2"),
    entry("sale", 300, "2026-10-28", "d", "b3"),
    entry("purchase", 100, "2026-10-28", "e", "b3"),
  ],
};

describe("saved state", () => {
  it("still accepts a trader saved before businesses existed", () => {
    expect(TraderStateSchema.safeParse(single).success).toBe(true);
    expect(TraderStateSchema.safeParse(multi).success).toBe(true);
  });

  it("lists the first business from the profile", () => {
    expect(businessList(single)).toEqual([
      { id: MAIN_BUSINESS, name: "Spaza / general dealer", type: "Spaza / general dealer", district: "Maseru" },
    ]);
    expect(businessList(multi).map((b) => b.name)).toEqual(["Town shop", "Ha Thetsane shop", "Salon"]);
  });
});

describe("resolveBusiness", () => {
  it("always means the one business when there is only one", () => {
    expect(resolveBusiness(single)).toMatchObject({ ok: true, business: { id: "main" } });
    expect(resolveBusiness(single, "anything at all")).toMatchObject({ ok: true, business: { id: "main" } });
  });

  it("needs a business when there are several, found by id, name or a unique type", () => {
    expect(resolveBusiness(multi)).toEqual({ ok: false, error: "needs_business" });
    expect(resolveBusiness(multi, "b2")).toMatchObject({ ok: true, business: { id: "b2" } });
    expect(resolveBusiness(multi, "main")).toMatchObject({ ok: true, business: { id: "main" } });
    expect(resolveBusiness(multi, "  salon ")).toMatchObject({ ok: true, business: { id: "b3" } });
    expect(resolveBusiness(multi, "Hair or beauty")).toMatchObject({ ok: true, business: { id: "b3" } });
    // Two shops share the type, so it doesn't say which.
    expect(resolveBusiness(multi, "Spaza / general dealer")).toEqual({ ok: false, error: "business_not_found" });
  });
});

describe("save_business", () => {
  it("adds a branch, with the profile's district by default", () => {
    const out = runTool("save_business", { name: "Ha Thetsane shop", business_type: "Spaza / general dealer" }, single, ctx());
    expect(out.state.businesses).toEqual([
      { id: "id1", name: "Ha Thetsane shop", type: "Spaza / general dealer", district: "Maseru" },
    ]);
    expect(out.result.message).toContain('business_id "main"');
    expect(out.state.entries).toBe(single.entries); // old records stay with the first business
  });

  it("renames the first business, and refuses a name already used", () => {
    const named = runTool("save_business", { business_id: "main", name: "Town shop" }, single, ctx());
    expect(named.state.profile.businessName).toBe("Town shop");
    expect(runTool("save_business", { name: "salon" }, multi, ctx())).toMatchObject({
      isError: true,
      result: { error: "name_taken" },
    });
  });
});

describe("recording for one of several businesses", () => {
  it("asks which business and records nothing when none is given", () => {
    const out = runTool("record_entry", { kind: "sale", amount: 250 }, multi, ctx());
    expect(out.result).toMatchObject({ status: "needs_business", businesses: ["Town shop", "Ha Thetsane shop", "Salon"] });
    expect(out.state).toBe(multi);
  });

  it("records against the business, with that business's week totals", () => {
    const out = runTool("record_entry", { kind: "sale", amount: 250, business: "b3" }, multi, ctx());
    expect(out.state.entries.at(-1)).toMatchObject({ amount: 250, businessId: "b3" });
    expect(out.result).toMatchObject({ business: "Salon", week_of_entry: { money_in: { amount: 550 } } });
    const main = runTool("record_entry", { kind: "sale", amount: 50, business: "main" }, multi, ctx());
    expect(main.state.entries.at(-1)).not.toHaveProperty("businessId");
  });

  it("records exactly as before for a trader with one business", () => {
    const out = runTool("record_entry", { kind: "sale", amount: 250 }, single, ctx());
    expect(out.state.entries.at(-1)).not.toHaveProperty("businessId");
    expect(out.result).not.toHaveProperty("business");
  });
});

describe("summaries and statements", () => {
  it("gives the totals with a line per business, or one business", () => {
    const all = runTool("get_summary", { period: "this_week" }, multi, ctx());
    expect(all.ui?.[0]).toMatchObject({
      type: "summary_card",
      moneyIn: 1900,
      byBusiness: [
        { name: "Town shop", moneyIn: 1000, moneyOut: 400, profit: 600 },
        { name: "Ha Thetsane shop", moneyIn: 600, moneyOut: 0, profit: 600 },
        { name: "Salon", moneyIn: 300, moneyOut: 100, profit: 200 },
      ],
    });
    const salon = runTool("get_summary", { period: "this_week", business: "Salon" }, multi, ctx());
    expect(salon.ui?.[0]).toMatchObject({ label: "This week · Salon", moneyIn: 300 });
    expect(salon.ui?.[0]).not.toHaveProperty("byBusiness");
    expect(runTool("get_summary", { period: "this_week" }, single, ctx()).ui?.[0]).not.toHaveProperty("byBusiness");
  });

  it("makes a statement for all businesses or one, with a business column in the CSV", () => {
    const all = buildStatement(multi, "2026-10", TODAY);
    expect(all.byBusiness?.map((b) => b.moneyIn)).toEqual([1000, 600, 300]);
    expect(statementCsv(all)).toContain("Date,Business,Type,Details");
    expect(statementCsv(all)).toContain("2026-10-28,Salon,Sale,,300.00");

    const salon = buildStatement(multi, "2026-10", TODAY, "b3");
    expect(salon.summary).toMatchObject({ moneyIn: 300, moneyOut: 100 });
    expect(salon.businessName).toBe("Salon");
    expect(salon.details).toEqual([
      { label: "Business", value: "Salon" },
      { label: "Type of business", value: "Hair or beauty" },
      { label: "District", value: "Maseru" },
    ]);
    expect(all.details).toEqual([{ label: "Businesses", value: "Town shop, Ha Thetsane shop, Salon" }]);
    expect(statementCsv(all)).toContain('Businesses,"Town shop, Ha Thetsane shop, Salon"');
    expect(statementPath("2026-10", "b3")).toBe("/trader/statement?period=2026-10&business=b3");

    const tool = runTool("get_statement", { business: "b3" }, multi, ctx());
    expect(tool.ui?.[0]).toMatchObject({ type: "statement_card", businessId: "b3", businessName: "Salon", moneyIn: 300 });
    expect(statementCsv(buildStatement(single, "2026-10", TODAY))).toContain("Date,Type,Details");
  });
});

describe("a return for each business", () => {
  it("gives each business its own estimate", () => {
    const out = runTool("get_tax_estimate", {}, multi, ctx());
    expect(out.result.estimates).toMatchObject([
      { business: "Town shop", turnover: { amount: 1000 }, estimated_tax: { amount: 20 } },
      { business: "Ha Thetsane shop", turnover: { amount: 600 }, estimated_tax: { amount: 12 } },
      { business: "Salon", turnover: { amount: 300 }, estimated_tax: { amount: 6 } },
    ]);
  });

  it("asks which business before preparing a return", () => {
    expect(runTool("prepare_return", {}, multi, ctx()).result).toMatchObject({ status: "needs_business" });
    const card = runTool("prepare_return", { business: "b2" }, multi, ctx()).ui?.[0];
    expect(card).toMatchObject({ type: "return_card", turnover: 600, businessId: "b2", businessName: "Ha Thetsane shop" });
    const main = runTool("prepare_return", { business: "main" }, multi, ctx()).ui?.[0];
    expect(main).toMatchObject({ turnover: 1000, businessName: "Town shop" });
    expect(main).not.toHaveProperty("businessId");
  });

  it("files only from that business's Confirm button, and each business separately", () => {
    const tap: ChatAction = { type: "confirm_return", period: "2026-Q4", turnover: 600, businessId: "b2" };
    const filed = runTool("confirm_return", { period: "2026-Q4", turnover: 600, business: "b2" }, multi, ctx(tap));
    expect(filed.state.returns).toEqual([
      expect.objectContaining({ period: "2026-Q4", turnover: 600, taxEstimate: 12, businessId: "b2" }),
    ]);
    // The same period is still open for the other businesses.
    expect(runTool("prepare_return", { business: "main" }, filed.state, ctx()).ui?.[0]).toMatchObject({ turnover: 1000 });
    expect(runTool("prepare_return", { business: "b2" }, filed.state, ctx()).result).toMatchObject({ error: "already_filed" });

    // A typed "confirm", or a button for a different business, files nothing.
    expect(runTool("confirm_return", { period: "2026-Q4", turnover: 600, business: "b2" }, multi, ctx())).toMatchObject({
      result: { error: "needs_button" },
    });
    expect(
      runTool("confirm_return", { period: "2026-Q4", turnover: 600, business: "b3" }, multi, ctx(tap)),
    ).toMatchObject({ result: { error: "needs_button" } });

    // Paying is per business too.
    const pay: ChatAction = { type: "pay_return", period: "2026-Q4", businessId: "b2" };
    const paid = runTool("start_payment", { period: "2026-Q4", business: "b2" }, filed.state, ctx(pay));
    expect(paid.state.returns[0].paid).toBe(true);
    expect(runTool("start_payment", { period: "2026-Q4", business: "main" }, filed.state, ctx()).result).toMatchObject({
      error: "not_filed",
    });
  });

  it("lists filing and paying for each business, and a reminder each", () => {
    const items = (runTool("show_obligations", {}, multi, ctx()).ui?.[0] as { items: { text: string }[] }).items;
    expect(items.map((i) => i.text)).toEqual([
      "Registered with RSL",
      "Keep a record of your sales: 5 entries so far",
      "Town shop: file the return for 2026-Q4 by 20 January 2027",
      "Town shop: pay the estimated M20 by 20 January 2027",
      "Ha Thetsane shop: file the return for 2026-Q4 by 20 January 2027",
      "Ha Thetsane shop: pay the estimated M12 by 20 January 2027",
      "Salon: file the return for 2026-Q4 by 20 January 2027",
      "Salon: pay the estimated M6 by 20 January 2027",
    ]);
    const reminders = runTool("show_reminder", {}, multi, ctx()).ui ?? [];
    expect(reminders.map((b) => b.type === "reminder_card" && [b.businessName, b.taxEstimate])).toEqual([
      ["Town shop", 20],
      ["Ha Thetsane shop", 12],
      ["Salon", 6],
    ]);
  });
});

describe("receipts for one of several businesses", () => {
  const receipt = { supplier: "Wholesaler", date: "2026-10-28", total: 900 };

  it("offers a Save button for each business, and saves to the one tapped", () => {
    const card = runTool("read_receipt", receipt, multi, ctx()).ui?.[0];
    expect(card).toMatchObject({
      type: "receipt_card",
      businesses: [
        { id: "main", name: "Town shop" },
        { id: "b2", name: "Ha Thetsane shop" },
        { id: "b3", name: "Salon" },
      ],
    });
    const tap: ChatAction = {
      type: "confirm_receipt",
      receiptId: "id1",
      total: 900,
      date: "2026-10-28",
      note: null,
      invoiceNumber: null,
      deviceId: null,
      verificationCode: null,
      businessId: "b2",
    };
    const saved = runTool("save_receipt", { receipt_id: "id1" }, multi, ctx(tap));
    expect(saved.state.entries.at(-1)).toMatchObject({ kind: "purchase", amount: 900, businessId: "b2" });
  });

  it("shows the named business, and nothing extra for one business", () => {
    expect(runTool("read_receipt", { ...receipt, business: "Salon" }, multi, ctx()).ui?.[0]).toMatchObject({
      businessId: "b3",
      businessName: "Salon",
    });
    const card = runTool("read_receipt", receipt, single, ctx()).ui?.[0];
    expect(card).not.toHaveProperty("businesses");
    expect(card).not.toHaveProperty("businessName");
  });
});

describe("buttons and context", () => {
  it("keeps the old button keys and tells businesses apart", () => {
    expect(buttonKey({ type: "confirm_return", period: "2026-Q4", turnover: 1 })).toBe("confirm_return:2026-Q4");
    expect(buttonKey({ type: "confirm_return", period: "2026-Q4", turnover: 1, businessId: "b2" })).toBe(
      "confirm_return:2026-Q4:b2",
    );
    expect(describeAction({ type: "confirm_return", period: "2026-Q4", turnover: 600, businessId: "b2" })).toContain(
      'turnover 600 and business "b2"',
    );
  });

  it("lists the businesses for the model only when there are several", () => {
    expect(contextBlock(multi, TODAY)).toContain("  - id b3: Salon (Hair or beauty, Maseru)");
    expect(contextBlock(single, TODAY)).not.toContain("Businesses");
  });
});

describe("demo trader with three businesses", () => {
  it("is valid, repeatable and has records for each business", () => {
    const state = demoMultiState("2026-11-19");
    expect(TraderStateSchema.safeParse(state).success).toBe(true);
    expect(demoMultiState("2026-11-19")).toEqual(state);
    const ids = new Set(state.entries.map((e) => e.businessId ?? "main"));
    expect([...ids].sort()).toEqual(["b-salon", "b-thetsane", "main"]);
    expect(businessList(state).map((b) => b.name)).toEqual(["Town shop", "Ha Thetsane shop", "Salon"]);
  });
});

describe("statements wait for each business's due returns", () => {
  it("only asks for returns of businesses with records in that period", () => {
    const sept: TraderState = {
      ...multi,
      entries: [...multi.entries, entry("sale", 200, "2026-09-20", "s1", "b3")],
    };
    expect(returnsToFile(sept, "2026-09", TODAY)).toEqual([
      { period: "2026-Q3", dueDate: "2026-10-20", businessId: "b3", businessName: "Salon" },
    ]);
    expect(returnsToFile(sept, "2026-09", TODAY, "b2")).toEqual([]);
    const filed: TraderState = {
      ...sept,
      returns: [{ period: "2026-Q3", turnover: 200, taxEstimate: 4, confirmedAt: "2026-10-02T08:00:00.000Z", reference: "MOCK-S", paid: false, businessId: "b3" }],
    };
    expect(returnsToFile(filed, "2026-09", TODAY)).toEqual([]);
  });
});
