import { Database } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadCard } from "@/components/officer/LeadCard";
import { LeadResults } from "@/components/officer/LeadResults";
import { LeadsList, LeadsView } from "@/components/officer/Leads";
import { OfficerHeader } from "@/components/officer/OfficerHeader";
import { OfficerTabs } from "@/components/officer/OfficerTabs";
import { PilotAccessNote } from "@/components/officer/PilotAccessNote";
import { PipelineStrip } from "@/components/officer/PipelineStrip";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { EMPTY_LEAD_QUERY, leadCounts, pipelineFigures } from "@/lib/leads";
import { leadDistricts, leadKinds, leads, pinnedLeads } from "@/lib/leads-data";
import { strings, type ActionKey } from "@/lib/strings";
import { ACTION_KEY, RULE_ACTIONS, windowLabel } from "@/lib/worklist";
import { worklist } from "@/lib/worklist-data";

const t = strings.officer.leads;

export const metadata: Metadata = { title: t.metaTitle };

// Operators outside the tax net, found through third-party signals.
export default function LeadsPage() {
  return (
    <RequireRole role="officer">
      <LeadsPageContent />
    </RequireRole>
  );
}

function LeadsPageContent() {
  const counts = leadCounts(leads);
  const worklistCounts = Object.fromEntries(
    RULE_ACTIONS.map((a) => [ACTION_KEY[a], worklist.counts[a]]),
  ) as Record<ActionKey, number>;
  const pinned = pinnedLeads();
  const props = { leads: leads.leads, counts, districts: leadDistricts(), kinds: leadKinds() };
  const demos = (
    <section aria-labelledby="demo-leads">
      <h2 id="demo-leads" className="text-lg font-bold">
        {t.demoHeading}
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {pinned.map((lead) => (
          <li key={lead.id}>
            <LeadCard lead={lead} />
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="flex flex-1 flex-col">
      <OfficerHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6">
        <div className="space-y-4">
          <OfficerTabs current="leads" />
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{t.title}</h1>
            <p className="mt-1 text-muted">{t.subline(leads.simulated, pinned.length, windowLabel(leads.window))}</p>
            <PilotAccessNote className="mt-2" />
            <p className="mt-2 flex max-w-3xl items-start gap-1.5 text-sm text-muted">
              <Database size={16} aria-hidden className="mt-0.5 shrink-0" />
              {t.sourcesNote}
            </p>
          </div>
        </div>
        <PipelineStrip figures={pipelineFigures(counts, worklistCounts)} />
        <LeadResults runs={leads.thirtyRuns} />
        <Suspense
          fallback={
            <LeadsView {...props} query={EMPTY_LEAD_QUERY}>
              {demos}
            </LeadsView>
          }
        >
          <LeadsList {...props}>{demos}</LeadsList>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
