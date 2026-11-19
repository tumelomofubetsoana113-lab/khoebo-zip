import type { BusinessTotals } from "@/lib/blocks";
import { strings } from "@/lib/strings";
import { BusinessRows } from "./BusinessRows";

const t = strings.chat.summary;

// Money values arrive already formatted; this card never calculates.
export function SummaryCard({
  period,
  moneyIn,
  moneyOut,
  clientMoney,
  profit,
  entries,
  byBusiness,
}: {
  period: string;
  moneyIn: string;
  moneyOut: string;
  clientMoney?: string; // a runner's client money, shown apart from income
  profit: string;
  entries?: number;
  byBusiness?: BusinessTotals[]; // a trader with several businesses: one line each
}) {
  const rows = [
    { label: t.moneyIn, value: moneyIn },
    { label: t.moneyOut, value: moneyOut },
  ];
  return (
    <div className="mt-1 min-w-52 rounded-card border border-line bg-page p-3">
      <p className="text-sm font-semibold text-muted">{period}</p>
      <dl className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt>{row.label}</dt>
            <dd className="font-semibold">{row.value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line pt-1">
          <dt className="font-semibold">{t.profit}</dt>
          <dd className="font-bold text-green-text">{profit}</dd>
        </div>
      </dl>
      {clientMoney && (
        <div className="mt-2 border-t border-line pt-2">
          <div className="flex justify-between gap-4">
            <span>{t.clientMoney}</span>
            <span className="font-semibold">{clientMoney}</span>
          </div>
          <p className="text-sm text-muted">{t.clientMoneyNote}</p>
        </div>
      )}
      {entries !== undefined && <p className="mt-2 text-sm text-muted">{t.entries(entries)}</p>}
      <BusinessRows rows={byBusiness} />
    </div>
  );
}
