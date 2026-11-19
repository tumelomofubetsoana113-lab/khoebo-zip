import type { BusinessTotals } from "@/lib/blocks";
import { formatMoney } from "@/lib/ledger";
import { strings } from "@/lib/strings";

// One line per business under a summary or statement card.
export function BusinessRows({ rows }: { rows?: BusinessTotals[] }) {
  if (!rows?.length) return null;
  const s = strings.chat.summary;
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="text-sm font-semibold">{strings.businesses.byBusiness}</p>
      <ul className="mt-1 space-y-1">
        {rows.map((b) => (
          <li key={b.name} className="text-sm">
            <span className="font-semibold">{b.name}</span>
            <span className="block text-muted">
              {s.moneyIn} {formatMoney(b.moneyIn)} · {s.moneyOut} {formatMoney(b.moneyOut)} · {s.profit}{" "}
              {formatMoney(b.profit)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
