"use client";

import { BarChart3, BellRing, FileText, Package, RotateCcw, Store, UserRound, type LucideIcon } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { strings } from "@/lib/strings";

const t = strings.chat.demoMenu;

export type DemoChoice = "load" | "loadRunner" | "loadMulti" | "summary" | "reminder" | "statement" | "reset";

const items: { id: DemoChoice; icon: LucideIcon; label: string; hint?: string; needsApi: boolean }[] = [
  { id: "load", icon: UserRound, label: t.loadTrader, hint: t.loadTraderHint, needsApi: false },
  { id: "loadRunner", icon: Package, label: t.loadRunner, hint: t.loadRunnerHint, needsApi: false },
  { id: "loadMulti", icon: Store, label: t.loadMulti, hint: t.loadMultiHint, needsApi: false },
  { id: "summary", icon: BarChart3, label: t.weekSummary, needsApi: true },
  { id: "reminder", icon: BellRing, label: t.reminder, hint: t.reminderHint, needsApi: true },
  { id: "statement", icon: FileText, label: t.statement, hint: t.statementHint, needsApi: false },
  { id: "reset", icon: RotateCcw, label: t.reset, hint: t.resetHint, needsApi: false },
];

export function DemoMenu({
  open,
  busy,
  onClose,
  onChoose,
}: {
  open: boolean;
  busy: boolean; // a reply is on its way, so choices that call the API wait
  onClose: () => void;
  onChoose: (choice: DemoChoice) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={t.title}>
      <ul className="space-y-1">
        {items.map(({ id, icon: Icon, label, hint, needsApi }) => (
          <li key={id}>
            <button
              type="button"
              disabled={busy && needsApi}
              onClick={() => onChoose(id)}
              className="flex min-h-11 w-full items-center gap-3 rounded-card px-3 py-2 text-left hover:bg-page disabled:opacity-50"
            >
              <Icon size={22} aria-hidden="true" className="shrink-0 text-flag-blue" />
              <span>
                <span className="block font-medium">{label}</span>
                {hint && <span className="block text-sm text-muted">{hint}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
