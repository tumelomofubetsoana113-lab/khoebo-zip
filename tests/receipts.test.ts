import { describe, expect, it } from "vitest";
import cases from "./receipt-eval/cases.json";
import { buttonKey } from "@/lib/chat";
import { checkLekukaInvoice } from "@/lib/lekuka";
import { attachmentKind, attachmentLooksValid, ReceiptAttachmentSchema, scaleToFit } from "@/lib/receipts";
import { emptyState, TraderStateSchema, type TraderState } from "@/lib/state";
import { runTool, type ToolContext } from "@/lib/tools";

const TODAY = "2026-11-05";

function ctx(extra: Partial<ToolContext> = {}): ToolContext {
  let id = 0;
  return {
    today: TODAY,
    now: "2026-11-05T08:00:00.000Z",
    newId: () => `id${++id}`,
    newReference: () => "MOCK-TEST01",
    source: "text",
    hasAttachment: true,
    ...extra,
  };
}

const state: TraderState = { ...emptyState(), onboardingDone: true };

const LEKUKA_RECEIPT = {
  supplier: "Sample Wholesalers (Pty) Ltd",
  date: "2026-11-03",
  total: 1113,
  items: "maize meal, cooking oil",
  invoice_number: "1042",
  device_id: "470",
  verification_code: "A1C4-52D8-07B9-3E61",
};

// The save action the receipt card would send.
function saveAction(receiptId = "id1", total = 1113, date = "2026-11-03") {
  return {
    type: "confirm_receipt" as const,
    receiptId,
    total,
    date,
    note: "Sample Wholesalers (Pty) Ltd · maize meal, cooking oil",
    invoiceNumber: "1042",
    deviceId: "470",
    verificationCode: "A1C4-52D8-07B9-3E61",
  };
}

describe("the simulated Lekuka check", () => {
  const printed = { total: 1113, date: "2026-11-03" };

  it("passes an invoice on record that matches the receipt", () => {
    const fields = { invoiceNumber: "1042", deviceId: "470", verificationCode: "A1C4-52D8-07B9-3E61" };
    expect(checkLekukaInvoice(fields, printed)).toEqual({
      status: "verified",
      simulated: true,
      seller: "Sample Wholesalers (Pty) Ltd",
    });
  });

  it("isn't thrown by spaces or lower case in a code", () => {
    expect(checkLekukaInvoice({ verificationCode: " a1c4-52d8-07b9-3e61 " }, printed).status).toBe("verified");
  });

  it("says what differs when the receipt doesn't match the record", () => {
    const out = checkLekukaInvoice({ verificationCode: "A1C4-52D8-07B9-3E61" }, { total: 1950, date: "2026-11-01" });
    expect(out.status).toBe("mismatch");
    expect(out.differences).toEqual(["date", "total"]);
  });

  it("handles a code that isn't on record, and a receipt with no code", () => {
    expect(checkLekukaInvoice({ verificationCode: "0000-0000-0000-0000" }, printed).status).toBe("not_found");
    expect(checkLekukaInvoice({}, printed).status).toBe("no_code");
  });

  it("gives the expected result for every sample receipt with a Lekuka code", () => {
    // Keeps scripts/make_sample_receipts.py and lib/lekuka.ts in step.
    const samples = cases.flatMap((c) => {
      const e = c.expect as { printed?: Record<string, string>; total?: number; date?: string; lekuka?: string };
      return e.printed ? [{ name: c.name, ...e }] : [];
    });
    expect(samples).toHaveLength(8);
    for (const s of samples) {
      const out = checkLekukaInvoice(s.printed!, { total: s.total!, date: s.date! });
      expect(out.status, s.name).toBe(s.lekuka);
    }
  });
});

describe("read_receipt", () => {
  it("shows a card and saves nothing", () => {
    const out = runTool("read_receipt", LEKUKA_RECEIPT, state, ctx());
    expect(out.state).toBe(state);
    expect(out.result).toMatchObject({
      status: "shown",
      total: { amount: 1113, text: "M1,113" },
      date_text: "3 November 2026",
      lekuka: { status: "verified", simulated: true },
    });
    expect(out.ui?.[0]).toMatchObject({ type: "receipt_card", total: 1113, lekuka: "verified", dateAssumed: false });
  });

  it("only works when a receipt really is attached", () => {
    const out = runTool("read_receipt", LEKUKA_RECEIPT, state, ctx({ hasAttachment: false }));
    expect(out.isError).toBe(true);
    expect(out.result.error).toBe("no_receipt");
    expect(out.ui).toBeUndefined();
  });

  it("shows no card without a readable total, and never works one out", () => {
    for (const total of [undefined, 0, -20]) {
      const out = runTool("read_receipt", { supplier: "Sample", date: "2026-11-03", total }, state, ctx());
      expect(out.result.status).toBe("total_unclear");
      expect(out.ui).toBeUndefined();
    }
  });

  it("uses today when no date is printed, and says so", () => {
    const out = runTool("read_receipt", { total: 480 }, state, ctx());
    expect(out.result).toMatchObject({ date: TODAY, date_assumed: true });
    expect(out.ui?.[0]).toMatchObject({ date: TODAY, dateAssumed: true });
  });

  it("shows no card for a date it can't use", () => {
    for (const [date, reason] of [
      ["2026-07-14", "date_too_old"],
      ["2026-12-25", "date_in_future"],
      ["14 July", "invalid_date"],
    ]) {
      const out = runTool("read_receipt", { total: 398, date }, state, ctx());
      expect(out.result).toMatchObject({ status: "date_problem", reason });
      expect(out.ui).toBeUndefined();
    }
  });

  it("asks nothing extra about a large amount, because the card shows it", () => {
    const out = runTool("read_receipt", { total: 45000, date: "2026-11-03" }, state, ctx());
    expect(out.result.status).toBe("shown");
  });

  it("won't show an invoice that's already saved", () => {
    const shown = runTool("read_receipt", LEKUKA_RECEIPT, state, ctx());
    const saved = runTool("save_receipt", { receipt_id: "id1" }, shown.state, ctx({ action: saveAction() }));
    const again = runTool("read_receipt", LEKUKA_RECEIPT, saved.state, ctx());
    expect(again.result.status).toBe("already_saved");
    expect(again.ui).toBeUndefined();
  });

  it("warns, but lets the trader decide, when a slip with no number may be a second copy", () => {
    const action = { ...saveAction("r1", 632.4, "2026-11-04"), invoiceNumber: null, deviceId: null, verificationCode: null };
    const saved = runTool("save_receipt", { receipt_id: "r1" }, state, ctx({ action }));
    const again = runTool("read_receipt", { total: 632.4, date: "2026-11-04" }, saved.state, ctx());
    expect(again.result).toMatchObject({ status: "shown", possible_duplicate: true });
    expect(again.ui?.[0]).toMatchObject({ possibleDuplicate: true });
  });
});

describe("save_receipt", () => {
  it("saves a purchase only after the Save button", () => {
    const out = runTool("save_receipt", { receipt_id: "id1" }, state, ctx({ action: saveAction() }));
    expect(out.state.entries).toEqual([
      {
        id: "id1",
        kind: "purchase",
        amount: 1113,
        date: "2026-11-03",
        note: "Sample Wholesalers (Pty) Ltd · maize meal, cooking oil",
        source: "receipt",
        createdAt: "2026-11-05T08:00:00.000Z",
        receipt: { invoiceNumber: "1042", deviceId: "470", lekuka: "verified" },
      },
    ]);
    expect(out.ui?.[0]).toMatchObject({ type: "entry_receipt" });
    expect(TraderStateSchema.safeParse(out.state).success).toBe(true);
  });

  it("refuses a typed message or a different card", () => {
    const typed = runTool("save_receipt", { receipt_id: "id1" }, state, ctx());
    expect(typed.result.error).toBe("needs_button");
    expect(typed.state).toBe(state);
    const other = runTool("save_receipt", { receipt_id: "other" }, state, ctx({ action: saveAction() }));
    expect(other.result.error).toBe("needs_button");
  });

  it("won't save the same invoice twice, even from an old card", () => {
    const first = runTool("save_receipt", { receipt_id: "id1" }, state, ctx({ action: saveAction() }));
    const second = runTool("save_receipt", { receipt_id: "id1" }, first.state, ctx({ action: saveAction() }));
    expect(second.result.error).toBe("already_saved");
    expect(second.state.entries).toHaveLength(1);
  });

  it("saves a large amount without a second question, since the trader saw it on the card", () => {
    const out = runTool("save_receipt", { receipt_id: "id1" }, state, ctx({ action: saveAction("id1", 24680) }));
    expect(out.state.entries[0].amount).toBe(24680);
  });

  it("counts the purchase in money out and leaves the tax estimate alone", () => {
    const saved = runTool("save_receipt", { receipt_id: "id1" }, state, ctx({ action: saveAction() })).state;
    const week = runTool("get_summary", { period: "this_week" }, saved, ctx());
    expect(week.result).toMatchObject({ money_out: { amount: 1113 }, money_in: { amount: 0 } });
    const tax = runTool("get_tax_estimate", {}, saved, ctx());
    expect(tax.result).toMatchObject({ turnover: { amount: 0 }, estimated_tax: { amount: 0 } });
  });

  it("keeps older saved records valid", () => {
    const older = { id: "a", kind: "sale", amount: 10, date: TODAY, source: "text", createdAt: "2026-11-05T08:00:00.000Z" };
    expect(TraderStateSchema.safeParse({ ...state, entries: [older] }).success).toBe(true);
  });
});

describe("receipt files", () => {
  it("accepts a file only if it starts the way its type says", () => {
    expect(attachmentLooksValid({ mediaType: "image/jpeg", data: "/9j/4AAQSkZJRg==" })).toBe(true);
    expect(attachmentLooksValid({ mediaType: "application/pdf", data: "JVBERi0xLjQK" })).toBe(true);
    expect(attachmentLooksValid({ mediaType: "application/pdf", data: "/9j/4AAQSkZJRg==" })).toBe(false);
    expect(attachmentLooksValid({ mediaType: "image/png", data: "PHNjcmlwdD4=" })).toBe(false);
  });

  it("rejects other file types and oversized files", () => {
    expect(ReceiptAttachmentSchema.safeParse({ mediaType: "text/html", data: "PGh0bWw+AAAAAAAAAAAA" }).success).toBe(false);
    expect(ReceiptAttachmentSchema.safeParse({ mediaType: "image/jpeg", data: "a".repeat(2_800_001) }).success).toBe(false);
  });

  it("tells photos and PDFs apart", () => {
    expect(attachmentKind({ mediaType: "application/pdf", data: "" })).toBe("pdf");
    expect(attachmentKind({ mediaType: "image/jpeg", data: "" })).toBe("photo");
  });

  it("shrinks big photos to fit, keeping their shape, and leaves small ones alone", () => {
    expect(scaleToFit(3000, 4000)).toEqual({ width: 1176, height: 1568 });
    expect(scaleToFit(4000, 1000)).toEqual({ width: 1568, height: 392 });
    expect(scaleToFit(576, 1100)).toEqual({ width: 576, height: 1100 });
  });
});

describe("receipt buttons", () => {
  it("can each be tapped once per card", () => {
    expect(buttonKey(saveAction("r1"))).toBe("confirm_receipt:r1");
    expect(buttonKey({ type: "change_receipt", receiptId: "r1", total: 1, date: TODAY })).toBe("change_receipt:r1");
  });
});
