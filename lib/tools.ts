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
import type { BusinessTotals, ChatAction, UiBlock } from "./blocks";
import {
  businessList,
  entriesFor,
  findBusinessReturn,
  hasSeveralBusinesses,
  MAIN_BUSINESS,
  nameTaken,
  resolveBusiness,
  storedBusinessId,
  type BusinessInfo,
} from "./businesses";
import { buildStatement, resolveStatementPeriod } from "./statement";
import type { Entry, FiledReturn, TraderState } from "./state";
import { strings } from "./strings";
import { dueDate, filingPeriod, isValidPeriod, periodRange, taxEstimate, type TaxEstimate } from "./tax";

// ---------------------------------------------------------------------------
// Button actions and UI blocks live in lib/blocks.ts.

export { ChatActionSchema, type ChatAction, type UiBlock } from "./blocks";

// How a button tap is described to the model as the trader's turn.
export function describeAction(action: ChatAction): string {
  // For one of several businesses, the card says which, and so does the call.
  const b = "businessId" in action && action.businessId ? action.businessId : null;
  const of = b ? ` of business "${b}"` : "";
  const arg = b ? ` and business "${b}"` : "";
  switch (action.type) {
    case "confirm_return":
      return `[Button tapped: Confirm, on the return card for ${action.period}${of}. Call confirm_return with period "${action.period}"${b ? `, turnover ${action.turnover}${arg}` : ` and turnover ${action.turnover}`}.]`;
    case "change_return":
      return `[Button tapped: Change, on the return card for ${action.period}${of}. Ask what needs changing.]`;
    case "pay_return":
      return `[Button tapped: Pay (demo), for the return for ${action.period}${of}. Call start_payment with period "${action.period}"${arg}.]`;
    case "file_now":
      return `[Button tapped: File now, on the reminder for ${action.period}${of}. Call prepare_return with period "${action.period}"${arg}.]`;
    case "undo_entry":
      return `[Button tapped: Undo, on entry ${action.entryId}. Call correct_entry with entry_id "${action.entryId}" and delete true.]`;
    case "simulate_reminder":
      return "[Demo: simulate the reminder for the current filing period. Call show_reminder.]";
    case "confirm_receipt":
      return `[Button tapped: Save purchase, on receipt card ${action.receiptId}${b ? ` (to business "${b}")` : ""}. Call save_receipt with receipt_id "${action.receiptId}".]`;
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
// Only used when the trader has more than one business (listed in the profile).
const businessField = z
  .string()
  .max(60)
  .optional()
  .describe("Only for a trader with more than one business: the business id from the profile. Leave out otherwise.");
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
  save_business: z.object({
    business_id: z
      .string()
      .max(32)
      .optional()
      .describe('Leave out to add a new business or branch. Give an id from the profile ("main" for the first business) to rename or change it.'),
    name: z
      .string()
      .min(1)
      .max(40)
      .describe(`The trader's own short name for it, e.g. "Ha Thetsane shop" or "Salon". Each name must be different.`),
    business_type: z.string().max(60).optional().describe("One of the listed business types, or the trader's own words."),
    district: z.enum(strings.onboarding.districts).optional(),
  }),
  record_entry: z.object({
    business: businessField,
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
    business: businessField.describe("Only for a trader with more than one business: one business id, or leave out for all of them."),
  }),
  get_tax_estimate: z.object({
    period: periodField.optional(),
    business: businessField.describe("Only for a trader with more than one business: one business id, or leave out for each of them."),
  }),
  prepare_return: z.object({ period: periodField.optional(), business: businessField }),
  confirm_return: z.object({ period: z.string().max(10), turnover: z.number(), business: businessField }),
  start_payment: z.object({ period: z.string().max(10), business: businessField }),
  start_registration: z.object({}),
  show_obligations: z.object({}),
  show_reminder: z.object({}),
  get_statement: z.object({
    business: businessField.describe("Only for a trader with more than one business: one business id, or leave out for all of them."),
    period: z
      .string()
      .max(12)
      .optional()
      .describe(
        '"this_month", "last_month", a month like "2026-10", or "all" for every record. Leave out for this month.',
      ),
  }),
  read_receipt: z.object({
    business: businessField.describe(
      "Only for a trader with more than one business, if they said which one the purchase is for. Leave out otherwise: the card then lets them choose.",
    ),
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
  save_business:
    "Add another business or branch the trader runs, or rename or change one. Each business keeps its own records and files its own return.",
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
  show_obligations:
    "Show what the trader has to do as a taxpayer (register, keep records, file, pay), with their own status and the current period's due date.",
  show_reminder: "Show the filing reminder for the current filing period, with the estimated tax and due date.",
  get_statement:
    "Make a statement of the trader's records for one month, or of all their records. Shows a card with buttons to open it (to print or save as a PDF) and to download it as a spreadsheet.",
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
function entryWeekTotals(state: TraderState, date: string, today: string, businessId: string = MAIN_BUSINESS) {
  const range = summaryRange("this_week", date);
  // With several businesses, the totals are for the entry's own business.
  const entries = hasSeveralBusinesses(state) ? entriesFor(state.entries, businessId) : state.entries;
  const s = summarize(entries, range, today);
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

// The business a tool is for. With several businesses and none given, the
// model is told to ask, with the names as quick replies. Nothing is changed.
function pickBusiness(
  state: TraderState,
  value: string | undefined,
): { ok: true; business: BusinessInfo } | { ok: false; outcome: ToolOutcome } {
  const check = resolveBusiness(state, value);
  if (check.ok) return check;
  const names = businessList(state).map((b) => b.name);
  if (check.error === "needs_business") {
    return {
      ok: false,
      outcome: {
        state,
        result: {
          status: "needs_business",
          businesses: names,
          message: "Nothing was done. The trader has more than one business: ask which one, with the business names as quick replies.",
        },
      },
    };
  }
  return { ok: false, outcome: fail(state, "business_not_found", "No business with that id or name.", { businesses: names }) };
}

// Business id and name for a card, only when the trader has more than one.
function cardBusiness(state: TraderState, business: BusinessInfo) {
  return hasSeveralBusinesses(state)
    ? { ...(business.id === MAIN_BUSINESS ? {} : { businessId: business.id }), businessName: business.name }
    : {};
}

// The business name for a tool result, only when the trader has more than one.
function businessResult(state: TraderState, business: BusinessInfo) {
  return hasSeveralBusinesses(state) ? { business: business.name, business_id: business.id } : {};
}

// The business on a button tap: the first business when the button has none.
function actionBusiness(action: ChatAction): string {
  return ("businessId" in action && action.businessId) || MAIN_BUSINESS;
}

// A period the trader can file: well formed and already started.
function checkPeriod(period: string, today: string): string | null {
  if (!isValidPeriod(period)) return "Not a valid filing period.";
  if (periodRange(period).start > today) return "That period hasn't started yet.";
  return null;
}

function findReturn(state: TraderState, period: string, businessId: string = MAIN_BUSINESS): FiledReturn | undefined {
  return findBusinessReturn(state, period, businessId);
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

  save_business(state, input, ctx) {
    const name = input.name.trim();
    const list = () => businessList(next).map((b) => ({ id: b.id, name: b.name, type: b.type, district: b.district }));
    let next: TraderState;

    if (input.business_id) {
      const found = resolveBusiness(state, input.business_id);
      if (!found.ok) return fail(state, "business_not_found", "No business with that id.");
      const id = found.business.id;
      if (nameTaken(state, name, id)) return fail(state, "name_taken", "Another business already has that name. Ask for a different one.");
      if (id === MAIN_BUSINESS) {
        next = {
          ...state,
          profile: {
            ...state.profile,
            businessName: name,
            ...(input.business_type ? { businessType: input.business_type } : {}),
            ...(input.district ? { district: input.district } : {}),
          },
        };
      } else {
        next = {
          ...state,
          businesses: (state.businesses ?? []).map((b) =>
            b.id === id
              ? {
                  ...b,
                  name,
                  ...(input.business_type ? { type: input.business_type } : {}),
                  ...(input.district ? { district: input.district } : {}),
                }
              : b,
          ),
        };
      }
      return { state: next, result: { saved: true, business_id: id, businesses: list() } };
    }

    if ((state.businesses?.length ?? 0) >= 10) return fail(state, "too_many", "A trader can keep up to 11 businesses here.");
    if (nameTaken(state, name)) return fail(state, "name_taken", "Another business already has that name. Ask for a different one.");
    const district = input.district ?? state.profile.district;
    const added = {
      id: ctx.newId(),
      name,
      ...(input.business_type ? { type: input.business_type } : {}),
      ...(district ? { district } : {}),
    };
    next = { ...state, businesses: [...(state.businesses ?? []), added] };
    const firstUnnamed = !state.businesses?.length && !state.profile.businessName;
    return {
      state: next,
      result: {
        saved: true,
        business_id: added.id,
        businesses: list(),
        message: firstUnnamed
          ? `Added. The first business is called "${businessList(next)[0].name}" for now: offer to give it a short name the trader uses, with save_business and business_id "main". From now on, every sale, purchase and return needs a business.`
          : "Added. Every sale, purchase and return now needs a business.",
      },
    };
  },

  record_entry(state, input, ctx) {
    const picked = pickBusiness(state, input.business);
    if (!picked.ok) return picked.outcome;
    const business = picked.business;
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
      ...storedBusinessId(business.id),
    };
    const next = { ...state, entries: [...state.entries, entry] };
    return {
      state: next,
      result: {
        recorded: entryResult(entry),
        ...businessResult(state, business),
        ...(inRand ? { rand_note: strings.chat.cards.randAtPar(formatRand(entry.amount), formatMoney(entry.amount)) } : {}),
        ...(entry.kind === "client_money" ? { client_money_note: CLIENT_MONEY_NOTE } : {}),
        week_of_entry: entryWeekTotals(next, entry.date, ctx.today, business.id),
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
        week_of_entry: entryWeekTotals(
          next,
          (result.after ?? result.before).date,
          ctx.today,
          result.before.businessId ?? MAIN_BUSINESS,
        ),
      },
      ui: result.after ? [{ type: "entry_receipt", entry: result.after }] : [],
    };
  },

  get_summary(state, input, ctx) {
    const several = hasSeveralBusinesses(state);
    let one: BusinessInfo | null = null;
    if (several && input.business) {
      const picked = pickBusiness(state, input.business);
      if (!picked.ok) return picked.outcome;
      one = picked.business;
    }
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
    if (one) label = `${label} · ${one.name}`;
    const s = summarize(one ? entriesFor(state.entries, one.id) : state.entries, range, ctx.today);
    // All of several businesses: the totals, then a line for each.
    const byBusiness: BusinessTotals[] | undefined =
      several && !one
        ? businessList(state).map((b) => {
            const t = summarize(entriesFor(state.entries, b.id), range, ctx.today);
            return { name: b.name, moneyIn: t.moneyIn, moneyOut: t.moneyOut, profit: t.profit };
          })
        : undefined;
    return {
      state,
      result: {
        period: label,
        ...summaryResult(s),
        ...(one ? { business: one.name } : {}),
        ...(byBusiness
          ? {
              all_businesses: true,
              by_business: byBusiness.map((b) => ({
                business: b.name,
                money_in: money(b.moneyIn),
                money_out: money(b.moneyOut),
                profit_estimate: money(b.profit),
              })),
            }
          : {}),
      },
      ui: [
        {
          type: "summary_card",
          label,
          ...(byBusiness ? { byBusiness } : {}),
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

    if (hasSeveralBusinesses(state)) {
      // Each business files its own return, so each has its own estimate.
      let list = businessList(state);
      if (input.business) {
        const picked = pickBusiness(state, input.business);
        if (!picked.ok) return picked.outcome;
        list = [picked.business];
      }
      return {
        state,
        result: {
          each_business_files_its_own_return: true,
          estimates: list.map((b) => {
            const filed = findReturn(state, period, b.id);
            return {
              business: b.name,
              business_id: b.id,
              ...estimateResult(taxEstimate(entriesFor(state.entries, b.id), period)),
              ...(filed ? { already_filed: { reference: filed.reference, paid: filed.paid } } : {}),
            };
          }),
          message: "Give each business's estimate separately. Never add them up.",
        },
        ui: placeholderUi(),
      };
    }

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
    const picked = pickBusiness(state, input.business);
    if (!picked.ok) return picked.outcome;
    const business = picked.business;
    const filed = findReturn(state, period, business.id);
    if (filed) {
      return fail(state, "already_filed", "This period's return is already filed.", {
        reference: filed.reference,
        paid: filed.paid,
        ...businessResult(state, business),
      });
    }
    const e = taxEstimate(entriesFor(state.entries, business.id), period);
    return {
      state,
      result: {
        ...estimateResult(e),
        ...businessResult(state, business),
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
          ...cardBusiness(state, business),
        },
      ],
    };
  },

  confirm_return(state, input, ctx) {
    const action = ctx.action;
    const picked = action?.type === "confirm_return" ? pickBusiness(state, input.business ?? actionBusiness(action)) : null;
    if (picked && !picked.ok) return picked.outcome;
    const business = picked?.ok ? picked.business : null;
    if (
      action?.type !== "confirm_return" ||
      action.period !== input.period ||
      !business ||
      actionBusiness(action) !== business.id
    ) {
      return fail(
        state,
        "needs_button",
        "Not filed. A return is only filed when the trader taps Confirm on the return card. Call prepare_return to show it.",
      );
    }
    const problem = checkPeriod(input.period, ctx.today);
    if (problem) return fail(state, "invalid_period", problem);
    if (findReturn(state, input.period, business.id)) return fail(state, "already_filed", "This period's return is already filed.");

    const e = taxEstimate(entriesFor(state.entries, business.id), input.period);
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
      ...storedBusinessId(business.id),
    };
    return {
      state: { ...state, returns: [...state.returns, filed] },
      result: {
        filed: true,
        ...businessResult(state, business),
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
    const action = ctx.action;
    const picked = pickBusiness(state, input.business ?? (action?.type === "pay_return" ? actionBusiness(action) : undefined));
    if (!picked.ok) return picked.outcome;
    const business = picked.business;
    const filed = findReturn(state, input.period, business.id);
    if (!filed) return fail(state, "not_filed", "There is no filed return for this period. File it first.");
    if (filed.paid) return { state, result: { already_paid: true, reference: filed.reference } };

    // The return is only marked paid when the "Pay (demo)" button sends an action.
    if (action?.type === "pay_return" && action.period === input.period && actionBusiness(action) === business.id) {
      const returns = state.returns.map((r) => (r === filed ? { ...r, paid: true } : r));
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
          ...cardBusiness(state, business),
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
        links_shown: strings.chat.registration.links.map((l) => l.label),
        message_about_links: "The card has buttons for RSL's e-Registration site and the RSL app. Point to them; don't type web addresses.",
        ...(atFieldVisit
          ? { officer_present: true, message: "Say in one short sentence that the RSL officer with them can help them register now." }
          : {}),
      },
      ui: [
        {
          type: "registration_card",
          checklist: [...strings.chat.registration.checklist],
          handoff: strings.chat.registration.handoff,
          links: strings.chat.registration.links.map((l) => ({ ...l })),
          ...(atFieldVisit ? { officerNote: strings.chat.registration.officerNote } : {}),
        },
      ],
    };
  },

  show_obligations(state, _input, ctx) {
    const o = strings.chat.obligations;
    const period = filingPeriod(ctx.today);
    const dueText = formatDate(dueDate(period));
    const e = taxEstimate(entriesFor(state.entries, MAIN_BUSINESS), period);
    const filed = findReturn(state, period);
    const registered = state.profile.registered === "yes";
    const n = state.entries.length;
    const owed = filed?.taxEstimate ?? e.estimate;
    const ob = strings.businesses;
    // With several businesses, each files and pays its own return.
    const perBusiness = hasSeveralBusinesses(state)
      ? businessList(state).flatMap((b) => {
          const f = findReturn(state, period, b.id);
          const due = f?.taxEstimate ?? taxEstimate(entriesFor(state.entries, b.id), period).estimate;
          return [
            { text: f ? ob.filed(b.name, period, f.reference) : ob.file(b.name, period, dueText), done: Boolean(f) },
            {
              text: f?.paid ? ob.paid(b.name, period) : due > 0 ? ob.pay(b.name, formatMoney(due), dueText) : ob.payAny(b.name, dueText),
              done: Boolean(f?.paid),
            },
          ];
        })
      : null;
    const items = [
      { text: registered ? o.registered : o.register, done: registered },
      { text: n ? o.records(n) : o.recordsNone, done: n > 0 },
      ...(perBusiness ?? [
        { text: filed ? o.filed(period, filed.reference) : o.file(period, dueText), done: Boolean(filed) },
        { text: filed?.paid ? o.paid(period) : owed > 0 ? o.pay(formatMoney(owed), dueText) : o.payAny(dueText), done: Boolean(filed?.paid) },
      ]),
    ];
    return {
      state,
      result: {
        shown: "obligations card",
        items: items.map((i) => `${i.done ? "done" : "to do"}: ${i.text}`),
        ...(e.note ? { note: e.note } : {}),
        message: registered
          ? "Say in one short sentence what to do next, from the first item still to do."
          : "Say in one short sentence that registering comes first, and offer to show how.",
      },
      ui: [{ type: "obligations_card", items, note: e.note }],
    };
  },

  show_reminder(state, _input, ctx) {
    const period = filingPeriod(ctx.today);
    if (hasSeveralBusinesses(state)) {
      // One reminder card for each business, since each files its own return.
      const list = businessList(state);
      return {
        state,
        result: {
          reminders: list.map((b) => {
            const filed = findReturn(state, period, b.id);
            return {
              business: b.name,
              ...estimateResult(taxEstimate(entriesFor(state.entries, b.id), period)),
              ...(filed ? { already_filed: { reference: filed.reference } } : {}),
            };
          }),
          reminder_days_before: TAX.reminderDaysBefore,
          message: `Write this as one friendly reminder sent ${TAX.reminderDaysBefore} days before the due date. Each business files its own return.`,
        },
        ui: list.map((b) => {
          const e = taxEstimate(entriesFor(state.entries, b.id), period);
          return {
            type: "reminder_card" as const,
            period,
            dueDate: dueDate(period),
            taxEstimate: e.estimate,
            note: e.note,
            ...cardBusiness(state, b),
          };
        }),
      };
    }
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

  get_statement(state, input, ctx) {
    const check = resolveStatementPeriod(input.period ?? "this_month", ctx.today);
    if (!check.ok) {
      return fail(
        state,
        check.error,
        check.error === "future_period"
          ? "That month hasn't started yet."
          : 'Not a valid period. Use "this_month", "last_month", a month like "2026-10", or "all".',
      );
    }
    let businessId: string | undefined;
    if (hasSeveralBusinesses(state) && input.business) {
      const picked = pickBusiness(state, input.business);
      if (!picked.ok) return picked.outcome;
      businessId = picked.business.id;
    }
    const st = buildStatement(state, check.key, ctx.today, businessId);
    const period = {
      statement: st.title,
      ...(st.businessName ? { business: st.businessName } : {}),
      from: formatDate(st.start),
      to: formatDate(st.end),
    };
    if (st.entries.length === 0) {
      return {
        state,
        result: {
          ...period,
          entries: 0,
          message: "There are no records in this period, so there is nothing to put in a statement. Tell the trader.",
        },
      };
    }
    const sm = st.summary;
    return {
      state,
      result: {
        ...period,
        money_in: money(sm.moneyIn),
        money_out: money(sm.moneyOut),
        profit_estimate: money(sm.profit),
        ...clientMoneyResult(sm.clientMoney),
        entries: sm.entryCount,
        returns_filed: st.returns.map((r) => r.period),
        shown: "statement card with Open statement and Download spreadsheet buttons",
        message:
          "Point the trader to the buttons in one short sentence: Open statement shows it to print or save as a PDF, and Download spreadsheet saves a file. Say it is made from their own records and isn't an official RSL document. Never type a web address.",
      },
      ui: [
        {
          type: "statement_card",
          period: st.key,
          title: st.title,
          start: st.start,
          end: st.end,
          moneyIn: sm.moneyIn,
          moneyOut: sm.moneyOut,
          clientMoney: sm.clientMoney,
          profit: sm.profit,
          entryCount: sm.entryCount,
          ...(st.byBusiness ? { byBusiness: st.byBusiness } : {}),
          ...(businessId ? { businessId, businessName: st.businessName } : {}),
        },
      ],
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
    // With several businesses, the card says which one, or offers a Save
    // button for each when the trader hasn't said.
    let forBusiness: Partial<Extract<UiBlock, { type: "receipt_card" }>> = {};
    if (hasSeveralBusinesses(state)) {
      if (input.business) {
        const picked = pickBusiness(state, input.business);
        if (!picked.ok) return picked.outcome;
        forBusiness = cardBusiness(state, picked.business);
      } else {
        forBusiness = { businesses: businessList(state).map((b) => ({ id: b.id, name: b.name })) };
      }
    }
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
        ...(forBusiness.businessName ? { business: forBusiness.businessName } : {}),
        message: forBusiness.businesses
          ? "Nothing is saved until the trader taps Save. The card has a Save button for each business: ask them to check it and tap the one the purchase is for."
          : "Nothing is saved until the trader taps Save. Ask them to check the card.",
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
          ...forBusiness,
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
    // The Save button carries the business; without one it is the first business.
    const picked = pickBusiness(state, actionBusiness(action));
    if (!picked.ok) return picked.outcome;

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
      ...storedBusinessId(picked.business.id),
      receipt: {
        ...(action.invoiceNumber ? { invoiceNumber: action.invoiceNumber } : {}),
        ...(action.deviceId ? { deviceId: action.deviceId } : {}),
        lekuka: lekuka.status,
      },
    };
    const next = { ...state, entries: [...state.entries, entry] };
    return {
      state: next,
      result: {
        recorded: entryResult(entry),
        ...businessResult(state, picked.business),
        week_of_entry: entryWeekTotals(next, entry.date, ctx.today, picked.business.id),
      },
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
