// Monthly statements and the full business record, for the trader to print,
// save as a PDF or download as a spreadsheet. Pure functions: every figure
// comes from lib/ledger.ts and the trader's own saved records, never from the
// model. Built in the browser, so the records never leave the phone.

import { TAX } from "@/config/tax";
import { daysInMonth, formatDate, ymd, type DateRange } from "./dates";
import { roundMoney, summarize, type Summary } from "./ledger";
import type { Entry, FiledReturn, TraderState } from "./state";
import { strings } from "./strings";
import { periodRange } from "./tax";

const s = strings.chat.statement;

// A month like "2026-10", or "all" for every record.
export type StatementKey = string;

export type StatementPeriodCheck =
  | { ok: true; key: StatementKey }
  | { ok: false; error: "invalid_period" | "future_period" };

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function previousMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// Turns what the trader or the model asked for into a statement key:
// "this_month", "last_month", "2026-10" or "all".
export function resolveStatementPeriod(input: string, today: string): StatementPeriodCheck {
  const value = input.trim().toLowerCase();
  if (value === "all") return { ok: true, key: "all" };
  if (value === "this_month") return { ok: true, key: monthKey(today) };
  if (value === "last_month") return { ok: true, key: previousMonth(monthKey(today)) };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { ok: false, error: "invalid_period" };
  if (value > monthKey(today)) return { ok: false, error: "future_period" };
  return { ok: true, key: value };
}

// "October 2026"
export function monthTitle(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

function monthRange(key: string): DateRange {
  const [y, m] = key.split("-").map(Number);
  return { start: ymd(y, m, 1), end: ymd(y, m, daysInMonth(y, m)) };
}

function earliestDate(entries: Entry[]): string | undefined {
  return entries.reduce<string | undefined>((min, e) => (!min || e.date < min ? e.date : min), undefined);
}

// A month runs from its first to its last day. All records run from the first
// entry to today.
export function statementRange(key: StatementKey, entries: Entry[], today: string): DateRange {
  if (key !== "all") return monthRange(key);
  return { start: earliestDate(entries) ?? today, end: today };
}

// Months the trader can pick, newest first: from the month of their first
// entry to this month. Just this month when there are no records yet.
export function statementMonths(entries: Entry[], today: string, max = 24): string[] {
  const first = monthKey(earliestDate(entries) ?? today);
  const months: string[] = [];
  for (let key = monthKey(today); key >= first && months.length < max; key = previousMonth(key)) months.push(key);
  return months;
}

export type MonthTotals = Pick<Summary, "moneyIn" | "moneyOut" | "clientMoney" | "profit" | "entryCount"> & {
  month: string;
};

export type StatementReturn = FiledReturn & DateRange;

export type Statement = DateRange & {
  key: StatementKey;
  isMonth: boolean;
  title: string; // "October 2026" or "All records"
  profile: TraderState["profile"];
  summary: Summary;
  entries: Entry[]; // in the period, oldest first
  months: MonthTotals[]; // one row per month in the period, oldest first
  returns: StatementReturn[]; // filed returns whose period overlaps this one
  taxNote: string | null; // the placeholder note, when a return's tax is shown
  madeOn: string; // YYYY-MM-DD
};

export function buildStatement(state: TraderState, key: StatementKey, today: string): Statement {
  const range = statementRange(key, state.entries, today);
  const summary = summarize(state.entries, range, today);
  const entries = state.entries
    .filter((e) => e.date >= range.start && e.date <= range.end)
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const months: MonthTotals[] = [];
  for (let m = monthKey(range.start); m <= monthKey(range.end); m = nextMonth(m)) {
    const t = summarize(entries, monthRange(m), today);
    months.push({
      month: m,
      moneyIn: t.moneyIn,
      moneyOut: t.moneyOut,
      clientMoney: t.clientMoney,
      profit: t.profit,
      entryCount: t.entryCount,
    });
  }

  const returns = state.returns
    .map((r) => ({ ...r, ...periodRange(r.period) }))
    .filter((r) => r.start <= range.end && r.end >= range.start)
    .toSorted((a, b) => a.start.localeCompare(b.start));

  return {
    ...range,
    key,
    isMonth: key !== "all",
    title: key === "all" ? s.allRecords : monthTitle(key),
    profile: state.profile,
    summary,
    entries,
    months,
    returns,
    taxNote: returns.length > 0 && TAX.placeholder ? TAX.note : null,
    madeOn: today,
  };
}

function nextMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Spreadsheet (CSV) export

// An amount worked out by the code, so a minus sign in it is safe to keep.
type CsvAmount = { amount: string };
type CsvValue = string | number | CsvAmount;

// Amounts as plain numbers with two decimals, so a spreadsheet can add them up.
function csvAmount(n: number): CsvAmount {
  return { amount: roundMoney(n).toFixed(2) };
}

// Quotes a cell when needed. Text that a spreadsheet would read as a formula
// (starting with =, +, - or @) gets a leading apostrophe, so a note can never run.
export function csvCell(value: CsvValue): string {
  let text = typeof value === "object" ? value.amount : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(cells: CsvValue[]): string {
  return cells.map(csvCell).join(",");
}

export function statementCsv(st: Statement): string {
  const p = st.profile;
  const rows: CsvValue[][] = [
    [s.csvHeading],
    [strings.footer.text],
    [s.disclaimer],
    [],
    [s.trader, p.name ?? s.notGiven],
    [s.business, p.businessType ?? s.notGiven],
    [s.district, p.district ?? s.notGiven],
    [s.registered, p.registered ? s.registeredValues[p.registered] : s.notGiven],
    [s.period, `${st.title}: ${formatDate(st.start)} to ${formatDate(st.end)}`],
    [s.madeOn, formatDate(st.madeOn)],
    [],
    [s.totals],
    [s.moneyIn, csvAmount(st.summary.moneyIn)],
    [s.moneyOut, csvAmount(st.summary.moneyOut)],
    [s.profit, csvAmount(st.summary.profit)],
    ...(st.summary.clientMoney > 0 ? [[s.clientMoney, csvAmount(st.summary.clientMoney)], [s.clientMoneyNote]] : []),
    [s.entries, st.summary.entryCount],
    [],
  ];

  if (st.months.length > 1) {
    rows.push([s.byMonth], [...s.csvMonthColumns]);
    for (const m of st.months) {
      rows.push([
        monthTitle(m.month),
        csvAmount(m.moneyIn),
        csvAmount(m.moneyOut),
        csvAmount(m.profit),
        csvAmount(m.clientMoney),
        m.entryCount,
      ]);
    }
    rows.push([]);
  }

  if (st.returns.length > 0) {
    rows.push([s.returnsTitle], [...s.csvReturnColumns]);
    for (const r of st.returns) {
      rows.push([
        r.period,
        r.start,
        r.end,
        csvAmount(r.turnover),
        csvAmount(r.taxEstimate),
        r.reference,
        r.paid ? s.yes : s.no,
      ]);
    }
    if (st.taxNote) rows.push([st.taxNote]);
    rows.push([]);
  }

  rows.push([s.recordsTitle], [...s.csvColumns]);
  for (const e of st.entries) {
    rows.push([
      e.date,
      s.kinds[e.kind],
      e.note ?? "",
      csvAmount(e.amount),
      e.currency === "rand" ? s.yes : "",
      s.sources[e.source],
      e.receipt ? s.lekuka[e.receipt.lekuka] : "",
    ]);
  }
  if (st.entries.length === 0) rows.push([s.none]);

  return rows.map(csvRow).join("\r\n") + "\r\n";
}

// "khoebo-statement-2026-10.csv", or "khoebo-records-2026-11-19.csv" for all records.
export function statementFileName(st: Statement): string {
  return st.isMonth ? `khoebo-statement-${st.key}.csv` : `khoebo-records-${st.madeOn}.csv`;
}

// Where the printable statement lives.
export function statementPath(key: StatementKey): string {
  return `/trader/statement?period=${encodeURIComponent(key)}`;
}
