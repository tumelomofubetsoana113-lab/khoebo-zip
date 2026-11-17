import type { Leads } from "@/lib/leads";
import { strings } from "@/lib/strings";

const t = strings.officer.leads.results;

const pct = (x: number) => Math.round(x * 100);

// How the lead rules did over 30 simulated populations, read from the data
// file. Never typed in.
export function leadResultFigures(runs: Leads["thirtyRuns"]) {
  const visits = Math.round(runs.visits.mean);
  const all = Math.round(runs.baseline_visits.mean);
  return [
    { value: t.fewerVisits(Math.round((1 - runs.visits.mean / runs.baseline_visits.mean) * 100)), label: t.fewerVisitsLabel(visits, all) },
    { value: t.precision(pct(runs.visit_precision.mean)), label: t.precisionLabel(pct(runs.baseline_precision.mean)) },
    { value: t.reached(pct(runs.reached.mean)), label: t.reachedLabel },
  ];
}

export function LeadResults({ runs }: { runs: Leads["thirtyRuns"] }) {
  return (
    <section aria-labelledby="lead-results" className="rounded-card border border-line bg-surface p-4">
      <h2 id="lead-results" className="text-lg font-bold">
        {t.heading}
      </h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-3">
        {leadResultFigures(runs).map((f) => (
          <li key={f.value}>
            <span className="block text-2xl font-bold text-flag-blue">{f.value}</span>
            <span className="block text-sm text-muted">{f.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">{t.note(30, Math.round(runs.leads.mean))}</p>
    </section>
  );
}
