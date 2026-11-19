"use client";

// The trader's home page (added 19 November 2026), the first page after
// logging in. The chat is the first and biggest thing on it; under it are the
// trader's own figures, worked out in the browser by lib/home.ts. Big buttons,
// icons and few words, for traders who don't use computers much.

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  FileText,
  FileWarning,
  MessageCircle,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAccount } from "@/components/auth/AccountProvider";
import { AccountMenu } from "@/components/auth/LogoutButton";
import { BusinessRows } from "@/components/chat/BusinessRows";
import { ButtonLink } from "@/components/ui/Button";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { TAX } from "@/config/tax";
import { formatDate, todayISO, weekdayName } from "@/lib/dates";
import { buildHome, CHAT_PATH, type DaySales, type Home, type HomePeriod } from "@/lib/home";
import { formatMoney } from "@/lib/ledger";
import { loadState, STORAGE_KEY } from "@/lib/state";
import { scopedKey } from "@/lib/storage-scope";
import { statementPath } from "@/lib/statement";
import { strings } from "@/lib/strings";

const t = strings.home;

const noSubscribe = () => () => {};

// The saved records, read again whenever the page shows: Next.js keeps this
// page in memory while the trader is in the chat, so coming back must not
// show the figures from before.
function subscribeRecords(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
  };
}

function savedRecords(): string | null {
  try {
    return localStorage.getItem(scopedKey(STORAGE_KEY));
  } catch {
    return null;
  }
}

// The records live in localStorage, so the server renders only the frame.
export function TraderHome() {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <SiteHeader>
        <AccountMenu />
      </SiteHeader>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-10">{inBrowser ? <HomeView /> : null}</main>
      <SiteFooter />
    </div>
  );
}

function HomeView() {
  const router = useRouter();
  const account = useAccount();
  const [today] = useState(todayISO);
  const raw = useSyncExternalStore(subscribeRecords, savedRecords, () => null);
  const trader = useMemo(() => loadState({ getItem: () => raw, setItem: () => {}, removeItem: () => {} }), [raw]);
  const [period, setPeriod] = useState<HomePeriod>("this_week");
  const home = buildHome(trader, today);

  // An officer's field-visit link opens the chat, which fills in the details.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("via") === "field") {
      router.replace(`${CHAT_PATH}${window.location.search}`);
    }
  }, [router]);

  const firstName = (trader.profile.name ?? account?.fullName)?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t.hello(firstName)}</h1>
        <p className="text-muted">{`${weekdayName(today)}, ${formatDate(today)}`}</p>
      </div>

      <ChatButton />

      {home.late.length > 0 && <LateCard home={home} />}

      {!trader.onboardingDone && !home.hasRecords ? (
        <Prompt title={t.startTitle} body={t.startBody} button={t.startButton} />
      ) : !home.hasRecords ? (
        <Prompt title={t.emptyTitle} body={t.emptyBody} button={t.emptyButton} />
      ) : (
        <>
          <Totals home={home} period={period} onPeriod={setPeriod} />
          <WeekChart days={home.week} best={home.bestDay} today={today} />
          <NextReturns home={home} />
          <StatementLink />
        </>
      )}
    </div>
  );
}

function ChatButton() {
  return (
    <Link
      href={CHAT_PATH}
      className="flex items-center gap-4 rounded-card bg-brand p-5 text-surface shadow-lg shadow-brand/20 hover:bg-brand/90"
    >
      <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface text-brand">
        <MessageCircle size={32} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold">{t.chatTitle}</span>
        <span className="block text-surface/90">{t.chatBody}</span>
      </span>
      <ArrowRight size={28} aria-hidden="true" className="shrink-0" />
    </Link>
  );
}

function Prompt({ title, body, button }: { title: string; body: string; button: string }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-muted">{body}</p>
      <ButtonLink href={CHAT_PATH} className="mt-4 w-full">
        {button}
        <ArrowRight size={18} aria-hidden="true" />
      </ButtonLink>
    </section>
  );
}

function LateCard({ home }: { home: Home }) {
  return (
    <section className="rounded-card border border-status-followup/40 bg-status-followup-bg p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <FileWarning size={24} aria-hidden="true" className="shrink-0 text-status-followup" />
        {t.lateTitle}
      </h2>
      <ul className="mt-2 space-y-1 font-semibold">
        {home.late.map((r) => (
          <li key={`${r.period}-${r.businessId}`}>
            {r.businessName ? `${r.businessName}: ` : ""}
            {t.lateItem(r.period, formatDate(r.dueDate))}
          </li>
        ))}
      </ul>
      <ButtonLink href={CHAT_PATH} className="mt-4 w-full">
        {t.lateButton}
        <ArrowRight size={18} aria-hidden="true" />
      </ButtonLink>
    </section>
  );
}

function Tile({ icon: Icon, label, hint, value, strong }: { icon: LucideIcon; label: string; hint: string; value: string; strong?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <span className={`text-right text-xl font-bold whitespace-nowrap ${strong ? "text-success-text" : ""}`}>{value}</span>
    </li>
  );
}

function Totals({ home, period, onPeriod }: { home: Home; period: HomePeriod; onPeriod: (p: HomePeriod) => void }) {
  const s = home.totals[period];
  const options: HomePeriod[] = ["this_week", "this_month"];
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div role="group" aria-label={t.period} className="grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
        {options.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === period}
            onClick={() => onPeriod(p)}
            className={`min-h-11 rounded-lg font-semibold ${p === period ? "bg-surface text-brand shadow-sm" : "text-muted"}`}
          >
            {strings.chat.periods[p]}
          </button>
        ))}
      </div>
      <ul className="mt-2 divide-y divide-line">
        <Tile icon={ArrowDownLeft} label={t.moneyIn} hint={t.moneyInHint} value={formatMoney(s.moneyIn)} />
        <Tile icon={ArrowUpRight} label={t.moneyOut} hint={t.moneyOutHint} value={formatMoney(s.moneyOut)} />
        <Tile icon={PiggyBank} label={t.profit} hint={t.profitHint} value={formatMoney(s.profit)} strong={s.profit > 0} />
      </ul>
      {s.clientMoney > 0 && (
        <p className="mt-1 text-sm text-muted">
          {strings.chat.summary.clientMoney}: {formatMoney(s.clientMoney)}. {strings.chat.summary.clientMoneyNote}
        </p>
      )}
      <BusinessRows rows={home.byBusiness?.[period]} />
    </section>
  );
}

// One bar per day, Monday to Sunday. Tapping a bar shows its amount, so the
// figure for any day is one tap away; the best day is labelled.
function WeekChart({ days, best, today }: { days: DaySales[]; best?: string; today: string }) {
  const [picked, setPicked] = useState(today);
  const max = Math.max(...days.map((d) => d.moneyIn), 0);
  const chosen = days.find((d) => d.date === picked) ?? days[0];
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-lg font-bold">{t.weekChart}</h2>
      {max === 0 ? (
        <p className="mt-2 text-muted">{t.noSalesThisWeek}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">{best ? t.bestDay(weekdayName(best)) : ""}</p>
          <div aria-hidden="true" className="mt-3 grid h-36 grid-cols-7 items-end gap-2 border-b border-line">
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                tabIndex={-1}
                onClick={() => setPicked(d.date)}
                disabled={d.future}
                title={`${weekdayName(d.date)}: ${formatMoney(d.moneyIn)}`}
                className="flex h-full items-end justify-center"
              >
                <span
                  className={`block w-full max-w-8 rounded-t-[4px] ${d.date === picked ? "bg-brand" : "bg-brand/45"}`}
                  style={{ height: d.moneyIn > 0 ? `${Math.max((d.moneyIn / max) * 100, 3)}%` : "2px" }}
                />
              </button>
            ))}
          </div>
          <div aria-hidden="true" className="mt-1 grid grid-cols-7 gap-2 text-center text-xs text-muted">
            {days.map((d) => (
              <span key={d.date} className={d.date === today ? "font-bold text-ink" : ""}>
                {d.day}
              </span>
            ))}
          </div>
          <p aria-hidden="true" className="mt-3 text-center font-semibold">
            {weekdayName(chosen.date)}: {formatMoney(chosen.moneyIn)}
          </p>
          <ul className="sr-only" aria-label={t.weekChartList}>
            {days
              .filter((d) => !d.future)
              .map((d) => (
                <li key={d.date}>
                  {weekdayName(d.date)}: {formatMoney(d.moneyIn)}
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}

function NextReturns({ home }: { home: Home }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <CalendarClock size={22} aria-hidden="true" className="shrink-0 text-brand" />
        {t.nextTitle}
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {home.next.map((r) => (
          <li key={r.businessId} className="py-3">
            {r.businessName && <p className="font-semibold">{r.businessName}</p>}
            <dl className="space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t.period}</dt>
                <dd className="flex items-center gap-2 font-semibold">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm ${
                      r.filed ? "bg-status-none-bg text-status-none" : "bg-status-review-bg text-status-review"
                    }`}
                  >
                    {r.filed ? t.filed : t.notFiled}
                  </span>
                  {r.period}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t.due}</dt>
                <dd className="font-semibold">{formatDate(r.dueDate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{r.filed ? t.filedTax : t.estimate}</dt>
                <dd className="font-semibold">{formatMoney(r.estimate)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {TAX.placeholder && <p className="mt-1 text-sm text-muted">{TAX.note}</p>}
    </section>
  );
}

function StatementLink() {
  return (
    <Link
      href={statementPath("this_month")}
      className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 hover:bg-brand-soft"
    >
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <FileText size={24} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{t.statementTitle}</span>
        <span className="block text-muted">{t.statementBody}</span>
      </span>
      <ArrowRight size={22} aria-hidden="true" className="shrink-0 text-brand" />
    </Link>
  );
}
