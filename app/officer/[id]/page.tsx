import { ArrowLeft } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceChart } from "@/components/officer/EvidenceChart";
import { OfficerHeader } from "@/components/officer/OfficerHeader";
import { OverridePanel } from "@/components/officer/OverridePanel";
import { PilotAccessNote } from "@/components/officer/PilotAccessNote";
import { ActionPill } from "@/components/ui/Pill";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { formatMoney } from "@/lib/ledger";
import { strings } from "@/lib/strings";
import { ACTION_KEY } from "@/lib/worklist";
import { getTrader, worklist } from "@/lib/worklist-data";

const t = strings.officer.detail;

// Every trader's page is built ahead of time. Unknown IDs get a 404.
export function generateStaticParams() {
  return worklist.traders.map((trader) => ({ id: trader.id }));
}

export async function generateMetadata({ params }: PageProps<"/officer/[id]">): Promise<Metadata> {
  const trader = getTrader((await params).id);
  return { title: trader ? (trader.label ?? trader.id) : strings.officer.metaTitle };
}

export default function TraderPage(props: PageProps<"/officer/[id]">) {
  return (
    <RequireRole role="officer">
      <TraderPageContent {...props} />
    </RequireRole>
  );
}

async function TraderPageContent({ params }: PageProps<"/officer/[id]">) {
  const trader = getTrader((await params).id);
  if (!trader) notFound();

  const m = trader.metrics;
  const figures = [
    { label: t.figures.declared, value: formatMoney(m.declared) },
    { label: t.figures.evidenceMin, value: formatMoney(m.evidenceMin) },
    { label: t.figures.ratio, value: m.ratio === null ? t.noEvidence : `${Math.round(m.ratio * 100)}%` },
    { label: t.figures.evidenceMonths, value: strings.officer.table.ofSix(m.evidenceMonths) },
    { label: t.figures.nilReturns, value: String(m.nilReturns) },
    { label: t.figures.missingReturns, value: String(m.missingReturns) },
    { label: t.figures.licence, value: m.licenceActive ? t.licenceActive : t.licenceInactive },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <OfficerHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/officer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full pr-3 font-semibold text-brand hover:underline"
        >
          <ArrowLeft size={18} aria-hidden />
          {t.back}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{trader.label ?? trader.id}</h1>
            <p className="mt-1 text-muted">
              {trader.label ? `${trader.id} · ` : ""}
              {trader.sector} · {trader.district}
            </p>
            <p className="mt-1 text-sm text-muted">{trader.label ? t.demoCase : t.trader}</p>
            <PilotAccessNote className="mt-2" />
          </div>
          <ActionPill action={ACTION_KEY[trader.action]} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="why" className="rounded-card border border-line bg-surface p-5">
              <h2 id="why" className="text-lg font-bold">
                {t.why}
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                {trader.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="chart" className="rounded-card border border-line bg-surface p-5">
              <h2 id="chart" className="mb-4 text-lg font-bold">
                {t.chartHeading}
              </h2>
              <EvidenceChart months={trader.months} />
            </section>

            <section aria-labelledby="figures" className="rounded-card border border-line bg-surface p-5">
              <h2 id="figures" className="text-lg font-bold">
                {t.figuresHeading}
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                {figures.map((f) => (
                  <div key={f.label}>
                    <dt className="text-sm text-muted">{f.label}</dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <OverridePanel traderId={trader.id} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
