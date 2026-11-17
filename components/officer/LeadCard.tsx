import { Phone, PhoneOff } from "lucide-react";
import type { ReactNode } from "react";
import { LeadPill } from "@/components/ui/Pill";
import { LEAD_KEY, type Lead } from "@/lib/leads";
import { strings } from "@/lib/strings";
import { FieldVisitButton } from "./FieldVisitButton";

const t = strings.officer.leads.card;

// One potential registrant with the reasons the rules gave, in order. The
// reasons are the whole case: there is no separate detail page.
export function LeadCard({ lead, children }: { lead: Lead; children?: ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{lead.label ?? lead.id}</h3>
          <p className="text-sm text-muted">
            {lead.label ? `${lead.id} · ` : ""}
            {lead.kind} · {lead.district}
          </p>
        </div>
        <LeadPill action={LEAD_KEY[lead.action]} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{t.activeMonths(lead.activeMonths)}</span>
        <span className="inline-flex items-center gap-1">
          {lead.phone ? <Phone size={14} aria-hidden /> : <PhoneOff size={14} aria-hidden />}
          {lead.phone ? t.phone : t.noPhone}
        </span>
      </p>
      <p className="mt-3 text-sm font-semibold">{t.why}</p>
      <ol className="mt-1 flex-1 list-decimal space-y-1 pl-5 text-sm">
        {lead.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      {lead.action === "FIELD VISIT" && <FieldVisitButton lead={lead} />}
      {children}
    </article>
  );
}
