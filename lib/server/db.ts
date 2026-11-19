// The connection to the accounts database (added 19 Nov 2026).
//
// On Vercel it is Supabase Postgres, through POSTGRES_URL (set by Vercel's
// Supabase integration) or DATABASE_URL. Without either, local development
// uses an in-memory PGlite database that is lost when the server stops, and
// `ACCOUNTS_DB=memory` allows the same for `next start` on a laptop. On
// Vercel a missing database is an error: accounts never fall back to memory.

import "server-only";
import postgres from "postgres";
import { hashPassword } from "./password";
import { SCHEMA_SQL } from "./schema";

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>; // several statements, no parameters
}

export class AccountsNotConfigured extends Error {
  constructor() {
    super("The accounts database isn't set up.");
  }
}

function connectionString(): string | undefined {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || undefined;
}

export function accountsConfigured(): boolean {
  return Boolean(connectionString()) || canUseMemory();
}

function canUseMemory(): boolean {
  if (process.env.VERCEL) return false;
  return process.env.NODE_ENV !== "production" || process.env.ACCOUNTS_DB === "memory";
}

function postgresDb(url: string): Db {
  // Query options such as Supabase's "supa=" aren't Postgres settings, so they
  // are dropped; TLS is required instead. prepare: false suits Supabase's
  // transaction pooler.
  const clean = new URL(url);
  clean.search = "";
  const sql = postgres(clean.toString(), { ssl: "require", prepare: false, max: 3, idle_timeout: 20 });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[];
    },
    async exec(text: string) {
      await sql.unsafe(text);
    },
  };
}

async function memoryDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  return pgliteDb(db);
}

// Also used by the tests.
export function pgliteDb(db: {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
}): Db {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await db.query<T>(text, params)).rows;
    },
    async exec(text: string) {
      await db.exec(text);
    },
  };
}

// Creates the tables if needed, then the first officer from OFFICER_USERNAME
// and OFFICER_PASSWORD when that account doesn't exist yet. An existing
// account is never changed, so a password changed later isn't reset.
export async function prepareDb(db: Db, env: Record<string, string | undefined> = process.env): Promise<Db> {
  await db.exec(SCHEMA_SQL);
  const username = env.OFFICER_USERNAME?.trim().toLowerCase();
  const password = env.OFFICER_PASSWORD;
  if (username && password && password.length >= 8) {
    const found = await db.query("select 1 from khoebo.users where username = $1", [username]);
    if (!found.length) {
      await db.query(
        `insert into khoebo.users (id, username, full_name, role, password_hash)
         values ($1, $2, $3, 'officer', $4) on conflict (username) do nothing`,
        [crypto.randomUUID(), username, env.OFFICER_NAME?.trim() || "RSL officer", await hashPassword(password)],
      );
    }
  }
  return db;
}

const globalForDb = globalThis as unknown as { khoeboDb?: Promise<Db> };

// One connection pool per server instance, kept across hot reloads.
export function getDb(): Promise<Db> {
  if (!globalForDb.khoeboDb) {
    const url = connectionString();
    if (!url && !canUseMemory()) return Promise.reject(new AccountsNotConfigured());
    const ready = (url ? Promise.resolve(postgresDb(url)) : memoryDb()).then((db) => prepareDb(db));
    // A failed start (say the database was asleep) is tried again next time.
    ready.catch(() => {
      if (globalForDb.khoeboDb === ready) globalForDb.khoeboDb = undefined;
    });
    globalForDb.khoeboDb = ready;
  }
  return globalForDb.khoeboDb;
}
