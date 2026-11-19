import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/RequireRole";
import { Suspense } from "react";
import { DemoCases } from "@/components/officer/DemoCases";
import { OfficerHeader } from "@/components/officer/OfficerHeader";
import { OfficerTabs } from "@/components/officer/OfficerTabs";
import { PilotAccessNote } from "@/components/officer/PilotAccessNote";
import { PipelineStrip } from "@/components/officer/PipelineStrip";
import { Worklist, WorklistView } from "@/components/officer/Worklist";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { leadCounts, pipelineFigures } from "@/lib/leads";
import { leads } from "@/lib/leads-data";
import { strings, type ActionKey } from "@/lib/strings";
import { ACTION_KEY, EMPTY_QUERY, RULE_ACTIONS, windowLabel } from "@/lib/worklist";
import { districts, pinnedTraders, sectors, worklist, worklistRows } from "@/lib/worklist-data";

const t = strings.officer;

export const metadata: Metadata = { title: t.metaTitle };

export default function OfficerPage() {
  return (
    <RequireRole role="officer">
      <OfficerPageContent />
    </RequireRole>
  );
}

function OfficerPageContent() {
  const rows = worklistRows();
  const counts = Object.fromEntries(
    RULE_ACTIONS.map((a) => [ACTION_KEY[a], worklist.counts[a]]),
  ) as Record<ActionKey, number>;
  const props = { rows, counts, districts: districts(), sectors: sectors() };
  const pinned = pinnedTraders();

  return (
    <div className="flex flex-1 flex-col">
      <OfficerHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6">
        <div className="space-y-4">
          <OfficerTabs current="traders" />
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{t.title}</h1>
            <p className="mt-1 text-muted">
              {t.subline(worklist.simulated, pinned.length, windowLabel(worklist.window))}
            </p>
            <PilotAccessNote className="mt-2" />
          </div>
        </div>
        <PipelineStrip figures={pipelineFigures(leadCounts(leads), counts)} />
        {/* The filters live in the URL. The server renders the unfiltered list;
            the browser then applies whatever the URL asks for. */}
        <Suspense
          fallback={
            <WorklistView {...props} query={EMPTY_QUERY}>
              <DemoCases traders={pinned} />
            </WorklistView>
          }
        >
          <Worklist {...props}>
            <DemoCases traders={pinned} />
          </Worklist>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
