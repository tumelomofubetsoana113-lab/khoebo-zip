import { ActionPill } from "@/components/ui/Pill";
import { strings, type ActionKey } from "@/lib/strings";
import { ACTION_ORDER, sharePct } from "@/lib/worklist";

const t = strings.officer;

// One card per action with its count and share. Tapping a card filters the
// table to that action; tapping it again clears it.
export function SummaryStrip({
  counts,
  total,
  selected,
  onToggle,
}: {
  counts: Record<ActionKey, number>;
  total: number;
  selected: ActionKey[];
  onToggle?: (action: ActionKey) => void;
}) {
  return (
    <ul aria-label={t.summaryLabel} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ACTION_ORDER.map((action) => {
        const on = selected.includes(action);
        return (
          <li key={action}>
            <button
              type="button"
              onClick={() => onToggle?.(action)}
              aria-pressed={on}
              aria-label={`${t.summaryFilter(strings.actions[action])}: ${counts[action]}`}
              className={`flex h-full w-full flex-col items-start gap-2 rounded-card border bg-surface p-4 text-left transition-colors hover:border-flag-blue ${
                on ? "border-flag-blue ring-2 ring-flag-blue" : "border-line"
              }`}
            >
              <ActionPill action={action} />
              <span className="text-3xl font-bold">{counts[action]}</span>
              <span className="text-sm text-muted">{t.summaryShare(sharePct(counts[action], total))}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
