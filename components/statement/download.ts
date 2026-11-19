// Saves a statement as a CSV file on the phone. Made in the browser from the
// records in localStorage, so nothing is sent anywhere.

import { todayISO } from "@/lib/dates";
import { loadState } from "@/lib/state";
import {
  buildStatement,
  returnsToFile,
  statementCsv,
  statementFileName,
  statementPath,
  type Statement,
  type StatementKey,
} from "@/lib/statement";

export function downloadStatement(st: Statement): void {
  // The byte order mark tells Excel the file is UTF-8.
  const blob = new Blob(["﻿", statementCsv(st)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = statementFileName(st);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// From a chat card: the records as they are now, not as they were when the card was shown.
// While a return it covers is due and not filed, it opens the statement page,
// which says so, instead of downloading.
export function downloadSavedStatement(key: StatementKey, businessId?: string): void {
  const state = loadState();
  const today = todayISO();
  if (returnsToFile(state, key, today, businessId).length > 0) {
    window.location.assign(statementPath(key, businessId));
    return;
  }
  downloadStatement(buildStatement(state, key, today, businessId));
}
