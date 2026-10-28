import type { ReactNode } from "react";
import { strings, type ActionKey } from "@/lib/strings";

type Tone = ActionKey | "neutral" | "prototype";

const toneClasses: Record<Tone, string> = {
  followup: "bg-status-followup-bg text-status-followup",
  review: "bg-status-review-bg text-status-review",
  checkin: "bg-status-checkin-bg text-status-checkin",
  none: "bg-status-none-bg text-status-none",
  neutral: "bg-page text-muted border border-line",
  prototype: "bg-status-review-bg text-flag-blue",
};

export function Pill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// An officer action always shows its written label, so colour is never the only signal.
export function ActionPill({ action }: { action: ActionKey }) {
  return <Pill tone={action}>{strings.actions[action]}</Pill>;
}

export function PrototypePill({ className = "" }: { className?: string }) {
  return (
    <Pill tone="prototype" className={className}>
      {strings.brand.prototypePill}
    </Pill>
  );
}
