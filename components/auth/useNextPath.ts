"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// The page to go back to after logging in (?next=), read in the browser so the
// form itself can be part of the static page and never re-renders under the
// trader's fingers. The server checks it again (safeNext in lib/accounts.ts).
export function useNextPath(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("next") ?? "",
    () => "",
  );
}
