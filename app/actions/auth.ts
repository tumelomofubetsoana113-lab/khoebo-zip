"use server";

// Sign-up, log-in and log-out (added 19 Nov 2026). Next.js checks that a
// server action comes from this site's own pages, which stops cross-site
// form posts. Nothing typed into these forms is logged.

import { redirect } from "next/navigation";
import { fieldErrors, LoginSchema, readSignupForm, safeNext, SignupSchema, type FieldErrors } from "@/lib/accounts";
import { checkLogin, createSession, createTrader, rateLimited, recordRateEvent } from "@/lib/server/accounts";
import { AccountsNotConfigured, getDb, type Db } from "@/lib/server/db";
import { clearSession, clientAddress, setSessionCookie } from "@/lib/server/session";
import { strings } from "@/lib/strings";

const e = strings.auth.errors;

export type AuthFormState = {
  error?: string;
  fields?: FieldErrors;
  // What was typed, to fill the form again. Never the password.
  values?: { fullName?: string; username?: string; businessIds?: string[] };
};

async function database(): Promise<Db | AuthFormState> {
  try {
    return await getDb();
  } catch (err) {
    if (!(err instanceof AccountsNotConfigured)) console.error("accounts database unavailable");
    return { error: e.unavailable };
  }
}

export async function signup(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = readSignupForm(form);
  const values = { fullName: raw.fullName, username: raw.username, businessIds: raw.businessIds };
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) return { error: e.checkForm, fields: fieldErrors(parsed.error), values };

  const db = await database();
  if (!("query" in db)) return { ...db, values };
  const address = await clientAddress();
  if (await rateLimited(db, "signup", address)) return { error: e.tooManySignups, values };
  await recordRateEvent(db, "signup", address);

  const result = await createTrader(db, parsed.data);
  if (!result.ok) {
    return result.error === "username_taken"
      ? { error: e.checkForm, fields: { username: e.usernameTaken }, values }
      : { error: e.checkForm, fields: { [`businessIds.${result.index ?? 0}`]: e.businessIdTaken }, values };
  }
  const session = await createSession(db, result.account.id);
  await setSessionCookie(session.token, session.expires);
  redirect(safeNext(form.get("next"), result.account.role));
}

export async function login(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({ username: String(form.get("username") ?? ""), password: String(form.get("password") ?? "") });
  const values = { username: String(form.get("username") ?? "") };
  if (!parsed.success) return { error: e.loginMissing, values };

  const db = await database();
  if (!("query" in db)) return { ...db, values };
  const address = await clientAddress();
  if (await rateLimited(db, "login", address)) return { error: e.tooManyLogins, values };

  const result = await checkLogin(db, parsed.data.username, parsed.data.password);
  if (!result.ok) {
    await recordRateEvent(db, "login", address);
    return { error: result.error === "locked" ? e.locked : e.loginWrong, values };
  }
  const session = await createSession(db, result.account.id);
  await setSessionCookie(session.token, session.expires);
  redirect(safeNext(form.get("next"), result.account.role));
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
