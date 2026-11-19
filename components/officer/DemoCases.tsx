import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ActionPill } from "@/components/ui/Pill";
import { strings } from "@/lib/strings";
import { ACTION_KEY, type WorklistTrader } from "@/lib/worklist";

const t = strings.officer;

// The three named cases from the concept note, pinned above the table. Each
// card shows the last two reasons the rules gave, which carry the decision.
export function DemoCases({ traders }: { traders: WorklistTrader[] }) {
  return (
    <section aria-labelledby="demo-cases">
      <h2 id="demo-cases" className="text-lg font-bold">
        {t.demoHeading}
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {traders.map((trader) => (
          <li key={trader.id} className="flex flex-col rounded-card border border-line bg-surface p-4 shadow-sm">
            <p className="font-semibold">{trader.label ?? trader.id}</p>
            <p className="text-xs text-muted">{trader.id}</p>
            <div className="mt-2">
              <ActionPill action={ACTION_KEY[trader.action]} />
            </div>
            <ul className="mt-3 flex-1 list-disc space-y-1 pl-5 text-sm">
              {trader.reasons.slice(-2).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <Link
              href={`/officer/${trader.id}`}
              aria-label={t.viewTrader(trader.label ?? trader.id)}
              className="mt-3 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-1 font-semibold text-brand hover:underline"
            >
              {t.view}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
