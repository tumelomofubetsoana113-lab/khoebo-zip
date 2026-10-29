import { describe, expect, it } from "vitest";
import {
  buildHistory,
  buttonKey,
  CHAT_KEY,
  currentQuickReplies,
  greeting,
  loadChat,
  saveChat,
  type ChatMessage,
} from "@/lib/chat";
import { addDays, weekdayName } from "@/lib/dates";
import { demoTraderState } from "@/lib/demo";
import { summarize, summaryRange } from "@/lib/ledger";
import { TraderStateSchema } from "@/lib/state";

const AT = "2026-10-29T08:00:00.000Z";

function msg(role: ChatMessage["role"], text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: `${role}-${text}`, role, text, at: AT, ...extra };
}

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("buildHistory", () => {
  it("sends delivered messages as role and text, marking voice notes", () => {
    const messages = [
      greeting(AT),
      msg("user", "Fruit and veg"),
      msg("assistant", "Which district?"),
      msg("user", "Sold four hundred", { voice: { duration: "0:04" } }),
    ];
    expect(buildHistory(messages)).toEqual([
      { role: "assistant", content: messages[0].text },
      { role: "user", content: "Fruit and veg" },
      { role: "assistant", content: "Which district?" },
      { role: "user", content: "Sold four hundred", voice: true },
    ]);
  });

  it("leaves out failed and sending messages, and keeps the last 20", () => {
    const many = Array.from({ length: 30 }, (_, i) => msg(i % 2 ? "assistant" : "user", `m${i}`));
    const history = buildHistory([...many, msg("user", "lost", { status: "failed" }), msg("user", "new", { status: "sending" })]);
    expect(history).toHaveLength(20);
    expect(history.at(-1)).toEqual({ role: "assistant", content: "m29" });
  });
});

describe("currentQuickReplies", () => {
  const ask = msg("assistant", "Sale or purchase?", {
    ui: [{ type: "quick_replies", options: ["Sale", "Purchase"] }],
  });

  it("shows quick replies under the latest assistant message only", () => {
    expect(currentQuickReplies([ask])).toEqual(["Sale", "Purchase"]);
    expect(currentQuickReplies([ask, msg("user", "Sale")])).toEqual([]);
    expect(currentQuickReplies([ask, msg("user", "Sale"), msg("assistant", "Recorded.")])).toEqual([]);
    expect(currentQuickReplies([])).toEqual([]);
  });

  it("starts with the business types", () => {
    expect(currentQuickReplies([greeting(AT)])).toContain("Fruit and veg");
  });
});

describe("buttonKey", () => {
  it("identifies each button once", () => {
    expect(buttonKey({ type: "confirm_return", period: "2026-Q4", turnover: 5 })).toBe("confirm_return:2026-Q4");
    expect(buttonKey({ type: "undo_entry", entryId: "abc" })).toBe("undo:abc");
  });
});

describe("chat storage", () => {
  it("round-trips, and marks a message left sending as failed", () => {
    const store = memoryStore();
    saveChat([greeting(AT), msg("user", "sold 350", { status: "sending" })], store);
    const loaded = loadChat(store);
    expect(loaded).toHaveLength(2);
    expect(loaded?.[1].status).toBe("failed");
  });

  it("returns null for nothing saved or broken data", () => {
    const store = memoryStore();
    expect(loadChat(store)).toBeNull();
    store.setItem(CHAT_KEY, "{broken");
    expect(loadChat(store)).toBeNull();
    expect(loadChat(null)).toBeNull();
  });
});

describe("demo trader", () => {
  const today = "2026-10-29";
  const state = demoTraderState(today);

  it("is a valid, set-up trader in Maseru", () => {
    expect(TraderStateSchema.safeParse(state).success).toBe(true);
    expect(state.profile).toMatchObject({ businessType: "Fruit and veg", district: "Maseru", registered: "yes" });
    expect(state.onboardingDone).toBe(true);
  });

  it("has a sale every day for four weeks and purchases twice a week", () => {
    const sales = state.entries.filter((e) => e.kind === "sale");
    const purchases = state.entries.filter((e) => e.kind === "purchase");
    expect(sales).toHaveLength(28);
    expect(sales[0].date).toBe("2026-10-02");
    expect(sales.at(-1)?.date).toBe(today);
    expect(purchases).toHaveLength(8);
    expect(new Set(purchases.map((p) => weekdayName(p.date)))).toEqual(new Set(["Monday", "Friday"]));
  });

  it("makes a profit every full week, and so far this week from Wednesday on", () => {
    // Every day of a fortnight, so the demo looks right whichever day it runs.
    // On Monday and Tuesday "this week" can show a loss: the Monday restock
    // comes before the week's sales, as for a real trader.
    for (let i = 0; i < 14; i++) {
      const day = addDays(today, i);
      const demo = demoTraderState(day);
      expect(summarize(demo.entries, summaryRange("last_week", day), day).profit, `last week on ${day}`).toBeGreaterThan(0);
      if (!["Monday", "Tuesday"].includes(weekdayName(day))) {
        expect(summarize(demo.entries, summaryRange("this_week", day), day).profit, `this week on ${day}`).toBeGreaterThan(0);
      }
    }
  });

  it("is the same every time for the same day", () => {
    expect(demoTraderState(today)).toEqual(state);
    expect(new Set(state.entries.map((e) => e.id)).size).toBe(state.entries.length);
  });
});
