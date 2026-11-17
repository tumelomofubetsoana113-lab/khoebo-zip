// Tool definitions and their handlers. Every handler is a pure function of
// (state, input, context) -> { state, result, ui }. The model only chooses
// which tool to call; every amount, total and estimate is worked out here.

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { TAX } from "@/config/tax";
import { formatDate } from "./dates";
import { checkLekukaInvoice } from "./lekuka";
import {
  checkEntry,
  correctEntry,
  formatMoney,
  roundMoney,
  summarize,
  summaryRange,
  type Summary,
} from "./ledger";
import type { ChatAction, UiBlock } from "./blocks";
import type { Entry, FiledReturn, TraderState } from "./state";
import { strings } from "./strings";
import { dueDate, filingPeriod, isValidPeriod, periodRange, taxEstimate, type TaxEstimate } from "./tax";

// ---------------------------------------------------------------------------
// Button actions and UI blocks live in lib/blocks.ts.

export { ChatActionSchema, type ChatAction, type UiBlock } from "./blocks";

// How a button tap is described to the model as the trader's turn.
export function describeAction(action: ChatAction): string {
  switch (action.type) {
    case "confirm_return":
      return `[Button tapped: Confirm, on the return card for ${action.period}. Call confirm_return with period "${action.period}" and turnover ${action.turnover}.]`;
    case "change_return":
      return `[Button tapped: Change, on the return card for ${action.period}. Ask what needs changing.]`;
    case "pay_return":
      return `[Button tapped: Pay (demo), for the return for ${action.period}. Call start_payment with period "${action.period}".]`;
    case "file_now":
      return `[Button tapped: File now, on the reminder for ${action.period}. Call prepare_return with period "${action.period}".]`;
    case "undo_entry":
      return `[Button tapped: Undo, on entry ${action.entryId}. Call correct_entry with entry_id "${action.entryId}" and delete true.]`;
    case "simulate_reminder":
      return "[Demo: simulate the reminder for the current filing period. Call show_reminder.]";
    case "confirm_receipt":
      return `[Button tapped: Save purchase, on receipt card ${action.receiptId}. Call save_receipt with receipt_id "${action.receiptId}".]`;
    case "change_receipt":
      return `[Button tapped: Change, on the receipt card showing ${formatMoney(action.total)} on ${formatDate(action.date)}. Nothing was saved. Ask what is wrong. When the trader gives the right details, call record_entry with kind "purchase".]`;
  }
}

export type ToolContext = {
  today: string; // YYYY-MM-DD in Lesotho
  now: string; // ISO timestamp
  newId: () => string;
  newReference: () => string; // "MOCK-..."
  source: Entry["source"]; // how the trader's last message arrived
  action?: ChatAction;
  hasAttachment?: boolean; // the trader's last message came with a receipt
};

export type ToolOutcome = {
  state: TraderState;
  result: Record<string, unknown>;
  ui?: UiBlock[];
  isError?: boolean;
};

// ---------------------------------------------------------------------------
// Input schemas. Kept loose on purpose: the ledger does the detailed checks
// and returns errors the model can explain to the trader.

const dateField = z.string().describe("YYYY-MM-DD. Leave out for today.");
const periodField = z
  .string()
  .describe(
    TAX.filingPeriod === "quarterly"
      ? 'Filing period like "2026-Q3". Leave out for the current filing period.'
      : 'Filing period like "2026-10". Leave out for the current filing period.',
  );

// The two questions whose answers are a fixed list longer than 6.
const LONG_LISTS: readonly (readonly string[])[] = [strings.onboarding.districts, strings.onboarding.businessTypes];
const LONG_LIST_MAX = Math.max(...LONG_LISTS.map((l) => l.length));

function isLongListAllowed(options: string[]): boolean {
  return LONG_LISTS.some((list) => options.every((o) => list.includes(o)));
}

const inputs = {
  save_profile: z.object({
    business_type: z
      .string()
      .max(60)
      .optional()
      .describe("One of the listed business types, or the trader's own words if none fits."),
    district: z.enum(strings.onboarding.districts).optional(),
    registered: z.enum(["yes", "no", "not_sure"]).optional().describe("Registered with RSL?"),
    name: z.string().max(60).optional().describe("Only if the trader offers it."),
  }),
  record_entry: z.object({
    kind: z
      .enum(["sale", "purchase", "client_money"])
      .describe(
        "client_money: money a client gave a runner to buy goods for them. It isn't the runner's income; the runner's fee is a separate sale.",
      ),
    amount: z
      .number()
      .optional()
      .describe("Total as the trader said it, in maloti or rand. Leave out if giving quantity and unit_price."),
    currency: z
      .enum(["maloti", "rand"])
      .optional()
      .describe('"rand" if the trader gave the amount in rand (R). Leave out for maloti.'),
    quantity: z.number().optional(),
    unit_price: z.number().optional().describe("Price of one item in maloti."),
    date: dateField.optional(),
    note: z.string().max(100).optional().describe('What was sold or bought, e.g. "tomatoes".'),
    confirmed: z
      .boolean()
      .optional()
      .describe("Set true only after the trader has confirmed a large amount you asked about."),
  }),
  correct_entry: z.object({
    entry_id: z.string().max(32).describe('An entry id, or "last" for the entry recorded most recently.'),
    new_amount: z.number().optional(),
    delete: z.boolean().optional(),
  }),
  get_summary: z.object({
    period: z.enum(["this_week", "last_week", "this_month", "filing_period"]),
  }),
  get_tax_estimate: z.object({ period: periodField.optional() }),
  prepare_return: z.object({ period: periodField.optional() }),
  confirm_return: z.object({ period: z.string().max(10), turnover: z.number() }),
  start_payment: z.object({ period: z.string().max(10) }),
  start_registration: z.object({}),
  show_reminder: z.object({}),
  read_receipt: z.object({
    supplier: z.string().max(200).optional().describe("The business that issued the receipt, as printed."),
    date: z
      .string()
      .max(40)
      .optional()
      .describe("The receipt date as YYYY-MM-DD. Printed dates put the day first: 03/10/2026 is 3 October. Leave out if unclear."),
    total: z
      .number()
      .optional()
      .describe(
        "The final amount to pay, copied exactly as printed. Never add up lines or work it out. Leave out if it can't be read.",
      ),
    items: z.string().max(300).optional().describe('A few words on what was bought, e.g. "maize meal, cooking oil".'),
    invoice_number: z.string().max(60).optional().describe("Lekuka receipts only. Leave out if not printed."),
    device_id: z.string().max(60).optional().describe("Lekuka receipts only. Leave out if not printed."),
    verification_code: z
      .string()
      .max(60)
      .optional()
      .describe('The Lekuka verification code, like "E0CA-5208-D591-3E70", copied exactly. Leave out if not printed.'),
  }),
  save_receipt: z.object({ receipt_id: z.string().max(32) }),
  offer_quick_replies: z.object({
    // Up to 6 options, or the full district or business type list for those questions.
    options: z
      .array(z.string().min(1).max(23))
      .min(1)
      .max(LONG_LIST_MAX)
      .refine((options) => options.length <= 6 || isLongListAllowed(options), {
        message: "At most 6 options, unless every option is a district, or every option is a business type.",
      }),
  }),
};

type ToolName = keyof typeof inputs;

const descriptions: Record<ToolName, string> = {
  save_profile:
    "Save the trader's business type, district, RSL registration status, or name. Call as soon as the trader gives any of these.",
  record_entry:
    "Record one sale, purchase or amount of client money. Give either amount, or quantity and unit_price; the code works out the total. Amounts in rand are recorded at the same figure in maloti. Returns the entry and the totals for the Monday-to-Sunday week the entry falls in, which may be last week.",
  correct_entry: "Change the amount of one entry, or delete it.",
  get_summary: "Money in, money out, profit estimate, number of entries and days with no entries for a period.",
  get_tax_estimate:
    "Turnover, rate, estimated tax and due date for a filing period, plus below_threshold or fixed_amount when they apply. The rate is a placeholder until RSL confirms it.",
  prepare_return:
    "Build the pre-filled return for a filing period and show it with Confirm and Change buttons. Does not file anything.",
  confirm_return:
    "File the return. Only works straight after the trader taps Confirm on the return card; never call it because of a typed message.",
  start_payment: "Show a mock mobile money payment for a filed return. No real money moves.",
  start_registration: "Show what the trader needs to register with RSL, and where to go.",
  show_reminder: "Show the filing reminder for the current filing period, with the estimated tax and due date.",
  read_receipt:
    "Report what is printed on the receipt the trader just sent. Checks it and shows a card with Save and Change buttons. Saves nothing. Only call it when a receipt is attached.",
  save_receipt:
    "Save the receipt as a purchase. Only works straight after the trader taps Save on the receipt card; never call it because of a typed message.",
  offer_quick_replies:
    "Show up to 6 short tap-to-reply options (under 24 characters each) under your message, or the full list when asking for the district or the business type. Use whenever you ask a question with a few likely answers.",
};

function toInputSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
}

export const toolDefinitions: Anthropic.Tool[] = (Object.keys(inputs) as ToolName[]).map((name) => ({
  name,
  description: descriptions[name],
  input_schema: toInputSchema(inputs[name]),
}));

// ---------------------------------------------------------------------------
// Helpers that shape results for the model. Money always goes with a
// ready-formatted text version, so the model never formats or adds.

function money(n: number) {
  return { amount: n, text: formatMoney(n) };
}

// "R4,000": the loti is pegged one to one to the rand, so the figure is the same.
function formatRand(n: number): string {
  return formatMoney(n).replace("M", "R");
}

const CLIENT_MONEY_NOTE =
  "Client money is kept apart. It isn't income, profit or turnover, so it doesn't change the tax estimate. Only the runner's fee does.";

// Client money only shows in results when there is some, so other traders never hear of it.
function clientMoneyResult(clientMoney: number) {
  return clientMoney > 0 ? { client_money: money(clientMoney), client_money_note: CLIENT_MONEY_NOTE } : {};
}

function entryResult(e: Entry) {
  return { id: e.id, kind: e.kind, amount: money(e.amount), date: e.date, date_text: formatDate(e.date), note: e.note };
}

function summaryResult(s: Summary) {
  return {
    from: formatDate(s.start),
    to: formatDate(s.end),
    money_in: money(s.moneyIn),
    money_out: money(s.moneyOut),
    profit_estimate: money(s.profit),
    ...clientMoneyResult(s.clientMoney),
    entries: s.entryCount,
    days_with_no_entries: s.daysWithNoEntries,
  };
}

// Totals for the Monday-to-Sunday week an entry falls in, with that week's
// dates. Not always this week: on a Monday, "yesterday" is last week, and
// totals for this week alone made the model think the entry hadn't saved.
function entryWeekTotals(state: TraderState, date: string, today: string) {
  const range = summaryRange("this_week", date);
  const s = summarize(state.entries, range, today);
  return {
    from: formatDate(range.start),
    to: formatDate(range.end),
    is_this_week: range.start === summaryRange("this_week", today).start,
    money_in: money(s.moneyIn),
    money_out: money(s.moneyOut),
    profit_estimate: money(s.profit),
    ...(s.clientMoney > 0 ? { client_money: money(s.clientMoney) } : {}),
  };
}

function estimateResult(e: TaxEstimate) {
  return {
    period: e.period,
    from: formatDate(e.start),
    to: formatDate(e.end),
    turnover: money(e.turnover),
    rate_text: `${roundMoney(e.rate * 100)}%`,
    ...(e.fixed > 0 ? { fixed_amount: money(e.fixed) } : {}),
    ...(e.belowThreshold ? { below_threshold: true } : {}),
    estimated_tax: money(e.estimate),
    due_date: formatDate(e.dueDate),
    placeholder_rate: e.placeholder,
    ...(e.note ? { note: e.note } : {}),
  };
}

function placeholderUi(): UiBlock[] {
  return TAX.placeholder ? [{ type: "placeholder_note", text: TAX.note }] : [];
}

function fail(state: TraderState, error: string, message: string, extra: Record<string, unknown> = {}): ToolOutcome {
  return { state, result: { error, message, ...extra }, isError: true };
}

// A period the trader can file: well formed and already started.
function checkPeriod(period: string, today: string): string | null {
  if (!isValidPeriod(period)) return "Not a valid filing period.";
  if (periodRange(period).start > today) return "That period hasn't started yet.";
  return null;
}

function findReturn(state: TraderState, period: string): FiledReturn | undefined {
  return state.returns.find((r) => r.period === period);
}

// The same Lekuka invoice can only be saved once.
function findSavedInvoice(state: TraderState, invoiceNumber?: string | null, deviceId?: string | null): Entry | undefined {
  if (!invoiceNumber) return undefined;
  return state.entries.find(
    (e) => e.receipt?.invoiceNumber === invoiceNumber && (e.receipt?.deviceId ?? null) === (deviceId ?? null),
  );
}

// Without an invoice number, the same date and total from a receipt might be a
// second copy, or might be a second real purchase, so the trader decides.
function looksLikeSavedReceipt(state: TraderState, total: number, date: string): boolean {
  return state.entries.some((e) => e.source === "receipt" && e.amount === total && e.date === date);
}

// ---------------------------------------------------------------------------
// Handlers

type Handlers = {
  [K in ToolName]: (state: TraderState, input: z.infer<(typeof inputs)[K]>, ctx: ToolContext) => ToolOutcome;
};

const handlers: Handlers = {
  save_profile(state, input) {
    const profile = { ...state.profile };
    if (input.business_type) profile.businessType = input.business_type;
    if (input.district) profile.district = input.district;
    if (input.registered) profile.registered = input.registered;
    if (input.name) profile.name = input.name;
    const missing = [
      !profile.businessType && "business_type",
      !profile.district && "district",
      !profile.registered && "registered",
    ].filter(Boolean);
    const onboardingDone = state.onboardingDone || missing.length === 0;
    return {
      state: { ...state, profile, onboardingDone },
      result: { saved: true, onboarding_done: onboardingDone, still_needed: missing },
    };
  },

  record_entry(state, input, ctx) {
    const check = checkEntry(
      {
        amount: input.amount,
        quantity: input.quantity,
        unitPrice: input.unit_price,
        date: input.date,
        confirmed: input.confirmed,
      },
      ctx.today,
    );
    if (!check.ok) {
      if (check.error === "needs_confirmation") {
        return {
          state,
          result: {
            status: "needs_confirmation",
            amount: money(check.amount ?? 0),
            message:
              "Not recorded. This is a large amount: ask the trader to confirm it. If they confirm, call record_entry again with confirmed true.",
          },
        };
      }
      const messages: Record<typeof check.error, string> = {
        missing_amount: "Not recorded. No amount was given. Ask the trader for the amount.",
        invalid_amount: "Not recorded. The amount must be more than zero.",
        invalid_date: "Not recorded. The date isn't a real date. Ask the trader which day.",
        date_in_future: "Not recorded. The date is in the future.",
        date_too_old: "Not recorded. Entries can only go back 60 days.",
      };
      return fail(state, check.error, messages[check.error]);
    }

    const inRand = input.currency === "rand";
    const entry: Entry = {
      id: ctx.newId(),
      kind: input.kind,
      amount: check.amount,
      date: check.date,
      ...(input.note ? { note: input.note.slice(0, 100) } : {}),
      ...(inRand ? { currency: "rand" as const } : {}),
      source: ctx.source,
      createdAt: ctx.now,
    };
    const next = { ...state, entries: [...state.entries, entry] };
    return {
      state: next,
      result: {
        recorded: entryResult(entry),
        ...(inRand ? { rand_note: strings.chat.cards.randAtPar(formatRand(entry.amount), formatMoney(entry.amount)) } : {}),
        ...(entry.kind === "client_money" ? { client_money_note: CLIENT_MONEY_NOTE } : {}),
        week_of_entry: entryWeekTotals(next, entry.date, ctx.today),
      },
      ui: [{ type: "entry_receipt", entry }],
    };
  },

  correct_entry(state, input, ctx) {
    const result = correctEntry(state.entries, input.entry_id, {
      newAmount: input.new_amount,
      delete: input.delete,
    });
    if (!result.ok) {
      const messages = {
        not_found: "No entry found to change.",
        nothing_to_change: "Give new_amount, or delete true.",
        invalid_amount: "The new amount must be more than zero.",
      };
      return fail(state, result.error, messages[result.error]);
    }
    const next = { ...state, entries: result.entries };
    return {
      state: next,
      result: {
        before: entryResult(result.before),
        after: result.after ? entryResult(result.after) : "deleted",
        week_of_entry: entryWeekTotals(next, (result.after ?? result.before).date, ctx.today),
      },
      ui: result.after ? [{ type: "entry_receipt", entry: result.after }] : [],
    };
  },

  get_summary(state, input, ctx) {
    let range;
    let label: string;
    if (input.period === "filing_period") {
      const period = filingPeriod(ctx.today);
      range = periodRange(period);
      label = strings.chat.periods.filing_period(period);
    } else {
      range = summaryRange(input.period, ctx.today);
      label = strings.chat.periods[input.period];
    }
    const s = summarize(state.entries, range, ctx.today);
    return {
      state,
      result: { period: label, ...summaryResult(s) },
      ui: [
        {
          type: "summary_card",
          label,
          start: s.start,
          end: s.end,
          moneyIn: s.moneyIn,
          moneyOut: s.moneyOut,
          clientMoney: s.clientMoney,
          profit: s.profit,
          entryCount: s.entryCount,
        },
      ],
    };
  },

  get_tax_estimate(state, input, ctx) {
    const period = input.period ?? filingPeriod(ctx.today);
    const problem = checkPeriod(period, ctx.today);
    if (problem) return fail(state, "invalid_period", problem);
    const filed = findReturn(state, period);
    return {
      state,
      result: {
        ...estimateResult(taxEstimate(state.entries, period)),
        ...(filed ? { already_filed: { reference: filed.reference, paid: filed.paid } } : {}),
      },
      ui: placeholderUi(),
    };
  },

  prepare_return(state, input, ctx) {
    const period = input.period ?? filingPeriod(ctx.today);
    const problem = checkPeriod(period, ctx.today);
    if (problem) return fail(state, "invalid_period", problem);
    const filed = findReturn(state, period);
    if (filed) {
      return fail(state, "already_filed", "This period's return is already filed.", {
        reference: filed.reference,
        paid: filed.paid,
      });
    }
    const e = taxEstimate(state.entries, period);
    return {
      state,
      result: {
        ...estimateResult(e),
        shown: "return card with Confirm and Change buttons",
        message: "Nothing is filed until the trader taps Confirm. Ask them to check the figures.",
      },
      ui: [
        {
          type: "return_card",
          period,
          start: e.start,
          end: e.end,
          turnover: e.turnover,
          taxEstimate: e.estimate,
          dueDate: e.dueDate,
          note: e.note,
        },
      ],
    };
  },

  confirm_return(state, input, ctx) {
    const action = ctx.action;
    if (action?.type !== "confirm_return" || action.period !== input.period) {
      return fail(
        state,
        "needs_button",
        "Not filed. A return is only filed when the trader taps Confirm on the return card. Call prepare_return to show it.",
      );
    }
    const problem = checkPeriod(input.period, ctx.today);
    if (problem) return fail(state, "invalid_period", problem);
    if (findReturn(state, input.period)) return fail(state, "already_filed", "This period's return is already filed.");

    const e = taxEstimate(state.entries, input.period);
    if (roundMoney(input.turnover) !== e.turnover || roundMoney(action.turnover) !== e.turnover) {
      return fail(
        state,
        "records_changed",
        "Not filed. The records changed since the return card was shown. Call prepare_return to show the new figures.",
      );
    }
    const filed: FiledReturn = {
      period: input.period,
      turnover: e.turnover,
      taxEstimate: e.estimate,
      confirmedAt: ctx.now,
      reference: ctx.newReference(),
      paid: false,
    };
    return {
      state: { ...state, returns: [...state.returns, filed] },
      result: {
        filed: true,
        period: filed.period,
        reference: filed.reference,
        reference_is_mock: true,
        turnover: money(filed.turnover),
        estimated_tax: money(filed.taxEstimate),
        due_date: formatDate(e.dueDate),
        ...(e.note ? { note: e.note } : {}),
      },
      ui: placeholderUi(),
    };
  },

  start_payment(state, input, ctx) {
    const filed = findReturn(state, input.period);
    if (!filed) return fail(state, "not_filed", "There is no filed return for this period. File it first.");
    if (filed.paid) return { state, result: { already_paid: true, reference: filed.reference } };

    // The return is only marked paid when the "Pay (demo)" button sends an action.
    const action = ctx.action;
    if (action?.type === "pay_return" && action.period === input.period) {
      const returns = state.returns.map((r) => (r.period === filed.period ? { ...r, paid: true } : r));
      return {
        state: { ...state, returns },
        result: { paid: true, demo: true, amount: money(filed.taxEstimate), reference: filed.reference },
      };
    }
    return {
      state,
      result: {
        shown: "mock payment card with a Pay (demo) button",
        amount: money(filed.taxEstimate),
        reference: filed.reference,
        message: "No real money moves in this prototype.",
      },
      ui: [
        {
          type: "payment_card",
          period: filed.period,
          amount: filed.taxEstimate,
          reference: filed.reference,
          note: TAX.placeholder ? TAX.note : null,
        },
      ],
    };
  },

  start_registration(state) {
    const atFieldVisit = state.profile.setUpAt === "field_visit";
    return {
      state,
      result: {
        shown: "registration checklist",
        handoff: strings.chat.registration.handoff,
        ...(atFieldVisit
          ? { officer_present: true, message: "Say in one short sentence that the RSL officer with them can help them register now." }
          : {}),
      },
      ui: [
        {
          type: "registration_card",
          checklist: [...strings.chat.registration.checklist],
          handoff: strings.chat.registration.handoff,
          ...(atFieldVisit ? { officerNote: strings.chat.registration.officerNote } : {}),
        },
      ],
    };
  },

  show_reminder(state, _input, ctx) {
    const period = filingPeriod(ctx.today);
    const e = taxEstimate(state.entries, period);
    const filed = findReturn(state, period);
    return {
      state,
      result: {
        ...estimateResult(e),
        reminder_days_before: TAX.reminderDaysBefore,
        ...(filed ? { already_filed: { reference: filed.reference } } : {}),
        message: `Write this as a friendly reminder sent ${TAX.reminderDaysBefore} days before the due date.`,
      },
      ui: [{ type: "reminder_card", period, dueDate: dueDate(period), taxEstimate: e.estimate, note: e.note }],
    };
  },

  read_receipt(state, input, ctx) {
    if (!ctx.hasAttachment) {
      return fail(state, "no_receipt", "No receipt is attached to this message. Ask the trader to send one.");
    }
    if (input.total === undefined) {
      return {
        state,
        result: {
          status: "total_unclear",
          message: "Nothing to save yet. Ask for a clearer picture, or for the trader to type the amount and date.",
        },
      };
    }

    const check = checkEntry({ amount: input.total, date: input.date, confirmed: true }, ctx.today);
    if (!check.ok) {
      if (check.error === "invalid_amount" || check.error === "missing_amount") {
        return {
          state,
          result: {
            status: "total_unclear",
            message: "Nothing to save yet. Ask for a clearer picture, or for the trader to type the amount and date.",
          },
        };
      }
      const messages = {
        invalid_date: "The date isn't a real date. Ask the trader which day this was.",
        date_in_future: "The date is in the future, so it may be misread. Ask the trader which day this was.",
        date_too_old: "Nothing saved. Entries can only go back 60 days, and this receipt is older than that.",
      };
      return {
        state,
        result: {
          status: "date_problem",
          reason: check.error,
          ...(check.error === "invalid_date" ? {} : { date_text: formatDate(input.date ?? ctx.today) }),
          message: messages[check.error as keyof typeof messages],
        },
      };
    }

    const invoiceNumber = input.invoice_number?.trim() || null;
    const deviceId = input.device_id?.trim() || null;
    const verificationCode = input.verification_code?.trim() || null;

    const saved = findSavedInvoice(state, invoiceNumber, deviceId);
    if (saved) {
      return {
        state,
        result: {
          status: "already_saved",
          saved: entryResult(saved),
          message: "This invoice is already in the trader's records, so it wasn't added again. Tell them.",
        },
      };
    }

    const lekuka = checkLekukaInvoice(
      {
        invoiceNumber: invoiceNumber ?? undefined,
        deviceId: deviceId ?? undefined,
        verificationCode: verificationCode ?? undefined,
      },
      { total: check.amount, date: check.date },
    );
    const supplier = input.supplier?.trim().slice(0, 80) || null;
    const note = [supplier, input.items?.trim()].filter(Boolean).join(" · ").slice(0, 100) || null;
    const receiptId = ctx.newId();
    const dateAssumed = !input.date;
    const possibleDuplicate = looksLikeSavedReceipt(state, check.amount, check.date);

    return {
      state,
      result: {
        status: "shown",
        receipt_id: receiptId,
        shown: "receipt card with Save and Change buttons",
        supplier,
        total: money(check.amount),
        date: check.date,
        date_text: formatDate(check.date),
        date_assumed: dateAssumed,
        lekuka,
        possible_duplicate: possibleDuplicate,
        message: "Nothing is saved until the trader taps Save. Ask them to check the card.",
      },
      ui: [
        {
          type: "receipt_card",
          receiptId,
          supplier,
          date: check.date,
          dateAssumed,
          total: check.amount,
          note,
          invoiceNumber,
          deviceId,
          verificationCode,
          lekuka: lekuka.status,
          possibleDuplicate,
        },
      ],
    };
  },

  save_receipt(state, input, ctx) {
    const action = ctx.action;
    if (action?.type !== "confirm_receipt" || action.receiptId !== input.receipt_id) {
      return fail(state, "needs_button", "Not saved. A receipt is only saved when the trader taps Save on the receipt card.");
    }
    // The trader has seen the amount on the card, so a large one needs no second question.
    const check = checkEntry({ amount: action.total, date: action.date, confirmed: true }, ctx.today);
    if (!check.ok) return fail(state, check.error, "Not saved. The amount or date on the card can't be used.");

    const saved = findSavedInvoice(state, action.invoiceNumber, action.deviceId);
    if (saved) {
      return fail(state, "already_saved", "This invoice is already in the trader's records, so it wasn't added again.");
    }

    const lekuka = checkLekukaInvoice(
      {
        invoiceNumber: action.invoiceNumber ?? undefined,
        deviceId: action.deviceId ?? undefined,
        verificationCode: action.verificationCode ?? undefined,
      },
      { total: check.amount, date: check.date },
    );
    const entry: Entry = {
      id: ctx.newId(),
      kind: "purchase",
      amount: check.amount,
      date: check.date,
      ...(action.note ? { note: action.note } : {}),
      source: "receipt",
      createdAt: ctx.now,
      receipt: {
        ...(action.invoiceNumber ? { invoiceNumber: action.invoiceNumber } : {}),
        ...(action.deviceId ? { deviceId: action.deviceId } : {}),
        lekuka: lekuka.status,
      },
    };
    const next = { ...state, entries: [...state.entries, entry] };
    return {
      state: next,
      result: { recorded: entryResult(entry), week_of_entry: entryWeekTotals(next, entry.date, ctx.today) },
      ui: [{ type: "entry_receipt", entry }],
    };
  },

  offer_quick_replies(state, input) {
    return { state, result: { shown: true }, ui: [{ type: "quick_replies", options: input.options }] };
  },
};

// Runs one tool call. Unknown tools and bad input come back as errors the
// model can recover from; they never change the state.
export function runTool(name: string, rawInput: unknown, state: TraderState, ctx: ToolContext): ToolOutcome {
  if (!(name in inputs)) return fail(state, "unknown_tool", `There is no tool called ${name}.`);
  const toolName = name as ToolName;
  const parsed = inputs[toolName].safeParse(rawInput ?? {});
  if (!parsed.success) {
    return fail(state, "invalid_input", z.prettifyError(parsed.error));
  }
  const handler = handlers[toolName] as (s: TraderState, i: unknown, c: ToolContext) => ToolOutcome;
  return handler(state, parsed.data, ctx);
}
