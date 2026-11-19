// The chat as the browser keeps it: messages with their UI blocks, saved in
// localStorage next to the trader's state. Pure helpers, so they can be tested.

import { z } from "zod";
import { strings } from "./strings";
import { ChatActionSchema, type ChatAction, type UiBlock } from "./blocks";
import type { TraderState } from "./state";
import { scopedKey } from "./storage-scope";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string; // ISO timestamp
  voice?: { duration: string }; // a (simulated) voice note; text is its transcript
  attachment?: "photo" | "pdf"; // a receipt was sent; the file itself is never saved
  button?: boolean; // shows a button tap, e.g. "Confirm"
  action?: ChatAction; // the action a button bubble sent, for retrying
  ui?: UiBlock[];
  used?: string[]; // buttons already tapped on this message's cards
  status?: "sending" | "failed";
};

export const CHAT_KEY = "khoebo.chat.v1";
const MAX_SAVED = 200;
const HISTORY_TURNS = 20;

// Loose on purpose: UI blocks are only rendered, never trusted for records.
const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  at: z.string(),
  voice: z.object({ duration: z.string() }).optional(),
  attachment: z.enum(["photo", "pdf"]).optional(),
  button: z.boolean().optional(),
  action: ChatActionSchema.optional(),
  ui: z.array(z.object({ type: z.string() }).loose()).optional(),
  used: z.array(z.string()).optional(),
  status: z.enum(["sending", "failed"]).optional(),
});

let counter = 0;
export function messageId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export function greeting(now: string): ChatMessage {
  return {
    id: messageId(),
    role: "assistant",
    text: strings.chat.greeting,
    at: now,
    ui: [{ type: "quick_replies", options: [...strings.onboarding.businessTypes] }],
  };
}

// Opening an officer's field-visit link (/trader?via=field&district=...&kind=...)
// on a phone that isn't set up yet: the district and business type are filled
// in, and the first question is whether they're registered. Values must be on
// the chat's own lists. A phone that is already set up is left alone, so a
// link can never overwrite someone's records.
export function fieldVisitStart(
  search: string,
  state: TraderState,
  now: string,
): { state: TraderState; message: ChatMessage } | null {
  const params = new URLSearchParams(search);
  if (params.get("via") !== "field") return null;
  if (state.onboardingDone || state.entries.length > 0) return null;

  const district = params.get("district") ?? "";
  const kind = params.get("kind") ?? "";
  const districtOk = (strings.onboarding.districts as readonly string[]).includes(district);
  const kindOk = (strings.onboarding.businessTypes as readonly string[]).includes(kind) && kind !== "Other";

  const profile: TraderState["profile"] = {
    ...state.profile,
    ...(districtOk ? { district } : {}),
    ...(kindOk ? { businessType: kind } : {}),
    setUpAt: "field_visit",
  };
  const g = strings.chat.fieldVisit;
  return {
    state: { ...state, profile },
    message: {
      id: messageId(),
      role: "assistant",
      text: districtOk && kindOk ? g.greeting(kind, district) : g.greetingPlain,
      at: now,
      ui: [
        {
          type: "quick_replies",
          options: districtOk && kindOk ? [...g.registeredReplies] : [...strings.onboarding.businessTypes],
        },
      ],
    },
  };
}

export function demoWelcome(now: string, who: "trader" | "runner" | "multi" = "trader"): ChatMessage {
  const c = strings.chat;
  const welcome = {
    trader: { text: c.demoLoaded, options: c.demoQuickReplies },
    runner: { text: c.demoRunnerLoaded, options: c.demoRunnerQuickReplies },
    multi: { text: c.demoMultiLoaded, options: c.demoMultiQuickReplies },
  }[who];
  return {
    id: messageId(),
    role: "assistant",
    text: welcome.text,
    at: now,
    ui: [{ type: "quick_replies", options: [...welcome.options] }],
  };
}

// What the API sees: the last 20 delivered messages, as role and text.
// Failed and still-sending messages are left out; the caller adds the new one.
export function buildHistory(messages: ChatMessage[]) {
  return messages
    .filter((m) => !m.status && m.text.trim())
    .slice(-HISTORY_TURNS)
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.text.slice(0, 500), ...(m.voice ? { voice: true } : {}) }
        : { role: "assistant" as const, content: m.text.slice(0, 4000) },
    );
}

// Quick replies show only under the latest message, and only if it's from Khoebo.
export function currentQuickReplies(messages: ChatMessage[]): string[] {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") return [];
  const block = last.ui?.findLast((b) => b.type === "quick_replies");
  return block?.type === "quick_replies" ? block.options : [];
}

// A key for one button on one card, so it can only be tapped once.
export function buttonKey(action: ChatAction): string {
  switch (action.type) {
    case "undo_entry":
      return `undo:${action.entryId}`;
    case "simulate_reminder":
      return "reminder";
    // One key for every Save button on a receipt card (one per business), so
    // saving to one business uses up the others too.
    case "confirm_receipt":
    case "change_receipt":
      return `${action.type}:${action.receiptId}`;
    default:
      // The first business keeps the key used before 19 Nov 2026.
      return `${action.type}:${action.period}${action.businessId ? `:${action.businessId}` : ""}`;
  }
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadChat(store: Store | null = defaultStore()): ChatMessage[] | null {
  try {
    const raw = store?.getItem(scopedKey(CHAT_KEY));
    if (!raw) return null;
    const parsed = z.array(ChatMessageSchema).safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    // A message still "sending" when the page closed never got a reply.
    return (parsed.data as ChatMessage[]).map((m) => (m.status === "sending" ? { ...m, status: "failed" } : m));
  } catch {
    return null;
  }
}

export function saveChat(messages: ChatMessage[], store: Store | null = defaultStore()): void {
  try {
    store?.setItem(scopedKey(CHAT_KEY), JSON.stringify(messages.slice(-MAX_SAVED)));
  } catch {
    // storage full or blocked: the chat still works for this visit
  }
}

export function clearChat(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(scopedKey(CHAT_KEY));
  } catch {
    // nothing to clear
  }
}
