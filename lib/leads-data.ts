import "server-only";
import data from "@/data/leads.json";
import { LeadsSchema, type Lead } from "./leads";

// The leads JSON, checked once when the server loads it.
export const leads = LeadsSchema.parse(data);

const byId = new Map(leads.leads.map((l) => [l.id, l]));

export function pinnedLeads(): Lead[] {
  return leads.pinned.flatMap((id) => byId.get(id) ?? []);
}

export function leadDistricts(): string[] {
  return [...new Set(leads.leads.map((l) => l.district))].sort();
}

export function leadKinds(): string[] {
  return [...new Set(leads.leads.map((l) => l.kind))].sort();
}
