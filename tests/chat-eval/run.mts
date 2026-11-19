// Chat eval (SPEC.md section 12). Sends each message in cases.json to the
// running API with a known trader state and checks which tools were called
// and what changed. Needs the app running with ANTHROPIC_API_KEY set.
//
//   npm run eval:chat                          against http://localhost:3000
//   EVAL_URL=https://... npm run eval:chat     against another server
//   EVAL_REPEAT=3 npm run eval:chat            run each case 3 times
//   EVAL_ONLY="350|RSL" npm run eval:chat      only cases whose message matches

import { readFileSync } from "node:fs";

type Entry = {
  id: string;
  kind: "sale" | "purchase" | "client_money";
  amount: number;
  date: string;
  source: string;
  createdAt: string;
  businessId?: string;
};
type State = {
  version: 1;
  onboardingDone: boolean;
  profile: Record<string, unknown>;
  entries: Entry[];
  returns: unknown[];
  messageCount: number;
  businesses?: { id: string; name: string; type?: string; district?: string }[];
};
type Expect = {
  toolsInclude?: string[];
  toolsExclude?: string[];
  noTools?: boolean;
  toolInput?: Record<string, Record<string, unknown>>;
  newEntry?: { kind: string; amount: number; date: "today" | "yesterday" };
  newEntries?: { kind: string; amount: number }[]; // exactly these, in any order, all dated today

  noNewEntry?: boolean;
  lastEntryAmount?: number;
  entryCountUnchanged?: boolean;
  noNewReturn?: boolean;
  stateUnchanged?: boolean;
  replyMatches?: string[];
  replyExcludes?: string[];
  quickReplies?: string[]; // these options, in any order
  profileMatches?: Record<string, string>; // profile field -> pattern, after the reply
  uiIncludes?: Record<string, string>; // block type -> a field on it that must be set
  uiExcludes?: string[]; // block types that must not be shown
  entryBusiness?: string; // every new entry belongs to this business ("main" for the first)
  businessCount?: number; // further businesses after the reply (not counting the first)
};
type Case = {
  message: string;
  note?: string;
  setup?: Partial<State>;
  // Earlier turns to send before the message, as the browser does (text only).
  history?: { role: "user" | "assistant"; content: string }[];
  expect: Expect;
};
type ChatResponse = {
  reply: string;
  state: State;
  ui: { type: string; options?: string[]; [field: string]: unknown }[];
  tools: { name: string; input: Record<string, unknown> }[];
};

const BASE_URL = process.env.EVAL_URL ?? "http://localhost:3000";
const REPEAT = Number(process.env.EVAL_REPEAT) || 1;
const ONLY = process.env.EVAL_ONLY ? new RegExp(process.env.EVAL_ONLY, "i") : null;
const cases: Case[] = (JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as Case[]).filter(
  (c) => !ONLY || ONLY.test(c.message),
);

// Dates in Lesotho time, as the app uses.
function lesothoDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Maseru" }).format(d);
}
const TODAY = lesothoDate();
const YESTERDAY = lesothoDate(-1);

// An onboarded fruit and veg seller. The last entry recorded is a M350 sale today.
function baseState(): State {
  const entry = (id: string, kind: Entry["kind"], amount: number, date: string, at: string): Entry => ({
    id,
    kind,
    amount,
    date,
    source: "text",
    createdAt: `${date}T${at}:00.000Z`,
  });
  return {
    version: 1,
    onboardingDone: true,
    profile: { businessType: "Fruit and veg", district: "Maseru", registered: "yes", language: "en" },
    entries: [
      entry("e1", "sale", 420, YESTERDAY, "08:00"),
      entry("e2", "purchase", 600, YESTERDAY, "09:00"),
      entry("e3", "sale", 350, TODAY, "07:00"),
    ],
    returns: [],
    messageCount: 0,
  };
}

function check(c: Case, before: State, res: ChatResponse): string[] {
  const e = c.expect;
  const problems: string[] = [];
  const names = res.tools.map((t) => t.name);
  const added = res.state.entries.filter((x) => !before.entries.some((b) => b.id === x.id));

  for (const t of e.toolsInclude ?? []) if (!names.includes(t)) problems.push(`expected a ${t} call`);
  for (const t of e.toolsExclude ?? []) if (names.includes(t)) problems.push(`didn't expect a ${t} call`);
  if (e.noTools && names.length) problems.push(`expected no tool calls, got ${names.join(", ")}`);

  for (const [tool, want] of Object.entries(e.toolInput ?? {})) {
    const calls = res.tools.filter((t) => t.name === tool);
    const ok = calls.some((call) => Object.entries(want).every(([k, v]) => call.input[k] === v));
    if (!ok) problems.push(`expected ${tool} with ${JSON.stringify(want)}, got ${JSON.stringify(calls.map((x) => x.input))}`);
  }

  if (e.newEntry) {
    const date = e.newEntry.date === "today" ? TODAY : YESTERDAY;
    const ok =
      added.length === 1 &&
      added[0].kind === e.newEntry.kind &&
      added[0].amount === e.newEntry.amount &&
      added[0].date === date;
    if (!ok) problems.push(`expected one new ${e.newEntry.kind} of ${e.newEntry.amount} on ${date}, got ${JSON.stringify(added)}`);
  }
  if (e.newEntries) {
    const ok =
      added.length === e.newEntries.length &&
      e.newEntries.every((want) => added.some((x) => x.kind === want.kind && x.amount === want.amount && x.date === TODAY));
    if (!ok) problems.push(`expected new entries ${JSON.stringify(e.newEntries)} today, got ${JSON.stringify(added)}`);
  }
  if (e.noNewEntry && added.length) problems.push(`expected nothing recorded, got ${JSON.stringify(added)}`);
  if (e.lastEntryAmount !== undefined) {
    const last = res.state.entries.find((x) => x.id === "e3");
    if (last?.amount !== e.lastEntryAmount) problems.push(`expected the last entry to be ${e.lastEntryAmount}, got ${last?.amount}`);
  }
  if (e.entryCountUnchanged && res.state.entries.length !== before.entries.length) {
    problems.push(`expected ${before.entries.length} entries, got ${res.state.entries.length}`);
  }
  if (e.noNewReturn && res.state.returns.length) problems.push("expected no return filed");
  if (e.stateUnchanged) {
    const strip = (s: State) => JSON.stringify({ ...s, messageCount: 0 });
    if (strip(res.state) !== strip(before)) problems.push("expected the records to be unchanged");
  }

  for (const pattern of e.replyMatches ?? []) {
    if (!new RegExp(pattern, "i").test(res.reply)) problems.push(`reply should match /${pattern}/`);
  }
  for (const pattern of e.replyExcludes ?? []) {
    if (new RegExp(pattern, "i").test(res.reply)) problems.push(`reply shouldn't match /${pattern}/`);
  }
  if (e.quickReplies) {
    const shown = res.ui.find((b) => b.type === "quick_replies")?.options ?? [];
    const same = shown.length === e.quickReplies.length && e.quickReplies.every((o) => shown.includes(o));
    if (!same) problems.push(`expected quick replies ${JSON.stringify(e.quickReplies)}, got ${JSON.stringify(shown)}`);
  }
  for (const [type, field] of Object.entries(e.uiIncludes ?? {})) {
    if (!res.ui.some((b) => b.type === type && b[field])) problems.push(`expected a ${type} with ${field}`);
  }
  for (const type of e.uiExcludes ?? []) {
    if (res.ui.some((b) => b.type === type)) problems.push(`didn't expect a ${type}`);
  }
  if (e.entryBusiness !== undefined) {
    const wrong = added.filter((x) => (x.businessId ?? "main") !== e.entryBusiness);
    if (!added.length || wrong.length) problems.push(`expected new entries for business ${e.entryBusiness}, got ${JSON.stringify(added)}`);
  }
  if (e.businessCount !== undefined && (res.state.businesses?.length ?? 0) !== e.businessCount) {
    problems.push(`expected ${e.businessCount} further businesses, got ${JSON.stringify(res.state.businesses ?? [])}`);
  }
  for (const [field, pattern] of Object.entries(e.profileMatches ?? {})) {
    const value = res.state.profile[field];
    if (typeof value !== "string" || !new RegExp(pattern, "i").test(value)) {
      problems.push(`expected profile.${field} to match /${pattern}/, got ${JSON.stringify(value)}`);
    }
  }
  return problems;
}

async function run(c: Case): Promise<{ problems: string[]; res?: ChatResponse }> {
  const state = { ...baseState(), ...c.setup };
  // A case's own entries may use "today" as their date.
  state.entries = state.entries.map((e) =>
    e.date === "today" ? { ...e, date: TODAY, createdAt: e.createdAt.replace(/^today-?/, TODAY) } : e,
  );
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [...(c.history ?? []), { role: "user", content: c.message }], state }),
  });
  if (!response.ok) return { problems: [`HTTP ${response.status}: ${await response.text()}`] };
  const res = (await response.json()) as ChatResponse;
  return { problems: check(c, state, res), res };
}

let failed = 0;
let total = 0;
console.log(`Chat eval against ${BASE_URL} (today in Lesotho: ${TODAY})\n`);
for (const c of cases) {
  for (let i = 0; i < REPEAT; i++) {
    total++;
    const { problems, res } = await run(c);
    const label = `"${c.message}"${REPEAT > 1 ? ` (run ${i + 1})` : ""}`;
    if (problems.length) {
      failed++;
      console.log(`FAIL  ${label}`);
      for (const p of problems) console.log(`        - ${p}`);
    } else {
      console.log(`pass  ${label}`);
    }
    if (res) {
      console.log(`        tools: ${res.tools.map((t) => `${t.name}(${JSON.stringify(t.input)})`).join(", ") || "none"}`);
      console.log(`        reply: ${res.reply.replace(/\s+/g, " ")}`);
    }
  }
}
console.log(`\n${total - failed} of ${total} passed.`);
process.exit(failed ? 1 : 0);
