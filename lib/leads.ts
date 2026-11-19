import { z } from "zod";
import type { ActionKey } from "./strings";

// Potential registrants written by scripts/export_worklist.py (see
// scripts/leads.py): simulated operators outside the tax net, found through
// third-party signals. Types, the schema and pure functions only, so this file
// is safe in the browser. The data is loaded in lib/leads-data.ts.

export const LEAD_ACTIONS = ["FIELD VISIT", "INVITE TO REGISTER", "POSSIBLE MATCH", "NOT ENOUGH EVIDENCE"] as const;
export type LeadAction = (typeof LEAD_ACTIONS)[number];

export type LeadKey = "visit" | "invite" | "match" | "unclear";
export const LEAD_ORDER: LeadKey[] = ["visit", "invite", "match", "unclear"];

export const LEAD_KEY: Record<LeadAction, LeadKey> = {
  "FIELD VISIT": "visit",
  "INVITE TO REGISTER": "invite",
  "POSSIBLE MATCH": "match",
  "NOT ENOUGH EVIDENCE": "unclear",
};

// Each lead action borrows the colours of the worklist action that means the
// same kind of thing: amber for a visit, blue for an officer's check, grey for
// an automated message, green for no contact.
export const LEAD_TONE: Record<LeadKey, ActionKey> = {
  visit: "followup",
  match: "review",
  invite: "checkin",
  unclear: "none",
};

export const SOURCES = ["einvoice", "momo", "border", "courier"] as const;
export type Source = (typeof SOURCES)[number];

const stat = z.strictObject({ mean: z.number(), min: z.number(), max: z.number() });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const LeadSchema = z.strictObject({
  id: z.string().regex(/^LEAD-(\d{4}|[A-Z]+)$/),
  label: z.string().nullable(),
  kind: z.string(),
  district: z.string(),
  action: z.enum(LEAD_ACTIONS),
  reasons: z.array(z.string()).min(1),
  sources: z.array(z.enum(SOURCES)),
  activeMonths: z.number().int().min(0).max(6),
  phone: z.boolean(),
});

// Strict objects: an unexpected field (a hidden_ column, say) fails to load.
export const LeadsSchema = z.strictObject({
  generatedAt: z.iso.date(),
  window: z.array(month).length(6),
  simulated: z.number().int().positive(),
  counts: z.strictObject({
    "FIELD VISIT": z.number().int().nonnegative(),
    "INVITE TO REGISTER": z.number().int().nonnegative(),
    "POSSIBLE MATCH": z.number().int().nonnegative(),
    "NOT ENOUGH EVIDENCE": z.number().int().nonnegative(),
  }),
  pinned: z.array(z.string()),
  leads: z.array(LeadSchema),
  thirtyRuns: z.strictObject({
    leads: stat,
    active_unregistered: stat,
    visits: stat,
    invites: stat,
    visit_precision: stat,
    contact_precision: stat,
    reached: stat,
    registered_contacted: stat,
    baseline_visits: stat,
    baseline_precision: stat,
  }),
});

export type Lead = z.infer<typeof LeadSchema>;
export type Leads = z.infer<typeof LeadsSchema>;

export function leadCounts(leads: Leads): Record<LeadKey, number> {
  return Object.fromEntries(LEAD_ACTIONS.map((a) => [LEAD_KEY[a], leads.counts[a]])) as Record<LeadKey, number>;
}

// ---- Field visits ----

// A lead's kind as one of the chat's business types, where the names differ.
const KIND_TO_BUSINESS_TYPE: Record<string, string> = { "Flea market stall": "Clothing or flea market" };

// The link an officer shows at a field visit, as a QR code. Opening it on the
// trader's phone starts Khoebo with their district and kind of business filled in.
export function fieldVisitPath(lead: Pick<Lead, "district" | "kind">): string {
  const params = new URLSearchParams({
    via: "field",
    district: lead.district,
    kind: KIND_TO_BUSINESS_TYPE[lead.kind] ?? lead.kind,
  });
  return `/trader/chat?${params.toString()}`;
}

// ---- Filters ----

export type LeadQuery = { actions: LeadKey[]; district: string; kind: string };
export const EMPTY_LEAD_QUERY: LeadQuery = { actions: [], district: "", kind: "" };

type Params = { get(name: string): string | null };

export function parseLeadQuery(params: Params): LeadQuery {
  const actions = (params.get("action") ?? "").split(",");
  return {
    actions: LEAD_ORDER.filter((a) => actions.includes(a)),
    district: (params.get("district") ?? "").slice(0, 40),
    kind: (params.get("kind") ?? "").slice(0, 60),
  };
}

export function leadQueryString(q: LeadQuery): string {
  const params = new URLSearchParams();
  if (q.actions.length) params.set("action", q.actions.join(","));
  if (q.district) params.set("district", q.district);
  if (q.kind) params.set("kind", q.kind);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function filterLeads(leads: Lead[], q: LeadQuery): Lead[] {
  return leads.filter(
    (l) =>
      (!q.actions.length || q.actions.includes(LEAD_KEY[l.action])) &&
      (!q.district || l.district === q.district) &&
      (!q.kind || l.kind === q.kind),
  );
}

export function toggleLeadAction(q: LeadQuery, action: LeadKey): LeadQuery {
  const on = q.actions.includes(action);
  return { ...q, actions: LEAD_ORDER.filter((a) => (a === action ? !on : q.actions.includes(a))) };
}

// ---- The compliance pipeline, from finding an operator to following up ----

export type PipelineFigures = {
  found: number; // leads with enough evidence to act on (visit, invite or match)
  leads: number; // every lead looked at
  invites: number;
  visits: number;
  registered: number; // traders in the worklist
  inLine: number; // worklist: no action
  followUp: number; // worklist: follow-up, review or check-in
};

export function pipelineFigures(
  lead: Record<LeadKey, number>,
  worklist: Record<ActionKey, number>,
): PipelineFigures {
  return {
    found: lead.visit + lead.invite + lead.match,
    leads: lead.visit + lead.invite + lead.match + lead.unclear,
    invites: lead.invite,
    visits: lead.visit,
    registered: worklist.followup + worklist.review + worklist.checkin + worklist.none,
    inLine: worklist.none,
    followUp: worklist.followup + worklist.review + worklist.checkin,
  };
}
