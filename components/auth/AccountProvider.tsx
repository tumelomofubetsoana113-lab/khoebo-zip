"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Account } from "@/lib/accounts";
import { CHAT_KEY } from "@/lib/chat";
import { DECISIONS_KEY } from "@/lib/decisions";
import { STORAGE_KEY } from "@/lib/state";
import { claimUnscoped, setStorageScope } from "@/lib/storage-scope";

const AccountContext = createContext<Account | null>(null);

function browserStore(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Gives the page the signed-in account, and points the browser's saved
// records at that account before anything reads them.
export function AccountProvider({ account, children }: { account: Account; children: ReactNode }) {
  useState(() => {
    if (typeof window === "undefined") return null;
    setStorageScope(account.id);
    claimUnscoped([STORAGE_KEY, CHAT_KEY, DECISIONS_KEY], browserStore());
    return null;
  });
  return <AccountContext value={account}>{children}</AccountContext>;
}

export function useAccount(): Account | null {
  return useContext(AccountContext);
}
