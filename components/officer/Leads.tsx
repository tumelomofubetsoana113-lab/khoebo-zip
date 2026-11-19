"use client";

import { Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { LeadPill } from "@/components/ui/Pill";
import {
  filterLeads,
  LEAD_ORDER,
  leadQueryString,
  parseLeadQuery,
  toggleLeadAction,
  type Lead,
  type LeadKey,
  type LeadQuery,
} from "@/lib/leads";
import { strings } from "@/lib/strings";
import { nextPage, PAGE_SIZE, sharePct } from "@/lib/worklist";
import { LeadCard } from "./LeadCard";

const t = strings.officer.leads;

type Props = {
  leads: Lead[];
  counts: Record<LeadKey, number>;
  districts: string[];
  kinds: string[];
  children?: ReactNode; // shown between the summary and the filters (the demo leads)
};

const fieldClasses = "min-h-11 w-full rounded-card border border-line bg-surface px-3 text-base text-ink";

// Summary cards, filters and the list of lead cards. Pure: the query comes in,
// changes go out. Rendered on the server with no filters as the Suspense fallback.
export function LeadsView({
  leads,
  counts,
  districts,
  kinds,
  children,
  query,
  onChange,
}: Props & { query: LeadQuery; onChange?: (q: LeadQuery) => void }) {
  const id = useId();
  const shown = useMemo(() => filterLeads(leads, query), [leads, query]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const listed = shown.slice(0, limit);
  const more = nextPage(listed.length, shown.length);
  const active = query.actions.length > 0 || query.district || query.kind;

  const change = (q: LeadQuery) => {
    setLimit(PAGE_SIZE);
    onChange?.(q);
  };

  return (
    <div className="space-y-8">
      <ul aria-label={t.summaryLabel} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {LEAD_ORDER.map((action) => {
          const on = query.actions.includes(action);
          return (
            <li key={action}>
              <button
                type="button"
                onClick={() => change(toggleLeadAction(query, action))}
                aria-pressed={on}
                aria-label={`${t.summaryFilter(strings.leadActions[action])}: ${counts[action]}`}
                className={`flex h-full w-full flex-col items-start gap-2 rounded-card border bg-surface p-4 text-left transition-colors hover:border-brand ${
                  on ? "border-brand ring-2 ring-brand" : "border-line"
                }`}
              >
                <LeadPill action={action} />
                <span className="text-3xl font-bold">{counts[action]}</span>
                <span className="text-sm text-muted">{t.summaryShare(sharePct(counts[action], leads.length))}</span>
                <span className="hidden text-sm sm:block">{t.explain[action]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {children}

      <section aria-label={t.filters.heading} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t.filters.action}</legend>
          <div className="flex flex-wrap gap-2">
            {LEAD_ORDER.map((action) => {
              const on = query.actions.includes(action);
              return (
                <button
                  key={action}
                  type="button"
                  aria-pressed={on}
                  onClick={() => change(toggleLeadAction(query, action))}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                    on ? "border-brand bg-brand text-surface" : "border-line bg-surface text-ink hover:bg-page"
                  }`}
                >
                  {on && <Check size={16} aria-hidden />}
                  {strings.leadActions[action]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-district`} className="mb-1 block text-sm font-semibold">
              {t.filters.district}
            </label>
            <select
              id={`${id}-district`}
              className={fieldClasses}
              value={query.district}
              onChange={(e) => change({ ...query, district: e.target.value })}
            >
              <option value="">{t.filters.allDistricts}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-kind`} className="mb-1 block text-sm font-semibold">
              {t.filters.kind}
            </label>
            <select
              id={`${id}-kind`}
              className={fieldClasses}
              value={query.kind}
              onChange={(e) => change({ ...query, kind: e.target.value })}
            >
              <option value="">{t.filters.allKinds}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => change({ actions: [], district: "", kind: "" })}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-brand hover:bg-page"
          >
            {t.filters.clear}
          </button>
        )}
      </section>

      <p className="text-sm text-muted" aria-live="polite">
        {t.filters.showing(shown.length, leads.length)}
      </p>
      {listed.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {listed.map((lead) => (
            <li key={lead.id}>
              <LeadCard lead={lead} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-line bg-surface p-6 text-center text-muted">{t.filters.none}</p>
      )}
      {more > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <p className="text-sm text-muted">{t.filters.listed(listed.length, shown.length)}</p>
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            className="min-h-11 rounded-full border border-brand px-5 font-semibold text-brand hover:bg-page"
          >
            {t.filters.showMore(more)}
          </button>
        </div>
      )}
    </div>
  );
}

// Reads the filters from the URL and keeps them there, like the worklist.
export function LeadsList(props: Props) {
  const params = useSearchParams();
  const [query, setQuery] = useState<LeadQuery>(() => parseLeadQuery(params));

  useEffect(() => {
    const next = `${window.location.pathname}${leadQueryString(query)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [query]);

  return <LeadsView {...props} query={query} onChange={setQuery} />;
}
