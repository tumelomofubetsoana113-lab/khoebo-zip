// Each account keeps its own records in the browser (added 19 Nov 2026): once
// someone is signed in, the localStorage keys get their account id on the
// end, so two people sharing a phone never see each other's records. With no
// account (the tests), the keys stay as they were.

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let scope: string | null = null;

export function setStorageScope(accountId: string | null): void {
  scope = accountId;
}

export function scopedKey(base: string): string {
  return scope ? `${base}:${scope}` : base;
}

// Records saved before accounts existed belong to the first account that
// signs in on this browser: they move to that account's keys, once.
export function claimUnscoped(keys: readonly string[], store: Store | null): void {
  if (!scope || !store) return;
  try {
    for (const base of keys) {
      const old = store.getItem(base);
      if (old !== null && store.getItem(scopedKey(base)) === null) store.setItem(scopedKey(base), old);
      if (old !== null) store.removeItem(base);
    }
  } catch {
    // storage blocked: nothing to move
  }
}
