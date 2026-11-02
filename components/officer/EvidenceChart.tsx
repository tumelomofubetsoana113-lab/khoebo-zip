import { Check, Clock, Minus } from "lucide-react";
import { formatMoney } from "@/lib/ledger";
import { strings } from "@/lib/strings";
import { monthShort, type MonthFigures } from "@/lib/worklist";

const t = strings.officer.detail;

type FilingStatus = "onTime" | "late" | "missing";

function filingStatus(m: MonthFigures): FilingStatus {
  if (!m.filed) return "missing";
  return m.onTime ? "onTime" : "late";
}

// A round top for the axis: 1, 2 or 5 times a power of ten, split in four.
export function axisMax(value: number): number {
  if (value <= 0) return 1000;
  const raw = value / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * power).find((s) => s >= raw) ?? 10 * power;
  return step * 4;
}

function FilingMarker({ status, x, y }: { status: FilingStatus; x: number; y: number }) {
  return (
    <g transform={`translate(${x - 8} ${y - 8})`} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <title>{t.filing[status]}</title>
      {status === "onTime" && <polyline points="3,8.5 6.5,12 13,4.5" className="stroke-green-text" />}
      {status === "late" && (
        <>
          <circle cx={8} cy={8} r={6.5} className="stroke-status-followup" strokeWidth={2} />
          <polyline points="8,4.5 8,8 10.5,9.5" className="stroke-status-followup" strokeWidth={2} />
        </>
      )}
      {status === "missing" && <line x1={3} y1={8} x2={13} y2={8} className="stroke-muted" />}
    </g>
  );
}

function Chart({ months, width, height, className }: { months: MonthFigures[]; width: number; height: number; className: string }) {
  const left = 64;
  const right = 8;
  const top = 12;
  const bottom = 56; // month labels and filing markers
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const max = axisMax(Math.max(...months.map((m) => Math.max(m.declared ?? 0, m.evidenceMin))));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const groupW = plotW / months.length;
  const barW = Math.min(28, groupW * 0.32);
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={t.chartHeading}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
          <text x={left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
            {formatMoney(v)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = left + groupW * i + groupW / 2;
        const label = monthShort(m.month);
        const title = t.chartTitle(
          label,
          m.declared === null ? t.notFiled : formatMoney(m.declared),
          formatMoney(m.evidenceMin),
        );
        // A nil return still shows a thin bar on the axis, so it reads as M0, not as missing.
        const declaredH = m.declared === null ? 0 : Math.max(2, top + plotH - y(m.declared));
        const evidenceH = Math.max(m.evidenceMin > 0 ? 2 : 0, top + plotH - y(m.evidenceMin));
        return (
          <g key={m.month}>
            <title>{title}</title>
            {/* An invisible column so hovering anywhere in the month shows its figures. */}
            <rect x={cx - groupW / 2} y={top} width={groupW} height={plotH} className="fill-surface" fillOpacity={0} />
            {m.declared !== null && (
              <rect x={cx - barW - 2} y={top + plotH - declaredH} width={barW} height={declaredH} rx={3} className="fill-flag-blue" />
            )}
            <rect x={cx + 2} y={top + plotH - evidenceH} width={barW} height={evidenceH} rx={3} className="fill-muted" fillOpacity={0.4} />
            <text x={cx} y={top + plotH + 18} textAnchor="middle" className="fill-ink text-[12px]">
              {label}
            </text>
            <FilingMarker status={filingStatus(m)} x={cx} y={top + plotH + 40} />
          </g>
        );
      })}
    </svg>
  );
}

export function EvidenceChart({ months }: { months: MonthFigures[] }) {
  const mt = t.monthTable;
  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-hidden>
        <li className="inline-flex items-center gap-2">
          <span className="inline-block size-3 rounded-sm bg-flag-blue" />
          {t.chartLegendDeclared}
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="inline-block size-3 rounded-sm bg-muted/40" />
          {t.chartLegendEvidence}
        </li>
      </ul>
      {/* Two drawings, so the text stays readable on a phone. */}
      <Chart months={months} width={760} height={280} className="hidden md:block" />
      <Chart months={months} width={300} height={250} className="md:hidden" />
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted" aria-label={t.filingHeading}>
        <li className="inline-flex items-center gap-1.5">
          <Check size={16} aria-hidden className="text-green-text" />
          {t.filing.onTime}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Clock size={16} aria-hidden className="text-status-followup" />
          {t.filing.late}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Minus size={16} aria-hidden className="text-muted" />
          {t.filing.missing}
        </li>
      </ul>
      <figcaption className="mt-3 text-sm text-muted">{t.chartNote}</figcaption>

      <details className="mt-4 rounded-card border border-line">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold text-flag-blue">
          {mt.toggle}
        </summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">{mt.caption}</caption>
            <thead className="bg-page text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">{mt.month}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{mt.declared}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{mt.purchases}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{mt.walletInflows}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{mt.evidenceMin}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{mt.filing}</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 font-semibold">
                    {monthShort(m.month)} {m.month.slice(0, 4)}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.declared === null ? t.notFiled : formatMoney(m.declared)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(m.purchases)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(m.walletInflows)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(m.evidenceMin)}</td>
                  <td className="px-3 py-2">{t.filing[filingStatus(m)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
