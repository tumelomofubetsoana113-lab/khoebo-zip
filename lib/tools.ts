// Tool definitions and their handlers. Every handler is a pure function of
// (state, input, context) -> { state, result, ui }. The model only chooses
// which tool to call; every amount, total and estimate is worked out here.

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { TAX } from "@/config/tax";
import { formatDate } from "./dates";
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
  }
}

export type ToolContext = {
  today: string; // YYYY-MM-DD in Lesotho
  now: string; // ISO timestamp
  newId: () => string;
  newReference: () => string; // "MOCK-..."
  source: Entry["source"]; // how the trader's last message arrived
  action?: ChatAction;
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

const inputs = {
  save_profile: z.object({
    business_type: z.string().max(60).optional(),
    district: z.enum(strings.onboarding.districts).optional(),
    registered: z.enum(["yes", "no", "not_sure"]).optional().describe("Registered with RSL?"),
    name: z.string().max(60).optional().describe("Only if the trader offers it."),
  }),
  record_entry: z.object({
    kind: z.enum(["sale", "purchase"]),
    amount: z.number().optional().describe("Total in maloti. Leave out if giving quantity and unit_price."),
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
  offer_quick_replies: z.object({
    // Up to 6 options, or all ten districts for the district question.
    options: z
      .array(z.string().min(1).max(23))
      .min(1)
      .max(strings.onboarding.districts.length)
      .refine(
        (options) =>
          options.length <= 6 ||
          options.every((o) => (strings.onboarding.districts as readonly string[]).includes(o)),
        { message: "At most 6 options, unless every option is a district." },
      ),
  }),
};

type ToolName = keyof typeof inputs;

const descriptions: Record<ToolName, string> = {
  save_profile:
    "Save the trader's business type, district, RSL registration status, or name. Call as soon as the trader gives any of these.",
  record_entry:
    "Record one sale or purchase. Give either amount, or quantity and unit_price; the code works out the total. Returns the entry and this week's totals.",
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
  offer_quick_replies:
    "Show up to 6 short tap-to-reply options (under 24 characters each) under your message, or all ten districts when asking for the district. Use whenever you ask a question with a few likely answers.",
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
    entries: s.entryCount,
    days_with_no_entries: s.daysWithNoEntries,
  };
}

function weekTotals(state: TraderState, today: string) {
  const s = summarize(state.entries, summaryRange("this_week", today), today);
  return { money_in: money(s.moneyIn), money_out: money(s.moneyOut), profit_estimate: money(s.profit) };
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

    const entry: Entry = {
      id: ctx.newId(),
      kind: input.kind,
      amount: check.amount,
      date: check.date,
      ...(input.note ? { note: input.note.slice(0, 100) } : {}),
      source: ctx.source,
      createdAt: ctx.now,
    };
    const next = { ...state, entries: [...state.entries, entry] };
    return {
      state: next,
      result: { recorded: entryResult(entry), this_week: weekTotals(next, ctx.today) },
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
        this_week: weekTotals(next, ctx.today),
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
    return {
      state,
      result: { shown: "registration checklist", handoff: strings.chat.registration.handoff },
      ui: [
        {
          type: "registration_card",
          checklist: [...strings.chat.registration.checklist],
          handoff: strings.chat.registration.handoff,
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
