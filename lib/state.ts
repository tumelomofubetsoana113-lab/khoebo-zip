import { z } from "zod";

// The trader's whole record. It lives in the browser's localStorage and is
// sent with every chat request, so the API validates it with these schemas.

const isoDate = z.iso.date(); // YYYY-MM-DD
const money = z.number().finite().nonnegative();

export const EntrySchema = z.object({
  id: z.string().min(1).max(32),
  // client_money: money a client hands a runner to buy goods for them. It
  // isn't the runner's income: only their fee is a sale (RSL, 16 Nov 2026).
  kind: z.enum(["sale", "purchase", "client_money"]),
  amount: money.positive(),
  date: isoDate,
  note: z.string().max(100).optional(),
  // Set when the trader gave the amount in rand. The loti is pegged one to
  // one to the rand, so the amount is the same in maloti.
  currency: z.literal("rand").optional(),
  source: z.enum(["text", "voice", "button", "receipt"]),
  createdAt: z.iso.datetime(),
  // Which of the trader's businesses this belongs to (added 19 Nov 2026).
  // Left out for the first business, so records saved before then still fit.
  businessId: z.string().min(1).max(32).optional(),
  // Only for entries saved from a receipt. The picture itself is never kept.
  receipt: z
    .object({
      invoiceNumber: z.string().max(60).optional(),
      deviceId: z.string().max(60).optional(),
      lekuka: z.enum(["verified", "mismatch", "not_found", "no_code"]),
    })
    .optional(),
});

export const FiledReturnSchema = z.object({
  period: z.string().regex(/^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/),
  turnover: money,
  taxEstimate: money,
  confirmedAt: z.iso.datetime(),
  reference: z.string().startsWith("MOCK-").max(32),
  paid: z.boolean(),
  // Each business files its own return. Left out for the first business.
  businessId: z.string().min(1).max(32).optional(),
});

// A second (third...) business or branch. The first business is the profile's
// own business type and district, with the id "main".
export const BusinessSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(60),
  type: z.string().max(60).optional(),
  district: z.string().max(60).optional(),
});

export const TraderStateSchema = z.object({
  version: z.literal(1),
  onboardingDone: z.boolean(),
  profile: z.object({
    name: z.string().max(60).optional(),
    businessType: z.string().max(60).optional(),
    district: z.string().max(60).optional(),
    registered: z.enum(["yes", "no", "not_sure"]).nullable(),
    language: z.literal("en"),
    // Set up from an RSL officer's field-visit link (added 17 Nov 2026).
    setUpAt: z.literal("field_visit").optional(),
    // The trader's own name for their first business, once they have more than one.
    businessName: z.string().max(60).optional(),
  }),
  // Further businesses or branches (added 19 Nov 2026). Missing for most traders.
  businesses: z.array(BusinessSchema).max(10).optional(),
  entries: z.array(EntrySchema).max(5000),
  returns: z.array(FiledReturnSchema).max(100),
  messageCount: z.number().int().nonnegative(),
});

export type Entry = z.infer<typeof EntrySchema>;
export type FiledReturn = z.infer<typeof FiledReturnSchema>;
export type Business = z.infer<typeof BusinessSchema>;
export type TraderState = z.infer<typeof TraderStateSchema>;

export const STORAGE_KEY = "khoebo.trader.v1";

export function emptyState(): TraderState {
  return {
    version: 1,
    onboardingDone: false,
    profile: { registered: null, language: "en" },
    entries: [],
    returns: [],
    messageCount: 0,
  };
}

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage blocked, e.g. in a private window
  }
}

// Returns a fresh state when nothing is saved, the saved value is broken,
// or storage can't be read. Never throws.
export function loadState(store: KeyValueStore | null = defaultStore()): TraderState {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = TraderStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyState();
  } catch {
    return emptyState();
  }
}

// Returns false if the state couldn't be saved (storage full or blocked).
export function saveState(state: TraderState, store: KeyValueStore | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}
