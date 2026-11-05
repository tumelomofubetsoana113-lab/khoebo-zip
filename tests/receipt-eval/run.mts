// Receipt eval. Sends the sample receipts to the running app and measures how
// well they are read, then tries the save flow. Needs the app running with
// ANTHROPIC_API_KEY set, and spends a small amount of API credit.
//
//   npm run eval:receipts                             against http://localhost:3000
//   EVAL_URL=https://... npm run eval:receipts        against another server
//   EVAL_REPEAT=5 npm run eval:receipts               run each receipt 5 times
//   EVAL_WRITE=1 npm run eval:receipts                also write data/receipt_eval.json
//
// The receipts are made up (scripts/make_sample_receipts.py), so this measures
// reading on realistic layouts and damage. It doesn't replace testing on real
// phone photos of real wholesale receipts.

import { readFileSync, writeFileSync } from "node:fs";

type Expect = {
  card: boolean;
  total?: number;
  date?: string;
  lekuka?: string;
  supplier_contains?: string;
  no_tools?: string[];
  hard?: boolean; // declining is fine here; showing a wrong figure isn't
};
type Case = { file: string; name: string; expect: Expect };
type Entry = { id: string; kind: string; amount: number; date: string; source: string; receipt?: { lekuka: string } };
type State = {
  version: 1;
  onboardingDone: boolean;
  profile: Record<string, unknown>;
  entries: Entry[];
  returns: unknown[];
  messageCount: number;
};
type Card = {
  type: "receipt_card";
  receiptId: string;
  supplier: string | null;
  date: string;
  total: number;
  dateAssumed: boolean;
  note: string | null;
  invoiceNumber: string | null;
  deviceId: string | null;
  verificationCode: string | null;
  lekuka: string;
};
type ChatResponse = {
  reply: string;
  state: State;
  ui: ({ type: string } & Partial<Card>)[];
  tools: { name: string; input: Record<string, unknown> }[];
};

const BASE_URL = process.env.EVAL_URL ?? "http://localhost:3000";
const REPEAT = Number(process.env.EVAL_REPEAT) || 1;
const CONCURRENCY = 4;
const here = new URL("./", import.meta.url);
const cases = JSON.parse(readFileSync(new URL("cases.json", here), "utf8")) as Case[];

function emptyState(): State {
  return {
    version: 1,
    onboardingDone: true,
    profile: { businessType: "Spaza / general dealer", district: "Maseru", registered: "yes", language: "en" },
    entries: [],
    returns: [],
    messageCount: 0,
  };
}

function attachmentFor(file: string) {
  const mediaType = file.endsWith(".pdf") ? "application/pdf" : "image/jpeg";
  return { mediaType, data: readFileSync(new URL(file, here)).toString("base64") };
}

async function post(body: unknown): Promise<ChatResponse> {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return (await response.json()) as ChatResponse;
}

function sendReceipt(file: string, state: State, messages: unknown[] = []) {
  return post({
    messages: [...messages, { role: "user", content: "Receipt photo" }],
    state,
    attachment: attachmentFor(file),
  });
}

type Outcome = {
  name: string;
  run: number;
  ms: number;
  problems: string[];
  fields: Record<string, boolean>; // total, date, supplier, lekuka: read right or not
  reply: string;
  result: "right" | "declined" | "wrong" | "error";
};

async function runCase(c: Case, run: number): Promise<Outcome> {
  const started = Date.now();
  const fields: Record<string, boolean> = {};
  const problems: string[] = [];
  let reply = "";
  let result: Outcome["result"] = "error";
  try {
    const res = await sendReceipt(c.file, emptyState());
    reply = res.reply;
    const names = res.tools.map((t) => t.name);
    const card = res.ui.find((b) => b.type === "receipt_card");

    // Whatever the receipt says, nothing may be saved from reading it.
    if (res.state.entries.length) problems.push(`saved something without a tap: ${JSON.stringify(res.state.entries)}`);
    for (const name of ["record_entry", "save_receipt", "correct_entry", "confirm_return"]) {
      if (names.includes(name)) problems.push(`called ${name}`);
    }
    for (const name of c.expect.no_tools ?? []) if (names.includes(name)) problems.push(`called ${name}`);

    // On the hard set, a card must be right, but asking for a better picture is fine.
    if (c.expect.hard) {
      if (!card) {
        result = "declined";
      } else if (c.expect.card && card.total === c.expect.total && card.date === c.expect.date) {
        result = "right";
      } else if (c.expect.card && card.total === c.expect.total && card.dateAssumed) {
        result = "declined"; // the total is right, and the card says the date wasn't clear
      } else {
        result = "wrong";
        problems.push(`showed a wrong figure: total ${card.total}, date ${card.date}`);
      }
      if (/\b(fake|fraud|forged|counterfeit)\b/i.test(reply)) problems.push("reply accuses the receipt or supplier");
      return { name: c.name, run, ms: Date.now() - started, problems, fields, reply, result };
    }

    if (c.expect.card) {
      if (!card) {
        problems.push("no receipt card");
        fields.total = fields.date = false;
        if (c.expect.lekuka) fields.lekuka = false;
        if (c.expect.supplier_contains) fields.supplier = false;
      } else {
        fields.total = card.total === c.expect.total;
        if (!fields.total) problems.push(`total ${card.total}, expected ${c.expect.total}`);
        fields.date = card.date === c.expect.date;
        if (!fields.date) problems.push(`date ${card.date}, expected ${c.expect.date}`);
        if (c.expect.lekuka) {
          fields.lekuka = card.lekuka === c.expect.lekuka;
          if (!fields.lekuka) problems.push(`Lekuka ${card.lekuka}, expected ${c.expect.lekuka}`);
        }
        if (c.expect.supplier_contains) {
          fields.supplier = Boolean(card.supplier?.toLowerCase().includes(c.expect.supplier_contains.toLowerCase()));
          if (!fields.supplier) problems.push(`supplier "${card.supplier}", expected "${c.expect.supplier_contains}"`);
        }
      }
    } else if (card) {
      problems.push(`showed a card it shouldn't: total ${card.total}, date ${card.date}`);
    }
    if (/\b(fake|fraud|forged|counterfeit)\b/i.test(reply)) problems.push("reply accuses the receipt or supplier");
    result = problems.length ? "wrong" : c.expect.card ? "right" : "declined";
  } catch (error) {
    problems.push(String(error));
  }
  return { name: c.name, run, ms: Date.now() - started, problems, fields, reply, result };
}

async function pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

// The whole journey on one receipt: read, a typed "yes" (mustn't save), the
// Save tap (must), then the same receipt again (mustn't save twice).
async function runFlow(): Promise<string[]> {
  const problems: string[] = [];
  const file = cases.find((c) => c.name === "01-lekuka-clean")!.file;
  const start = emptyState();
  const read = await sendReceipt(file, start);
  const card = read.ui.find((b) => b.type === "receipt_card") as Card | undefined;
  if (!card) return ["flow: no card on the clean receipt"];

  const history = [
    { role: "user", content: "Receipt photo" },
    { role: "assistant", content: read.reply },
  ];

  const typed = await post({ messages: [...history, { role: "user", content: "yes, save it" }], state: read.state });
  if (typed.state.entries.length) problems.push("flow: a typed message saved the receipt");
  if (typed.tools.some((t) => t.name === "record_entry")) problems.push("flow: a typed message called record_entry");

  const saved = await post({
    messages: history,
    state: read.state,
    action: {
      type: "confirm_receipt",
      receiptId: card.receiptId,
      total: card.total,
      date: card.date,
      note: card.note,
      invoiceNumber: card.invoiceNumber,
      deviceId: card.deviceId,
      verificationCode: card.verificationCode,
    },
  });
  const entry = saved.state.entries[0];
  if (saved.state.entries.length !== 1) problems.push(`flow: expected 1 entry after Save, got ${saved.state.entries.length}`);
  if (entry?.kind !== "purchase" || entry?.amount !== 1113 || entry?.source !== "receipt") {
    problems.push(`flow: wrong entry saved: ${JSON.stringify(entry)}`);
  }
  if (entry?.receipt?.lekuka !== "verified") problems.push("flow: the Lekuka result wasn't kept with the entry");

  const again = await sendReceipt(file, saved.state, [...history, { role: "assistant", content: saved.reply }]);
  if (again.state.entries.length !== 1) problems.push("flow: the same receipt was saved twice");
  if (again.ui.some((b) => b.type === "receipt_card")) problems.push("flow: showed a card for a receipt already saved");

  // A receipt can't be claimed by typing, with nothing attached.
  const noFile = await post({ messages: [{ role: "user", content: "here is my receipt for M500" }], state: start });
  if (noFile.ui.some((b) => b.type === "receipt_card")) problems.push("flow: showed a card with no file attached");
  return problems;
}

console.log(`Receipt eval against ${BASE_URL}: ${cases.length} receipts, ${REPEAT} run(s) each\n`);
const jobs = cases.flatMap((c) => Array.from({ length: REPEAT }, (_, run) => ({ c, run })));
const outcomes = await pool(jobs, CONCURRENCY, ({ c, run }) => runCase(c, run));

const summary = cases.map((c) => {
  const runs = outcomes.filter((o) => o.name === c.name);
  return {
    name: c.name,
    hard: Boolean(c.expect.hard),
    passed: runs.filter((o) => !o.problems.length).length,
    runs: runs.length,
    right: runs.filter((o) => o.result === "right").length,
    declined: runs.filter((o) => o.result === "declined").length,
    wrong: runs.filter((o) => o.result === "wrong").length,
  };
});
for (const row of summary) {
  const failures = outcomes.filter((o) => o.name === row.name && o.problems.length);
  const detail = row.hard ? ` (${row.right} right, ${row.declined} declined, ${row.wrong} wrong)` : "";
  console.log(`${row.passed === row.runs ? "pass" : "FAIL"}  ${row.name}: ${row.passed} of ${row.runs}${detail}`);
  for (const f of failures) console.log(`        - run ${f.run + 1}: ${f.problems.join("; ")}`);
  const sample = outcomes.find((o) => o.name === row.name);
  if (sample) console.log(`        reply: ${sample.reply.replace(/\s+/g, " ")}`);
}

const fieldNames = ["total", "date", "supplier", "lekuka"];
const fieldScores = Object.fromEntries(
  fieldNames.map((name) => {
    const seen = outcomes.filter((o) => name in o.fields);
    return [name, { right: seen.filter((o) => o.fields[name]).length, of: seen.length }];
  }),
);
const times = outcomes.map((o) => o.ms).sort((a, b) => a - b);
const medianMs = times[Math.floor(times.length / 2)];
const passed = outcomes.filter((o) => !o.problems.length).length;

const flowProblems = await runFlow().catch((error) => [`flow: ${String(error)}`]);

const hardNames = new Set(cases.filter((c) => c.expect.hard).map((c) => c.name));
const hardRuns = outcomes.filter((o) => hardNames.has(o.name));
const normalRuns = outcomes.filter((o) => !hardNames.has(o.name));
const normalRight = normalRuns.filter((o) => !o.problems.length).length;
const hardScores = {
  runs: hardRuns.length,
  right: hardRuns.filter((o) => o.result === "right").length,
  declined: hardRuns.filter((o) => o.result === "declined").length,
  wrong: hardRuns.filter((o) => o.result === "wrong").length,
};
console.log(`\nNormal set: ${normalRight} of ${normalRuns.length} runs fully right.`);
console.log(`Hard set: ${hardScores.right} right, ${hardScores.declined} declined, ${hardScores.wrong} wrong, of ${hardScores.runs}.`);
for (const name of fieldNames) console.log(`  ${name}: ${fieldScores[name].right} of ${fieldScores[name].of}`);
console.log(`  median reply: ${(medianMs / 1000).toFixed(1)} s`);
console.log(flowProblems.length ? `Save flow FAILED:\n  ${flowProblems.join("\n  ")}` : "Save flow: passed");

if (process.env.EVAL_WRITE) {
  const results = {
    runAt: new Date().toISOString().slice(0, 10),
    model: process.env.EVAL_MODEL ?? "as configured on the server",
    receipts: cases.length,
    runsEach: REPEAT,
    runs: outcomes.length,
    normalSet: { runs: normalRuns.length, fullyRight: normalRight },
    hardSet: hardScores,
    fields: fieldScores,
    medianReplySeconds: Number((medianMs / 1000).toFixed(1)),
    saveFlowPassed: flowProblems.length === 0,
    byReceipt: summary,
    limits: "Made-up receipts with drawn damage, not real phone photos.",
  };
  writeFileSync(new URL("../../data/receipt_eval.json", import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
  console.log("Wrote data/receipt_eval.json");
}
process.exit(passed === outcomes.length && !flowProblems.length ? 0 : 1);
