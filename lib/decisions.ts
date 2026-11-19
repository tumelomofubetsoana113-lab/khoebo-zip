import { z } from "zod";

// Officer decisions on the trader detail page. In this demo they live in
// the officer's browser (localStorage); in a pilot they go to RSL's case system.

export const DECISIONS = ["agree_followup", "agree_review", "change_checkin", "change_none", "escalate"] as const;
export type Decision = (typeof DECISIONS)[number];

export const MIN_REASON = 10;
export const MAX_REASON = 500;

export const DecisionRecordSchema = z.object({
  decision: z.enum(DECISIONS),
  reason: z.string().min(MIN_REASON).max(MAX_REASON),
  at: z.iso.datetime(),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

const DecisionLogSchema = z.record(z.string().max(32), z.array(DecisionRecordSchema).max(200));
export type DecisionLog = z.infer<typeof DecisionLogSchema>;

export const DECISIONS_KEY = "khoebo.decisions.v1";

export type DecisionCheck =
  | { ok: true; record: DecisionRecord }
  | { ok: false; error: "no_decision" | "reason_too_short" | "reason_too_long" };

export function checkDecision(decision: string, reason: string, at: string): DecisionCheck {
  if (!(DECISIONS as readonly string[]).includes(decision)) return { ok: false, error: "no_decision" };
  const text = reason.trim();
  if (text.length < MIN_REASON) return { ok: false, error: "reason_too_short" };
  if (text.length > MAX_REASON) return { ok: false, error: "reason_too_long" };
  return { ok: true, record: { decision: decision as Decision, reason: text, at } };
}

// Newest first.
export function addDecision(log: DecisionLog, traderId: string, record: DecisionRecord): DecisionLog {
  return { ...log, [traderId]: [record, ...(log[traderId] ?? [])].slice(0, 200) };
}

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// An empty log when nothing is saved or the saved value is broken. Never throws.
export function loadDecisions(store: KeyValueStore | null = defaultStore()): DecisionLog {
  try {
    const raw = store?.getItem(DECISIONS_KEY);
    if (!raw) return {};
    const parsed = DecisionLogSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function saveDecisions(log: DecisionLog, store: KeyValueStore | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(DECISIONS_KEY, JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}
