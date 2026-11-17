import type { ReactNode } from "react";
import { LEAD_TONE, type LeadKey } from "@/lib/leads";
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

// A potential registrant's action, in the colours of the matching worklist action.
export function LeadPill({ action }: { action: LeadKey }) {
  return <Pill tone={LEAD_TONE[action]}>{strings.leadActions[action]}</Pill>;
}

export function PrototypePill({ className = "" }: { className?: string }) {
  return (
    <Pill tone="prototype" className={className}>
      {strings.brand.prototypePill}
    </Pill>
  );
}
