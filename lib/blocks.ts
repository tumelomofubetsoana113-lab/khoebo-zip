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
  | { type: "registration_card"; checklist: string[]; handoff: string }
  | { type: "reminder_card"; period: string; dueDate: string; taxEstimate: number; note: string | null }
  | { type: "placeholder_note"; text: string };
