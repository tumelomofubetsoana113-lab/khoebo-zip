"use client";

// The printable statement. It reads the trader's records from localStorage and
// works everything out with lib/statement.ts in the browser, so the records
// never leave the phone. The trader prints it or saves it as a PDF with the
// browser's own print window, or downloads a spreadsheet.

import { ArrowLeft, Download, Info, Printer } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { PrototypePill } from "@/components/ui/Pill";
import { BusinessRows } from "@/components/chat/BusinessRows";
import { businessIdOf, businessList, hasSeveralBusinesses } from "@/lib/businesses";
import { formatDate, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/ledger";
import { loadState, type Entry } from "@/lib/state";
import {
  buildStatement,
  monthTitle,
  resolveStatementPeriod,
  statementMonths,
  statementPath,
  type StatementKey,
} from "@/lib/statement";
import { strings } from "@/lib/strings";
import { downloadStatement } from "./download";

const t = strings.chat.statement;

const noSubscribe = () => () => {};

// localStorage only exists in the browser, so the server renders an empty page.
export function StatementShell() {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return <div className="min-h-dvh bg-page print:bg-surface">{inBrowser ? <StatementView /> : null}</div>;
}

// "3 Oct", or "3 Oct 26" when the statement can run over more than one year.
function shortDate(date: string, withYear: boolean): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "2-digit" as const } : {}),
  }).format(new Date(`${date}T00:00:00Z`));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="border-b border-line pb-1 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Pairs({ rows }: { rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <dl className="mt-2 space-y-1">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className={row.strong ? "font-semibold" : "text-muted"}>{row.label}</dt>
          <dd className={`text-right ${row.strong ? "font-bold text-success-text" : "font-semibold"}`}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntryDetails({ entry, business }: { entry: Entry; business?: string }) {
  const extras = [
    business ?? null,
    entry.currency === "rand" ? t.givenInRand : null,
    entry.receipt ? t.lekuka[entry.receipt.lekuka] : null,
  ].filter(Boolean);
  return (
    <>
      <span className="font-semibold">{t.kinds[entry.kind]}</span>
      {entry.note && <span className="block break-words text-muted">{entry.note}</span>}
      {extras.map((x) => (
        <span key={x} className="block text-xs text-muted">
          {x}
        </span>
      ))}
    </>
  );
}

function StatementView() {
  const [today] = useState(todayISO);
  const [trader] = useState(loadState);
  const [key, setKey] = useState<StatementKey>(() => {
    const asked = new URLSearchParams(window.location.search).get("period") ?? "this_month";
    const check = resolveStatementPeriod(asked, today);
    return check.ok ? check.key : today.slice(0, 7);
  });
  // Only for a trader with several businesses: one of them, or "" for all.
  const several = hasSeveralBusinesses(trader);
  const businesses = businessList(trader);
  const [business, setBusiness] = useState<string>(() => {
    const asked = new URLSearchParams(window.location.search).get("business") ?? "";
    return several && businesses.some((b) => b.id === asked) ? asked : "";
  });

  const st = buildStatement(trader, key, today, business || undefined);
  const months = statementMonths(trader.entries, today);
  const p = trader.profile;
  const sm = st.summary;

  function choose(next: StatementKey, nextBusiness = business) {
    setKey(next);
    setBusiness(nextBusiness);
    window.history.replaceState(null, "", statementPath(next, nextBusiness || undefined));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:py-8 print:max-w-none print:p-0">
      {/* Controls: never printed. */}
      <div className="mb-4 space-y-3 print:hidden">
        <Link href="/trader" className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand">
          <ArrowLeft size={20} aria-hidden="true" />
          {t.backToChat}
        </Link>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">
            {t.choose}
            <select
              value={key}
              onChange={(e) => choose(e.target.value)}
              className="min-h-11 rounded-card border border-line bg-surface px-3 text-base font-normal"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthTitle(m)}
                </option>
              ))}
              {!months.includes(key) && key !== "all" && <option value={key}>{monthTitle(key)}</option>}
              <option value="all">{t.allRecords}</option>
            </select>
          </label>
          {several && (
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">
              {strings.businesses.business}
              <select
                value={business}
                onChange={(e) => choose(key, e.target.value)}
                className="min-h-11 rounded-card border border-line bg-surface px-3 text-base font-normal"
              >
                <option value="">{strings.businesses.allBusinesses}</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" />
              {t.print}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadStatement(st)}>
              <Download size={16} aria-hidden="true" />
              {t.download}
            </Button>
          </div>
        </div>
        <p className="flex gap-1.5 text-sm text-muted">
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t.printHint}
        </p>
      </div>

      {/* The statement itself. */}
      <article className="relative isolate overflow-hidden rounded-card border border-line bg-surface p-4 sm:p-8 print:overflow-visible print:rounded-none print:border-0 print:p-0">
        {/* The Khoebo mark as a faint watermark. On screen it sits behind the
            statement; when printed it is fixed, so it repeats on every page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center print:fixed"
        >
          <Logo size={420} className="h-auto max-w-[80%] opacity-[0.07]" />
        </div>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Logo size={36} />
            <div className="leading-tight">
              <p className="font-semibold">{strings.brand.name}</p>
              <p className="text-sm text-muted">{strings.chat.subtitle}</p>
            </div>
          </div>
          <PrototypePill />
        </header>

        <h1 className="mt-6 text-2xl font-bold">{st.isMonth ? t.monthTitle : t.allTitle}</h1>
        {several && (
          <p className="text-lg font-semibold text-brand">{st.businessName ?? strings.businesses.allBusinesses}</p>
        )}
        <p className="text-muted">
          {st.title} · {formatDate(st.start)} to {formatDate(st.end)}
        </p>

        <Pairs
          rows={[
            ...(p.name ? [{ label: t.trader, value: p.name }] : []),
            ...st.details,
            { label: t.registered, value: p.registered ? t.registeredValues[p.registered] : t.notGiven },
            { label: t.madeOn, value: formatDate(st.madeOn) },
          ]}
        />

        <Section title={t.totals}>
          <Pairs
            rows={[
              { label: t.moneyIn, value: formatMoney(sm.moneyIn) },
              { label: t.moneyOut, value: formatMoney(sm.moneyOut) },
              { label: t.profit, value: formatMoney(sm.profit), strong: true },
              ...(sm.clientMoney > 0 ? [{ label: t.clientMoney, value: formatMoney(sm.clientMoney) }] : []),
              { label: t.entries, value: String(sm.entryCount) },
              { label: t.daysWithNoEntries, value: String(sm.daysWithNoEntries) },
            ]}
          />
          {sm.clientMoney > 0 && <p className="mt-2 text-sm text-muted">{t.clientMoneyNote}</p>}
        </Section>

        {st.byBusiness && (
          <div className="mt-2">
            <BusinessRows rows={st.byBusiness} />
          </div>
        )}

        {st.months.length > 1 && (
          <Section title={t.byMonth}>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-2 font-semibold">{t.month}</th>
                    <th className="py-1 pr-2 text-right font-semibold">{strings.chat.summary.moneyIn}</th>
                    <th className="py-1 pr-2 text-right font-semibold">{strings.chat.summary.moneyOut}</th>
                    <th className="py-1 text-right font-semibold">{strings.chat.summary.profit}</th>
                  </tr>
                </thead>
                <tbody>
                  {st.months.map((m) => (
                    <tr key={m.month} className="border-t border-line">
                      <td className="py-1 pr-2">{monthTitle(m.month)}</td>
                      <td className="py-1 pr-2 text-right">{formatMoney(m.moneyIn)}</td>
                      <td className="py-1 pr-2 text-right">{formatMoney(m.moneyOut)}</td>
                      <td className="py-1 text-right font-semibold">{formatMoney(m.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {st.returns.length > 0 && (
          <Section title={t.returnsTitle}>
            <ul className="mt-2 space-y-3">
              {st.returns.map((r) => (
                <li key={`${r.period}-${r.businessId ?? "main"}`}>
                  <p className="font-semibold">
                    {r.businessName && !st.businessName ? `${r.businessName}: ` : ""}
                    {t.returnLine(r.period, formatDate(r.start), formatDate(r.end))}
                  </p>
                  <Pairs
                    rows={[
                      { label: t.turnover, value: formatMoney(r.turnover) },
                      { label: t.estimatedTax, value: formatMoney(r.taxEstimate) },
                      { label: t.reference, value: r.reference },
                      { label: t.paid, value: r.paid ? t.yes : t.notPaid },
                    ]}
                  />
                </li>
              ))}
            </ul>
            {st.taxNote && <p className="mt-2 text-sm text-muted">{st.taxNote}</p>}
          </Section>
        )}

        <Section title={t.recordsTitle}>
          {st.entries.length === 0 ? (
            <p className="mt-2 text-muted">{t.none}</p>
          ) : (
            <table className="mt-2 w-full table-fixed text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className={`${st.isMonth ? "w-16" : "w-20"} py-1 pr-2 font-semibold`}>{t.date}</th>
                  <th className="py-1 pr-2 font-semibold">{t.details}</th>
                  <th className="w-24 py-1 text-right font-semibold">{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {st.entries.map((e) => (
                  <tr key={e.id} className="break-inside-avoid border-t border-line align-top">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{shortDate(e.date, !st.isMonth)}</td>
                    <td className="py-1.5 pr-2">
                      <EntryDetails
                        entry={e}
                        business={st.businessNames && !st.businessName ? st.businessNames[businessIdOf(e)] : undefined}
                      />
                    </td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{formatMoney(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <footer className="mt-8 border-t border-line pt-3 text-sm text-muted">
          <p>{t.disclaimer}</p>
          <p className="mt-1">{strings.footer.text}</p>
        </footer>
      </article>
    </div>
  );
}
