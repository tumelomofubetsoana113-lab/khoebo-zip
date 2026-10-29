import { describe, expect, it } from "vitest";
import { TAX } from "@/config/tax";
import { emptyState, TraderStateSchema, type Entry, type TraderState } from "@/lib/state";
import { describeAction, runTool, toolDefinitions, type ChatAction, type ToolContext } from "@/lib/tools";

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
  };
}

function entry(kind: Entry["kind"], amount: number, date: string, id: string): Entry {
  return { id, kind, amount, date, source: "text", createdAt: `${date}T09:00:00.000Z` };
}

const setUp: TraderState = {
  ...emptyState(),
  onboardingDone: true,
  profile: { businessType: "Fruit and veg", district: "Maseru", registered: "yes", language: "en" },
  entries: [
    entry("sale", 1000, "2026-10-26", "a"),
    entry("purchase", 400, "2026-10-27", "b"),
    entry("sale", 350, "2026-10-28", "c"),
    entry("sale", 9000, "2026-09-15", "q3"), // last quarter
  ],
};

describe("tool definitions", () => {
  it("has a JSON schema for every tool and no $schema key", () => {
    expect(toolDefinitions.map((t) => t.name)).toEqual([
      "save_profile",
      "record_entry",
      "correct_entry",
      "get_summary",
      "get_tax_estimate",
      "prepare_return",
      "confirm_return",
      "start_payment",
      "start_registration",
      "show_reminder",
      "offer_quick_replies",
    ]);
    for (const tool of toolDefinitions) {
      expect(tool.input_schema.type).toBe("object");
      expect(tool.input_schema).not.toHaveProperty("$schema");
    }
  });
});

describe("runTool", () => {
  it("rejects unknown tools and bad input without changing state", () => {
    const unknown = runTool("set_rate", { rate: 0 }, setUp, ctx());
    expect(unknown).toMatchObject({ isError: true, state: setUp, result: { error: "unknown_tool" } });
    const bad = runTool("record_entry", { kind: "gift", amount: 5 }, setUp, ctx());
    expect(bad).toMatchObject({ isError: true, state: setUp, result: { error: "invalid_input" } });
  });
});

describe("save_profile", () => {
  it("marks onboarding done once business type, district and registration are set", () => {
    const one = runTool("save_profile", { business_type: "Street food" }, emptyState(), ctx());
    expect(one.result).toMatchObject({ onboarding_done: false, still_needed: ["district", "registered"] });
    const two = runTool("save_profile", { district: "Berea", registered: "not_sure" }, one.state, ctx());
    expect(two.result).toMatchObject({ onboarding_done: true, still_needed: [] });
    expect(two.state.profile).toEqual({
      businessType: "Street food",
      district: "Berea",
      registered: "not_sure",
      language: "en",
    });
  });

  it("only accepts the ten districts", () => {
    expect(runTool("save_profile", { district: "Gauteng" }, emptyState(), ctx()).isError).toBe(true);
  });
});

describe("record_entry", () => {
  it("records a sale with this week's totals and a receipt", () => {
    const out = runTool("record_entry", { kind: "sale", amount: 350, note: "tomatoes" }, setUp, ctx());
    expect(out.state.entries).toHaveLength(5);
    expect(out.state.entries[4]).toEqual({
      id: "id1",
      kind: "sale",
      amount: 350,
      date: TODAY,
      note: "tomatoes",
      source: "text",
      createdAt: "2026-10-29T08:00:00.000Z",
    });
    expect(out.result).toMatchObject({
      recorded: { amount: { amount: 350, text: "M350" }, date_text: "29 October 2026" },
      this_week: {
        money_in: { text: "M1,700" },
        money_out: { text: "M400" },
        profit_estimate: { text: "M1,300" },
      },
    });
    expect(out.ui).toEqual([{ type: "entry_receipt", entry: out.state.entries[4] }]);
  });

  it("works out quantity times unit price in code", () => {
    const out = runTool("record_entry", { kind: "sale", quantity: 3, unit_price: 120 }, setUp, ctx());
    expect(out.state.entries.at(-1)?.amount).toBe(360);
  });

  it("records the source of the trader's message", () => {
    const voice = { ...ctx(), source: "voice" as const };
    const out = runTool("record_entry", { kind: "purchase", amount: 900, date: "2026-10-28" }, setUp, voice);
    expect(out.state.entries.at(-1)).toMatchObject({ kind: "purchase", date: "2026-10-28", source: "voice" });
  });

  it("asks before recording more than M20,000, then records once confirmed", () => {
    const ask = runTool("record_entry", { kind: "sale", amount: 45000 }, setUp, ctx());
    expect(ask.state).toBe(setUp);
    expect(ask.isError).toBeUndefined();
    expect(ask.result).toMatchObject({ status: "needs_confirmation", amount: { text: "M45,000" } });
    const yes = runTool("record_entry", { kind: "sale", amount: 45000, confirmed: true }, setUp, ctx());
    expect(yes.state.entries.at(-1)?.amount).toBe(45000);
  });

  it("returns errors the model can explain, without changing state", () => {
    for (const input of [
      { kind: "sale", amount: 0 },
      { kind: "sale", amount: -5 },
      { kind: "sale" },
      { kind: "sale", amount: 10, date: "2026-10-30" },
      { kind: "sale", amount: 10, date: "2026-01-01" },
    ]) {
      const out = runTool("record_entry", input, setUp, ctx());
      expect(out.isError).toBe(true);
      expect(out.state).toBe(setUp);
      expect(out.result.message).toMatch(/^Not recorded/);
    }
  });
});

describe("correct_entry", () => {
  it("changes the last entry", () => {
    const withLast = runTool("record_entry", { kind: "sale", amount: 350 }, setUp, ctx()).state;
    const out = runTool("correct_entry", { entry_id: "last", new_amount: 300 }, withLast, ctx());
    expect(out.state.entries.at(-1)).toMatchObject({ id: "id1", amount: 300 });
    expect(out.result).toMatchObject({ before: { amount: { text: "M350" } }, after: { amount: { text: "M300" } } });
  });

  it("deletes an entry, as the Undo button asks", () => {
    const out = runTool("correct_entry", { entry_id: "b", delete: true }, setUp, ctx());
    expect(out.state.entries.map((e) => e.id)).toEqual(["a", "c", "q3"]);
    expect(out.result).toMatchObject({ after: "deleted", this_week: { money_out: { text: "M0" } } });
  });
});

describe("get_summary", () => {
  it("summarises this week and shows a card", () => {
    const out = runTool("get_summary", { period: "this_week" }, setUp, ctx());
    expect(out.result).toMatchObject({
      period: "This week",
      money_in: { text: "M1,350" },
      money_out: { text: "M400" },
      profit_estimate: { text: "M950" },
      entries: 3,
      days_with_no_entries: 1,
    });
    expect(out.ui).toEqual([
      {
        type: "summary_card",
        label: "This week",
        start: "2026-10-26",
        end: "2026-11-01",
        moneyIn: 1350,
        moneyOut: 400,
        profit: 950,
        entryCount: 3,
      },
    ]);
  });

  it("summarises the filing period", () => {
    const out = runTool("get_summary", { period: "filing_period" }, setUp, ctx());
    expect(out.result).toMatchObject({ period: "Filing period 2026-Q4", money_in: { text: "M1,350" } });
  });
});

describe("get_tax_estimate", () => {
  it("defaults to the current filing period and carries the placeholder note", () => {
    const out = runTool("get_tax_estimate", {}, setUp, ctx());
    expect(out.result).toMatchObject({
      period: "2026-Q4",
      turnover: { text: "M1,350" },
      rate_text: "2%",
      estimated_tax: { amount: 27, text: "M27" },
      due_date: "20 January 2027",
      placeholder_rate: true,
      note: TAX.note,
    });
    expect(out.ui).toEqual([{ type: "placeholder_note", text: TAX.note }]);
  });

  it("can estimate an earlier period but not a future one", () => {
    expect(runTool("get_tax_estimate", { period: "2026-Q3" }, setUp, ctx()).result).toMatchObject({
      turnover: { text: "M9,000" },
      estimated_tax: { text: "M180" },
    });
    expect(runTool("get_tax_estimate", { period: "2027-Q1" }, setUp, ctx()).isError).toBe(true);
    expect(runTool("get_tax_estimate", { period: "2026-10" }, setUp, ctx()).isError).toBe(true);
  });
});

describe("filing a return", () => {
  const period = "2026-Q3";
  const confirm = (turnover: number): ChatAction => ({ type: "confirm_return", period, turnover });

  it("prepares a return card without filing anything", () => {
    const out = runTool("prepare_return", { period }, setUp, ctx());
    expect(out.state).toBe(setUp);
    expect(out.ui).toEqual([
      {
        type: "return_card",
        period,
        start: "2026-07-01",
        end: "2026-09-30",
        turnover: 9000,
        taxEstimate: 180,
        dueDate: "2026-10-20",
        note: TAX.note,
      },
    ]);
  });

  it("won't file without the Confirm button's action", () => {
    for (const action of [undefined, { type: "pay_return", period } as const, confirm(9000)]) {
      const input = action?.type === "confirm_return" ? { period: "2026-Q4", turnover: 1350 } : { period, turnover: 9000 };
      const out = runTool("confirm_return", input, setUp, ctx(action));
      expect(out.isError).toBe(true);
      expect(out.state.returns).toEqual([]);
    }
  });

  it("files when the Confirm action matches, with a mock reference", () => {
    const out = runTool("confirm_return", { period, turnover: 9000 }, setUp, ctx(confirm(9000)));
    expect(out.state.returns).toEqual([
      {
        period,
        turnover: 9000,
        taxEstimate: 180,
        confirmedAt: "2026-10-29T08:00:00.000Z",
        reference: "MOCK-TEST01",
        paid: false,
      },
    ]);
    expect(out.result).toMatchObject({ filed: true, reference: "MOCK-TEST01", estimated_tax: { text: "M180" } });
    expect(TraderStateSchema.safeParse(out.state).success).toBe(true);
  });

  it("won't file if the records changed since the card was shown", () => {
    const out = runTool("confirm_return", { period, turnover: 8000 }, setUp, ctx(confirm(8000)));
    expect(out).toMatchObject({ isError: true, result: { error: "records_changed" } });
  });

  it("won't file the same period twice", () => {
    const filed = runTool("confirm_return", { period, turnover: 9000 }, setUp, ctx(confirm(9000))).state;
    expect(runTool("prepare_return", { period }, filed, ctx()).result).toMatchObject({ error: "already_filed" });
    expect(runTool("confirm_return", { period, turnover: 9000 }, filed, ctx(confirm(9000))).isError).toBe(true);
  });

  it("shows a mock payment, and marks it paid only after the Pay (demo) action", () => {
    expect(runTool("start_payment", { period }, setUp, ctx()).result).toMatchObject({ error: "not_filed" });

    const filed = runTool("confirm_return", { period, turnover: 9000 }, setUp, ctx(confirm(9000))).state;
    const card = runTool("start_payment", { period }, filed, ctx());
    expect(card.state.returns[0].paid).toBe(false);
    expect(card.ui).toEqual([
      { type: "payment_card", period, amount: 180, reference: "MOCK-TEST01", note: TAX.note },
    ]);

    const paid = runTool("start_payment", { period }, filed, ctx({ type: "pay_return", period }));
    expect(paid.state.returns[0].paid).toBe(true);
    expect(runTool("start_payment", { period }, paid.state, ctx()).result).toMatchObject({ already_paid: true });
  });
});

describe("cards with no state change", () => {
  it("shows the registration checklist", () => {
    const out = runTool("start_registration", {}, setUp, ctx());
    expect(out.ui?.[0]).toMatchObject({ type: "registration_card" });
    expect(JSON.stringify(out.ui)).toContain("to be confirmed");
  });

  it("shows the reminder for the current filing period", () => {
    const out = runTool("show_reminder", {}, setUp, ctx());
    expect(out.ui).toEqual([
      { type: "reminder_card", period: "2026-Q4", dueDate: "2027-01-20", taxEstimate: 27, note: TAX.note },
    ]);
  });

  it("limits quick replies to 6 short options", () => {
    expect(runTool("offer_quick_replies", { options: ["Sale", "Purchase"] }, setUp, ctx()).ui).toEqual([
      { type: "quick_replies", options: ["Sale", "Purchase"] },
    ]);
    expect(runTool("offer_quick_replies", { options: ["1", "2", "3", "4", "5", "6", "7"] }, setUp, ctx()).isError).toBe(true);
    expect(runTool("offer_quick_replies", { options: ["This option is far too long"] }, setUp, ctx()).isError).toBe(true);
  });
});

describe("describeAction", () => {
  it("tells the model exactly which tool a button means", () => {
    expect(describeAction({ type: "confirm_return", period: "2026-Q3", turnover: 9000 })).toContain(
      'confirm_return with period "2026-Q3" and turnover 9000',
    );
    expect(describeAction({ type: "undo_entry", entryId: "c" })).toContain('entry_id "c" and delete true');
  });
});
