import { describe, expect, it } from "vitest";
import {
  clearState,
  emptyState,
  loadState,
  saveState,
  STORAGE_KEY,
  TraderStateSchema,
  type TraderState,
} from "@/lib/state";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const filled: TraderState = {
  ...emptyState(),
  onboardingDone: true,
  profile: { businessType: "Fruit and veg", district: "Maseru", registered: "yes", language: "en" },
  entries: [
    {
      id: "a1",
      kind: "sale",
      amount: 350,
      date: "2026-10-29",
      note: "tomatoes",
      source: "voice",
      createdAt: "2026-10-29T09:12:00.000Z",
    },
  ],
  returns: [
    {
      period: "2026-Q3",
      turnover: 15500,
      taxEstimate: 310,
      confirmedAt: "2026-10-15T12:00:00.000Z",
      reference: "MOCK-7KQ2",
      paid: false,
    },
  ],
  messageCount: 4,
};

describe("TraderState schema", () => {
  it("accepts an empty and a filled state", () => {
    expect(TraderStateSchema.safeParse(emptyState()).success).toBe(true);
    expect(TraderStateSchema.safeParse(filled).success).toBe(true);
  });

  it("rejects bad values", () => {
    const bad = (patch: object) => TraderStateSchema.safeParse({ ...filled, ...patch }).success;
    expect(bad({ version: 2 })).toBe(false);
    expect(bad({ messageCount: -1 })).toBe(false);
    expect(bad({ entries: [{ ...filled.entries[0], amount: 0 }] })).toBe(false);
    expect(bad({ entries: [{ ...filled.entries[0], date: "29/10/2026" }] })).toBe(false);
    expect(bad({ entries: [{ ...filled.entries[0], kind: "gift" }] })).toBe(false);
    expect(bad({ returns: [{ ...filled.returns[0], reference: "RSL-123" }] })).toBe(false);
    expect(bad({ returns: [{ ...filled.returns[0], period: "2026-Q5" }] })).toBe(false);
  });
});

describe("localStorage load and save", () => {
  it("round-trips a state", () => {
    const store = memoryStore();
    expect(saveState(filled, store)).toBe(true);
    expect(loadState(store)).toEqual(filled);
  });

  it("starts fresh when nothing is saved, the data is broken, or storage is missing", () => {
    const store = memoryStore();
    expect(loadState(store)).toEqual(emptyState());
    store.setItem(STORAGE_KEY, "{not json");
    expect(loadState(store)).toEqual(emptyState());
    store.setItem(STORAGE_KEY, JSON.stringify({ ...filled, version: 99 }));
    expect(loadState(store)).toEqual(emptyState());
    expect(loadState(null)).toEqual(emptyState());
  });

  it("never throws when storage does", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadState(broken)).toEqual(emptyState());
    expect(saveState(filled, broken)).toBe(false);
    expect(() => clearState(broken)).not.toThrow();
  });

  it("clears the saved state", () => {
    const store = memoryStore();
    saveState(filled, store);
    clearState(store);
    expect(store.data.size).toBe(0);
  });
});
