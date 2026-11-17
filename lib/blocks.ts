// Button actions and UI blocks: the shapes shared by the chat API and the
// browser. Kept apart from lib/tools.ts so the page doesn't load the handlers.

import { z } from "zod";
import type { Entry } from "./state";

// Button actions. Taps that change records arrive as structured actions,
// never as free text, so a trader can't confirm a return by accident.

export const ChatActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("confirm_return"), period: z.string().max(10), turnover: z.number() }),
  z.object({ type: z.literal("change_return"), period: z.string().max(10) }),
  z.object({ type: z.literal("pay_return"), period: z.string().max(10) }),
  z.object({ type: z.literal("file_now"), period: z.string().max(10) }),
  z.object({ type: z.literal("undo_entry"), entryId: z.string().max(32) }),
  z.object({ type: z.literal("simulate_reminder") }),
  z.object({
    type: z.literal("confirm_receipt"),
    receiptId: z.string().max(32),
    total: z.number(),
    date: z.iso.date(),
    note: z.string().max(100).nullable(),
    invoiceNumber: z.string().max(60).nullable(),
    deviceId: z.string().max(60).nullable(),
    verificationCode: z.string().max(60).nullable(),
  }),
  z.object({
    type: z.literal("change_receipt"),
    receiptId: z.string().max(32),
    total: z.number(),
    date: z.iso.date(),
  }),
]);

export type ChatAction = z.infer<typeof ChatActionSchema>;

// UI blocks the browser renders alongside the reply. Amounts are numbers;
// the browser formats them with formatMoney.

export type UiBlock =
  | { type: "quick_replies"; options: string[] }
  | { type: "entry_receipt"; entry: Entry }
  | {
      type: "summary_card";
      label: string;
      start: string;
      end: string;
      moneyIn: number;
      moneyOut: number;
      clientMoney?: number; // a runner's client money, shown apart when above zero
      profit: number;
      entryCount: number;
    }
  | {
      type: "return_card";
      period: string;
      start: string;
      end: string;
      turnover: number;
      taxEstimate: number;
      dueDate: string;
      note: string | null;
    }
  | { type: "payment_card"; period: string; amount: number; reference: string; note: string | null }
  | {
      type: "registration_card";
      checklist: string[];
      handoff: string;
      links?: { label: string; href: string }[]; // missing in chats saved before 17 Nov 2026
      officerNote?: string;
    }
  | { type: "obligations_card"; items: { text: string; done: boolean }[]; note: string | null }
  | { type: "reminder_card"; period: string; dueDate: string; taxEstimate: number; note: string | null }
  | { type: "placeholder_note"; text: string }
  | {
      type: "receipt_card";
      receiptId: string;
      supplier: string | null;
      date: string;
      dateAssumed: boolean; // no clear date on the receipt, so today was used
      total: number;
      note: string | null;
      invoiceNumber: string | null;
      deviceId: string | null;
      verificationCode: string | null;
      lekuka: "verified" | "mismatch" | "not_found" | "no_code";
      possibleDuplicate: boolean;
    };

// What the browser is sent. Only the last set of quick replies shows. A receipt
// or return card has its own Save or Confirm button, and a quick reply beside it
// would send a typed message, which by design can't save or file anything.
export function blocksToShow(ui: UiBlock[]): UiBlock[] {
  const lastQuickReplies = ui.findLastIndex((b) => b.type === "quick_replies");
  const hasOwnButtons = ui.some((b) => b.type === "receipt_card" || b.type === "return_card");
  return ui.filter((b, i) => b.type !== "quick_replies" || (i === lastQuickReplies && !hasOwnButtons));
}
