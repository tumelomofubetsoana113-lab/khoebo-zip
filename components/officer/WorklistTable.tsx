import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ActionPill } from "@/components/ui/Pill";
import { formatMoney } from "@/lib/ledger";
import { strings } from "@/lib/strings";
import type { WorklistRow } from "@/lib/worklist";

const t = strings.officer.table;

function name(row: WorklistRow) {
  return row.label ?? row.id;
}

// A table from 768px up; a list of cards below that.
export function WorklistTable({ rows }: { rows: WorklistRow[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-card border border-line bg-surface p-6 text-center text-muted">
        {strings.officer.filters.none}
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t.caption}</caption>
          <thead className="border-b border-line bg-page text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-3 font-semibold">{t.id}</th>
              <th scope="col" className="px-3 py-3 font-semibold">{t.sector}</th>
              <th scope="col" className="px-3 py-3 font-semibold">{t.district}</th>
              <th scope="col" className="px-3 py-3 font-semibold">{t.action}</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">{t.declared}</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">{t.evidenceMin}</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">{t.evidenceMonths}</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">{t.nilReturns}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-page">
                <th scope="row" className="px-3 py-2 font-semibold">
                  <Link
                    href={`/officer/${row.id}`}
                    className="inline-flex min-h-10 items-center text-flag-blue underline-offset-2 hover:underline"
                  >
                    {row.label ? (
                      <span>
                        {row.label}
                        <span className="block text-xs font-normal text-muted">{row.id}</span>
                      </span>
                    ) : (
                      row.id
                    )}
                  </Link>
                </th>
                <td className="px-3 py-2">{row.sector}</td>
                <td className="px-3 py-2">{row.district}</td>
                <td className="px-3 py-2">
                  <ActionPill action={row.action} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.declared)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.evidenceMin)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.ofSix(row.evidenceMonths)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.nilReturns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/officer/${row.id}`}
              className="block rounded-card border border-line bg-surface p-4 hover:border-flag-blue"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-flag-blue">{name(row)}</p>
                  <p className="text-sm text-muted">
                    {row.label ? `${row.id} · ` : ""}
                    {row.sector} · {row.district}
                  </p>
                </div>
                <ChevronRight size={20} aria-hidden className="mt-0.5 shrink-0 text-muted" />
              </div>
              <div className="mt-2">
                <ActionPill action={row.action} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">{t.declared}</dt>
                  <dd className="font-semibold tabular-nums">{formatMoney(row.declared)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t.evidenceMin}</dt>
                  <dd className="font-semibold tabular-nums">{formatMoney(row.evidenceMin)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t.evidenceMonths}</dt>
                  <dd className="font-semibold tabular-nums">{t.ofSix(row.evidenceMonths)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t.nilReturns}</dt>
                  <dd className="font-semibold tabular-nums">{row.nilReturns}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
