// Accounts, log-ins and sessions (added 19 Nov 2026). Every function takes
// the database, so the tests run the same SQL against PGlite.
//
// - Passwords are stored only as scrypt hashes (./password.ts).
// - A session is a random 32-byte token in an httpOnly cookie. The database
//   keeps only its SHA-256 hash, so a leaked table can't be used to log in.
// - Five wrong passwords lock an account for 15 minutes, and each network
//   address gets 20 failed log-ins and 10 sign-ups in 15 minutes. Addresses
//   are stored only as keyed hashes, and deleted after a day.
// - A wrong username and a wrong password get the same answer, and take as
//   long, so the form can't be used to find out who has an account.

import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Account, Role, SignupInput } from "@/lib/accounts";
import type { Db } from "./db";
import { hashPassword, verifyPassword, type ScryptCost, DEFAULT_COST } from "./password";

export const SESSION_DAYS = 7;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const RATE_WINDOW_MINUTES = 15;
export const RATE_LIMITS = { login: 20, signup: 10 } as const;

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  password_hash: string;
  failed_logins: number;
  locked_until: Date | string | null;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function addressKey(address: string, secret = process.env.AUTH_SECRET || "khoebo-rate-limit"): string {
  return createHmac("sha256", secret).update(address).digest("hex");
}

// True when this address has used up its tries for the bucket.
export async function rateLimited(db: Db, bucket: keyof typeof RATE_LIMITS, address: string): Promise<boolean> {
  const rows = await db.query<{ n: number | string }>(
    `select count(*) as n from khoebo.rate_events
     where bucket = $1 and key_hash = $2 and at > now() - interval '${RATE_WINDOW_MINUTES} minutes'`,
    [bucket, addressKey(address)],
  );
  return Number(rows[0]?.n ?? 0) >= RATE_LIMITS[bucket];
}

export async function recordRateEvent(db: Db, bucket: keyof typeof RATE_LIMITS, address: string): Promise<void> {
  await db.query("insert into khoebo.rate_events (bucket, key_hash) values ($1, $2)", [bucket, addressKey(address)]);
  await db.query("delete from khoebo.rate_events where at < now() - interval '1 day'");
}

async function loadAccount(db: Db, user: Pick<UserRow, "id" | "username" | "full_name" | "role">): Promise<Account> {
  const businesses = await db.query<{ business_id: string }>(
    "select business_id from khoebo.businesses where user_id = $1 order by position",
    [user.id],
  );
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    businessIds: businesses.map((b) => b.business_id),
  };
}

export type SignupResult =
  | { ok: true; account: Account }
  | { ok: false; error: "username_taken" | "business_id_taken"; index?: number };

// Creates a trader with their businesses in one statement, so a failure
// never leaves half an account behind.
export async function createTrader(db: Db, input: SignupInput, cost: ScryptCost = DEFAULT_COST): Promise<SignupResult> {
  if ((await db.query("select 1 from khoebo.users where username = $1", [input.username])).length) {
    return { ok: false, error: "username_taken" };
  }
  const taken = await db.query<{ business_id: string }>(
    `select business_id from khoebo.businesses where business_id in (${input.businessIds.map((_, i) => `$${i + 1}`).join(", ")})`,
    input.businessIds,
  );
  if (taken.length) {
    return { ok: false, error: "business_id_taken", index: input.businessIds.indexOf(taken[0].business_id) };
  }

  const id = crypto.randomUUID();
  const params: unknown[] = [id, input.username, input.fullName, await hashPassword(input.password, cost)];
  const values = input.businessIds.map((businessId, i) => {
    params.push(i, businessId);
    return `($${params.length - 1}::smallint, $${params.length}::text)`;
  });
  try {
    await db.query(
      `with u as (
         insert into khoebo.users (id, username, full_name, role, password_hash)
         values ($1, $2, $3, 'trader', $4) returning id
       )
       insert into khoebo.businesses (user_id, position, business_id)
       select u.id, b.position, b.business_id from u, (values ${values.join(", ")}) as b (position, business_id)`,
      params,
    );
  } catch (err) {
    // Someone else took the name or an ID between the check and the insert.
    const pgError = err as { code?: string; constraint_name?: string; constraint?: string };
    if (pgError.code === "23505") {
      const constraint = pgError.constraint_name ?? pgError.constraint ?? "";
      return { ok: false, error: constraint.includes("business") ? "business_id_taken" : "username_taken" };
    }
    throw err;
  }
  return { ok: true, account: { id, username: input.username, fullName: input.fullName, role: "trader", businessIds: input.businessIds } };
}

export type LoginResult = { ok: true; account: Account } | { ok: false; error: "invalid" | "locked" };

// Computed once, so an unknown username costs as much time as a known one.
let dummyHash: Promise<string> | undefined;

export async function checkLogin(
  db: Db,
  username: string,
  password: string,
  cost: ScryptCost = DEFAULT_COST,
): Promise<LoginResult> {
  const [user] = await db.query<UserRow>(
    "select id, username, full_name, role, password_hash, failed_logins, locked_until from khoebo.users where username = $1",
    [username],
  );
  if (!user) {
    dummyHash ??= hashPassword("not a real password", cost);
    await verifyPassword(password, await dummyHash);
    return { ok: false, error: "invalid" };
  }
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) return { ok: false, error: "locked" };

  if (!(await verifyPassword(password, user.password_hash))) {
    const failed = user.failed_logins + 1;
    if (failed >= MAX_FAILED_LOGINS) {
      await db.query(
        `update khoebo.users set failed_logins = 0, locked_until = now() + interval '${LOCK_MINUTES} minutes' where id = $1`,
        [user.id],
      );
      return { ok: false, error: "locked" };
    }
    await db.query("update khoebo.users set failed_logins = $2 where id = $1", [user.id, failed]);
    return { ok: false, error: "invalid" };
  }

  if (user.failed_logins || user.locked_until) {
    await db.query("update khoebo.users set failed_logins = 0, locked_until = null where id = $1", [user.id]);
  }
  return { ok: true, account: await loadAccount(db, user) };
}

// Returns the token for the cookie. Expired sessions are cleared out on the way.
export async function createSession(db: Db, userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.query("delete from khoebo.sessions where expires_at < now()");
  await db.query("insert into khoebo.sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
    hashToken(token),
    userId,
    expires.toISOString(),
  ]);
  return { token, expires };
}

export async function sessionAccount(db: Db, token: string): Promise<Account | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [user] = await db.query<UserRow>(
    `select u.id, u.username, u.full_name, u.role from khoebo.sessions s
     join khoebo.users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return user ? loadAccount(db, user) : null;
}

export async function endSession(db: Db, token: string): Promise<void> {
  await db.query("delete from khoebo.sessions where token_hash = $1", [hashToken(token)]);
}
