// Reading and setting the session cookie (added 19 Nov 2026). This is the
// only place pages, server actions and the chat route learn who is signed in.

import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Account } from "@/lib/accounts";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { endSession, sessionAccount } from "./accounts";
import { getDb } from "./db";

// The signed-in account, or null. Checked against the database every time,
// so logging out or an expired session takes effect straight away. Read once
// per request.
export const currentAccount = cache(async (): Promise<Account | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await sessionAccount(await getDb(), token);
  } catch {
    return null; // database unreachable: treat as signed out
  }
});

export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (token) {
    try {
      await endSession(await getDb(), token);
    } catch {
      // the cookie is gone; the row expires on its own
    }
  }
}

// The caller's network address, for rate limits only. Vercel sets
// x-forwarded-for; the first entry is the client.
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
