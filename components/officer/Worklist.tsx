"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { strings, type ActionKey } from "@/lib/strings";
import {
  filterRows,
  parseQuery,
  queryString,
  toggleAction,
  type WorklistQuery,
  type WorklistRow,
} from "@/lib/worklist";
import { Filters } from "./Filters";
import { SummaryStrip } from "./SummaryStrip";
import { WorklistTable } from "./WorklistTable";

type Props = {
  rows: WorklistRow[];
  counts: Record<ActionKey, number>;
  districts: string[];
  sectors: string[];
  // Shown between the summary strip and the filters (the demo cases).
  children?: ReactNode;
};

// The summary strip, filters and table. Pure: the query comes in, changes go
// out. Rendered on the server with no filters as the Suspense fallback.
export function WorklistView({
  rows,
  counts,
  districts,
  sectors,
  children,
  query,
  onChange,
}: Props & { query: WorklistQuery; onChange?: (q: WorklistQuery) => void }) {
  const shown = useMemo(() => filterRows(rows, query), [rows, query]);

  return (
    <div className="space-y-8">
      <SummaryStrip
        counts={counts}
        total={rows.length}
        selected={query.actions}
        onToggle={(action) => onChange?.(toggleAction(query, action))}
      />
      {children}
      <Filters query={query} districts={districts} sectors={sectors} onChange={onChange} />
      <p className="text-sm text-muted" aria-live="polite">
        {strings.officer.filters.showing(shown.length, rows.length)}
      </p>
      <WorklistTable rows={shown} />
    </div>
  );
}

// Reads the filters from the URL and keeps them there, so a filtered view can
// be shared. Uses the History API, which Next keeps in step with
// useSearchParams, so filtering never waits for the server.
export function Worklist(props: Props) {
  const params = useSearchParams();
  const [query, setQuery] = useState<WorklistQuery>(() => parseQuery(params));

  useEffect(() => {
    const next = `${window.location.pathname}${queryString(query)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [query]);

  return <WorklistView {...props} query={query} onChange={setQuery} />;
}
