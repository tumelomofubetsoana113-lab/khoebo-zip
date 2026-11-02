import { z } from "zod";
import type { ActionKey } from "./strings";

// The officer worklist written by scripts/export_worklist.py. Types, the schema
// and pure filter and sort functions only: this file is safe to import in the
// browser. The data itself is loaded in lib/worklist-data.ts, on the server.

export const RULE_ACTIONS = ["OFFICER FOLLOW-UP", "HUMAN REVIEW", "AUTOMATED CHECK-IN", "NO ACTION"] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];

// Action order for sorting and display: follow-up, review, check-in, none.
export const ACTION_ORDER: ActionKey[] = ["followup", "review", "checkin", "none"];

export const ACTION_KEY: Record<RuleAction, ActionKey> = {
  "OFFICER FOLLOW-UP": "followup",
  "HUMAN REVIEW": "review",
  "AUTOMATED CHECK-IN": "checkin",
  "NO ACTION": "none",
};

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const amount = z.number().int().nonnegative();

export const MonthFiguresSchema = z.strictObject({
  month,
  declared: amount.nullable(), // null when no return was filed
  purchases: amount,
  walletInflows: amount,
  evidenceMin: amount,
  filed: z.boolean(),
  onTime: z.boolean(),
});

export const WorklistTraderSchema = z.strictObject({
  id: z.string().regex(/^(TRD-\d{4}|DEMO-[A-Z]+)$/),
  label: z.string().nullable(),
  sector: z.string(),
  district: z.string(),
  action: z.enum(RULE_ACTIONS),
  reasons: z.array(z.string()).min(1),
  metrics: z.strictObject({
    declared: amount,
    evidenceMin: amount,
    ratio: z.number().nonnegative().nullable(),
    evidenceMonths: z.number().int().min(0).max(6),
    nilReturns: z.number().int().min(0).max(6),
    missingReturns: z.number().int().min(0).max(6),
    licenceActive: z.boolean(),
  }),
  months: z.array(MonthFiguresSchema).length(6),
});

// Strict objects: an unexpected field (a hidden_ column, say) fails to load.
export const WorklistSchema = z.strictObject({
  generatedAt: z.iso.date(),
  window: z.array(month).length(6),
  simulated: z.number().int().positive(),
  counts: z.strictObject({
    "OFFICER FOLLOW-UP": z.number().int().nonnegative(),
    "HUMAN REVIEW": z.number().int().nonnegative(),
    "AUTOMATED CHECK-IN": z.number().int().nonnegative(),
    "NO ACTION": z.number().int().nonnegative(),
  }),
  pinned: z.array(z.string()),
  traders: z.array(WorklistTraderSchema),
});

export type MonthFigures = z.infer<typeof MonthFiguresSchema>;
export type WorklistTrader = z.infer<typeof WorklistTraderSchema>;
export type Worklist = z.infer<typeof WorklistSchema>;

// One table row: only what the worklist page needs in the browser.
export type WorklistRow = {
  id: string;
  label: string | null;
  sector: string;
  district: string;
  action: ActionKey;
  declared: number;
  evidenceMin: number;
  evidenceMonths: number;
  nilReturns: number;
};

export function toRow(t: WorklistTrader): WorklistRow {
  return {
    id: t.id,
    label: t.label,
    sector: t.sector,
    district: t.district,
    action: ACTION_KEY[t.action],
    declared: t.metrics.declared,
    evidenceMin: t.metrics.evidenceMin,
    evidenceMonths: t.metrics.evidenceMonths,
    nilReturns: t.metrics.nilReturns,
  };
}

// Action order, then the biggest gap between evidence and declared, then ID.
export function sortRows(rows: WorklistRow[]): WorklistRow[] {
  return [...rows].sort(
    (a, b) =>
      ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action) ||
      b.evidenceMin - b.declared - (a.evidenceMin - a.declared) ||
      a.id.localeCompare(b.id),
  );
}

// ---- Filters, kept in the URL so a filtered view can be shared ----

export type WorklistQuery = {
  actions: ActionKey[]; // empty = all
  district: string; // "" = all
  sector: string; // "" = all
  search: string;
};

export const EMPTY_QUERY: WorklistQuery = { actions: [], district: "", sector: "", search: "" };

// The list shows this many traders at a time, with a "Show more" button.
// Drawing all 303 at once blocked a mid-range phone for about 3 seconds.
export const PAGE_SIZE = 50;

// How many more rows "Show more" adds: a full page, or whatever is left.
export function nextPage(listed: number, matching: number): number {
  return Math.max(0, Math.min(PAGE_SIZE, matching - listed));
}

type Params = { get(name: string): string | null };

export function parseQuery(params: Params): WorklistQuery {
  const actions = (params.get("action") ?? "")
    .split(",")
    .filter((a): a is ActionKey => (ACTION_ORDER as string[]).includes(a));
  return {
    actions: ACTION_ORDER.filter((a) => actions.includes(a)),
    district: (params.get("district") ?? "").slice(0, 40),
    sector: (params.get("sector") ?? "").slice(0, 60),
    search: (params.get("q") ?? "").slice(0, 40),
  };
}

export function queryString(q: WorklistQuery): string {
  const params = new URLSearchParams();
  if (q.actions.length) params.set("action", q.actions.join(","));
  if (q.district) params.set("district", q.district);
  if (q.sector) params.set("sector", q.sector);
  if (q.search.trim()) params.set("q", q.search.trim());
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function filterRows(rows: WorklistRow[], q: WorklistQuery): WorklistRow[] {
  const search = q.search.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q.actions.length || q.actions.includes(r.action)) &&
      (!q.district || r.district === q.district) &&
      (!q.sector || r.sector === q.sector) &&
      (!search || r.id.toLowerCase().includes(search) || (r.label ?? "").toLowerCase().includes(search)),
  );
}

export function toggleAction(q: WorklistQuery, action: ActionKey): WorklistQuery {
  const on = q.actions.includes(action);
  return {
    ...q,
    actions: ACTION_ORDER.filter((a) => (a === action ? !on : q.actions.includes(a))),
  };
}

// ---- Display helpers ----

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-05" → "May"
export function monthShort(ym: string): string {
  return MONTH_NAMES[Number(ym.slice(5, 7)) - 1] ?? ym;
}

// "May to Oct 2026"
export function windowLabel(window: string[]): string {
  const first = window[0];
  const last = window[window.length - 1];
  if (!first || !last) return "";
  return `${monthShort(first)} to ${monthShort(last)} ${last.slice(0, 4)}`;
}

// Share of traders as a whole percentage.
export function sharePct(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}
