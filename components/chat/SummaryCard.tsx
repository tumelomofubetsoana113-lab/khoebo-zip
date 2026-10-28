import { strings } from "@/lib/strings";

const t = strings.chat.summary;

// Money values arrive already formatted; this card never calculates.
export function SummaryCard({
  period,
  moneyIn,
  moneyOut,
  profit,
  entries,
}: {
  period: string;
  moneyIn: string;
  moneyOut: string;
  profit: string;
  entries?: number;
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
      {entries !== undefined && <p className="mt-2 text-sm text-muted">{t.entries(entries)}</p>}
    </div>
  );
}
