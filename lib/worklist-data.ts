import "server-only";
import data from "@/data/worklist.json";
import { toRow, WorklistSchema, type WorklistRow, type WorklistTrader } from "./worklist";

// The worklist JSON, checked once when the server loads it. Server only, so
// the full file (reasons and monthly figures for every trader) never goes into
// the browser bundle.
export const worklist = WorklistSchema.parse(data);

const byId = new Map(worklist.traders.map((t) => [t.id, t]));

export function getTrader(id: string): WorklistTrader | undefined {
  return byId.get(id);
}

export function pinnedTraders(): WorklistTrader[] {
  return worklist.pinned.flatMap((id) => byId.get(id) ?? []);
}

export function worklistRows(): WorklistRow[] {
  return worklist.traders.map(toRow);
}

export function districts(): string[] {
  return [...new Set(worklist.traders.map((t) => t.district))].sort();
}

export function sectors(): string[] {
  return [...new Set(worklist.traders.map((t) => t.sector))].sort();
}
