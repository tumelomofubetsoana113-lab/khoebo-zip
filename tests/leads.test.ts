import { describe, expect, it } from "vitest";
import data from "@/data/leads.json";
import { leadResultFigures } from "@/components/officer/LeadResults";
import {
  EMPTY_LEAD_QUERY,
  filterLeads,
  LEAD_ACTIONS,
  LEAD_KEY,
  leadCounts,
  leadQueryString,
  LeadsSchema,
  parseLeadQuery,
  pipelineFigures,
  toggleLeadAction,
} from "@/lib/leads";

const leads = LeadsSchema.parse(data);
const find = (id: string) => leads.leads.find((l) => l.id === id)!;

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [k, ...keysDeep(v)]);
  }
  return [];
}

describe("data/leads.json", () => {
  it("has no hidden_ field anywhere", () => {
    expect(keysDeep(data).filter((k) => k.startsWith("hidden_"))).toEqual([]);
  });

  it("refuses an unexpected field", () => {
    const leaky = structuredClone(data) as { leads: Record<string, unknown>[] };
    leaky.leads[0].hidden_situation = "active_unregistered";
    expect(LeadsSchema.safeParse(leaky).success).toBe(false);
  });

  it("holds 200 simulated leads plus four demo leads, each counted once", () => {
    expect(leads.simulated).toBe(200);
    expect(leads.leads).toHaveLength(204);
    expect(new Set(leads.leads.map((l) => l.id)).size).toBe(204);
    for (const action of LEAD_ACTIONS) {
      expect(leads.counts[action]).toBe(leads.leads.filter((l) => l.action === action).length);
    }
  });

  it("covers runners, couriers, flea markets and online sellers", () => {
    const kinds = new Set(leads.leads.map((l) => l.kind));
    for (const k of ["Runner (cross-border)", "Courier or delivery", "Flea market stall", "Online seller"]) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  it("gives every lead at least one reason", () => {
    for (const lead of leads.leads) expect(lead.reasons.length).toBeGreaterThan(0);
  });
});

describe("demo leads", () => {
  it("shows one lead per action", () => {
    expect(leads.pinned).toEqual(["LEAD-RUNNER", "LEAD-FLEA", "LEAD-COURIER", "LEAD-FAMILY"]);
    expect(find("LEAD-RUNNER").action).toBe("INVITE TO REGISTER");
    expect(find("LEAD-FLEA").action).toBe("FIELD VISIT");
    expect(find("LEAD-COURIER").action).toBe("POSSIBLE MATCH");
    expect(find("LEAD-FAMILY").action).toBe("NOT ENOUGH EVIDENCE");
  });

  it("explains each one in plain words", () => {
    expect(find("LEAD-RUNNER").reasons.join(" ")).toMatch(/only the fee is turnover/);
    expect(find("LEAD-FLEA").reasons.join(" ")).toMatch(/no phone number on record/);
    expect(find("LEAD-COURIER").reasons.join(" ")).toMatch(/nobody is asked to register twice/);
    expect(find("LEAD-FAMILY").reasons.join(" ")).toMatch(/family support/);
  });

  it("never contacts someone on mobile money from family alone", () => {
    const familyOnly = leads.leads.filter((l) => l.sources.length === 0);
    expect(familyOnly.every((l) => l.action === "NOT ENOUGH EVIDENCE" || l.action === "POSSIBLE MATCH")).toBe(true);
  });
});

describe("lead filters", () => {
  it("filters by action, district and kind", () => {
    const visits = filterLeads(leads.leads, { ...EMPTY_LEAD_QUERY, actions: ["visit"] });
    expect(visits).toHaveLength(leads.counts["FIELD VISIT"]);
    expect(visits.every((l) => LEAD_KEY[l.action] === "visit")).toBe(true);
    const runners = filterLeads(leads.leads, { ...EMPTY_LEAD_QUERY, kind: "Runner (cross-border)", district: "Maseru" });
    expect(runners.length).toBeGreaterThan(0);
    expect(runners.every((l) => l.kind === "Runner (cross-border)" && l.district === "Maseru")).toBe(true);
  });

  it("round-trips through the URL, in a fixed action order", () => {
    const q = toggleLeadAction(toggleLeadAction(EMPTY_LEAD_QUERY, "invite"), "visit");
    expect(q.actions).toEqual(["visit", "invite"]);
    const s = leadQueryString({ ...q, district: "Berea" });
    expect(s).toBe("?action=visit%2Cinvite&district=Berea");
    expect(parseLeadQuery(new URLSearchParams(s))).toEqual({ ...q, district: "Berea", kind: "" });
    expect(parseLeadQuery(new URLSearchParams("?action=bogus,match"))).toEqual({ ...EMPTY_LEAD_QUERY, actions: ["match"] });
  });
});

describe("pipeline and results", () => {
  it("adds up the stages from both lists", () => {
    const f = pipelineFigures(leadCounts(leads), { followup: 35, review: 30, checkin: 62, none: 176 });
    expect(f.leads).toBe(204);
    expect(f.found).toBe(leads.counts["FIELD VISIT"] + leads.counts["INVITE TO REGISTER"] + leads.counts["POSSIBLE MATCH"]);
    expect(f.invites).toBe(leads.counts["INVITE TO REGISTER"]);
    expect(f.registered).toBe(303);
    expect(f.followUp).toBe(127);
    expect(f.inLine).toBe(176);
  });

  it("reads the 30-population figures from the data file", () => {
    const runs = leads.thirtyRuns;
    const [fewer, precision, reached] = leadResultFigures(runs);
    expect(fewer.value).toBe(`${Math.round((1 - runs.visits.mean / runs.baseline_visits.mean) * 100)}% fewer field visits`);
    expect(precision.value).toBe(`${Math.round(runs.visit_precision.mean * 100)}% of field visits`);
    expect(reached.value).toBe(`${Math.round(runs.reached.mean * 100)}% reached`);
    // The rules must beat visiting every lead.
    expect(runs.visit_precision.mean).toBeGreaterThan(runs.baseline_precision.mean);
    expect(runs.visits.mean).toBeLessThan(runs.baseline_visits.mean);
  });
});
