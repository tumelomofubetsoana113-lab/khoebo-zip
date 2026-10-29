import { z } from "zod";

// The trader's whole record. It lives in the browser's localStorage and is
// sent with every chat request, so the API validates it with these schemas.

const isoDate = z.iso.date(); // YYYY-MM-DD
const money = z.number().finite().nonnegative();

export const EntrySchema = z.object({
  id: z.string().min(1).max(32),
  kind: z.enum(["sale", "purchase"]),
  amount: money.positive(),
  date: isoDate,
  note: z.string().max(100).optional(),
  source: z.enum(["text", "voice", "button"]),
  createdAt: z.iso.datetime(),
});

export const FiledReturnSchema = z.object({
  period: z.string().regex(/^\d{4}-(Q[1-4]|0[1-9]|1[0-2])$/),
  turnover: money,
  taxEstimate: money,
  confirmedAt: z.iso.datetime(),
  reference: z.string().startsWith("MOCK-").max(32),
  paid: z.boolean(),
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
  }),
  entries: z.array(EntrySchema).max(5000),
  returns: z.array(FiledReturnSchema).max(100),
  messageCount: z.number().int().nonnegative(),
});

export type Entry = z.infer<typeof EntrySchema>;
export type FiledReturn = z.infer<typeof FiledReturnSchema>;
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
