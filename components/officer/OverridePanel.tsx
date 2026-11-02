"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  addDecision,
  checkDecision,
  DECISIONS,
  loadDecisions,
  MAX_REASON,
  MIN_REASON,
  saveDecisions,
  type DecisionLog,
} from "@/lib/decisions";
import { strings } from "@/lib/strings";

const t = strings.officer.decision;

type SaveError = keyof typeof t.errors;

function errorText(error: SaveError): string {
  if (error === "reason_too_short") return t.errors.reason_too_short(MIN_REASON);
  if (error === "reason_too_long") return t.errors.reason_too_long(MAX_REASON);
  return t.errors[error];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Maseru",
  });
}

const noSubscribe = () => () => {};

// The officer always makes the final call. Saved in this browser only.
export function OverridePanel({ traderId }: { traderId: string }) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  // The server has no saved decisions; the browser reads them on mount.
  return inBrowser ? <Panel key="browser" traderId={traderId} loaded /> : <Panel key="server" traderId={traderId} />;
}

function Panel({ traderId, loaded = false }: { traderId: string; loaded?: boolean }) {
  const id = useId();
  const [log, setLog] = useState<DecisionLog>(() => (loaded ? loadDecisions() : {}));
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<SaveError | null>(null);
  const [saved, setSaved] = useState(false);
  const entries = log[traderId] ?? [];

  function save(e: FormEvent) {
    e.preventDefault();
    const check = checkDecision(decision, reason, new Date().toISOString());
    if (!check.ok) {
      setError(check.error);
      setSaved(false);
      return;
    }
    const next = addDecision(loadDecisions(), traderId, check.record);
    if (!saveDecisions(next)) {
      setError("storage");
      return;
    }
    setLog(next);
    setDecision("");
    setReason("");
    setError(null);
    setSaved(true);
  }

  const reasonInvalid = error === "reason_too_short" || error === "reason_too_long";

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-card border border-line bg-surface p-5">
      <h2 id={`${id}-heading`} className="text-lg font-bold">
        {t.heading}
      </h2>
      <form onSubmit={save} noValidate className="mt-4 space-y-4">
        <div>
          <label htmlFor={`${id}-decision`} className="mb-1 block text-sm font-semibold">
            {t.label}
          </label>
          <select
            id={`${id}-decision`}
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value);
              setSaved(false);
            }}
            aria-invalid={error === "no_decision"}
            aria-describedby={error === "no_decision" ? `${id}-error` : undefined}
            disabled={!loaded}
            className="min-h-11 w-full rounded-card border border-line bg-surface px-3 text-base"
          >
            <option value="">{t.choose}</option>
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {t.options[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-reason`} className="mb-1 block text-sm font-semibold">
            {t.reason}
          </label>
          <textarea
            id={`${id}-reason`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setSaved(false);
            }}
            rows={3}
            maxLength={MAX_REASON}
            required
            aria-invalid={reasonInvalid}
            aria-describedby={`${id}-hint${reasonInvalid ? ` ${id}-error` : ""}`}
            disabled={!loaded}
            className="w-full rounded-card border border-line bg-surface px-3 py-2 text-base"
          />
          <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
            {t.reasonHint(MIN_REASON)}
          </p>
        </div>
        <div aria-live="polite">
          {error && (
            <p id={`${id}-error`} className="text-sm font-semibold text-status-followup">
              {errorText(error)}
            </p>
          )}
          {saved && <p className="text-sm font-semibold text-green-text">{t.saved}</p>}
        </div>
        <Button type="submit" disabled={!loaded}>
          {t.save}
        </Button>
      </form>

      <h3 className="mt-6 border-t border-line pt-4 font-semibold">{t.logHeading}</h3>
      {entries.length ? (
        <ol className="mt-2 space-y-3">
          {entries.map((entry) => (
            <li key={entry.at} className="rounded-card bg-page p-3 text-sm">
              <p className="font-semibold">{t.options[entry.decision]}</p>
              <p className="mt-1 break-words">{entry.reason}</p>
              <p className="mt-1 text-xs text-muted">
                <time dateTime={entry.at}>{formatTime(entry.at)}</time>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">{t.logEmpty}</p>
      )}
      <p className="mt-4 text-sm text-muted">{t.pilotNote}</p>
    </section>
  );
}
