import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fieldErrors, homeFor, readSignupForm, safeNext, SignupSchema, type SignupInput } from "@/lib/accounts";
import {
  checkLogin,
  createSession,
  createTrader,
  endSession,
  hashToken,
  MAX_FAILED_LOGINS,
  RATE_LIMITS,
  rateLimited,
  recordRateEvent,
  sessionAccount,
} from "@/lib/server/accounts";
import { pgliteDb, prepareDb, type Db } from "@/lib/server/db";
import { hashPassword, verifyPassword, type ScryptCost } from "@/lib/server/password";
import { scopedKey, setStorageScope, claimUnscoped } from "@/lib/storage-scope";
import { strings } from "@/lib/strings";

// A low cost keeps the tests fast; the app uses the OWASP default.
const FAST: ScryptCost = { N: 1024, r: 8, p: 1 };
const e = strings.auth.errors;

function signupInput(over: Partial<Record<string, unknown>> = {}) {
  return {
    fullName: "Palesa Mokoena",
    username: "Palesa.M",
    password: "fruit-stall-42",
    confirm: "fruit-stall-42",
    businessIds: ["ms 1234/26"],
    ...over,
  };
}

describe("password hashing", () => {
  it("accepts the right password and refuses others", async () => {
    const hash = await hashPassword("correct horse", FAST);
    expect(hash).toMatch(/^scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("correct horsE", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same", FAST)).not.toBe(await hashPassword("same", FAST));
  });

  it("uses the OWASP cost by default", async () => {
    expect((await hashPassword("x")).startsWith("scrypt$131072$8$1$")).toBe(true);
  }, 15_000);

  it("refuses broken or oversized stored hashes without throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
    expect(await verifyPassword("x", "scrypt$4194304$8$1$c2FsdA$a2V5")).toBe(false);
  });
});

describe("sign-up rules", () => {
  it("normalises the username and business IDs", () => {
    const parsed = SignupSchema.parse(signupInput({ businessIds: [" ms  1234/26 ", "b-77"] }));
    expect(parsed.username).toBe("palesa.m");
    expect(parsed.businessIds).toEqual(["MS 1234/26", "B-77"]);
  });

  it("explains each problem on its own field", () => {
    const result = SignupSchema.safeParse(
      signupInput({ username: "ab", password: "short", confirm: "other", businessIds: ["A1", "a1"], fullName: "" }),
    );
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(errors.username).toBe(e.usernameShort);
    expect(errors.password).toBe(e.passwordShort);
    expect(errors.fullName).toBe(e.nameShort);
  });

  it("checks the confirm field, repeated IDs and the username in the password", () => {
    const errors = (input: Record<string, unknown>) => fieldErrors(SignupSchema.safeParse(signupInput(input)).error!);
    expect(errors({ confirm: "fruit-stall-43" }).confirm).toBe(e.passwordsDiffer);
    expect(errors({ businessIds: ["A1", "a1"] })["businessIds.1"]).toBe(e.businessIdRepeated);
    expect(errors({ password: "palesa.m-2026", confirm: "palesa.m-2026" }).password).toBe(e.passwordHasUsername);
  });

  it("refuses common passwords, reserved names and odd characters", () => {
    const errors = (input: Record<string, unknown>) => fieldErrors(SignupSchema.safeParse(signupInput(input)).error!);
    expect(errors({ password: "Password123", confirm: "Password123" }).password).toBe(e.passwordCommon);
    expect(errors({ username: "Admin" }).username).toBe(e.usernameReserved);
    expect(errors({ username: "pale sa" }).username).toBe(e.usernameChars);
    expect(errors({ businessIds: ["<script>"] })["businessIds.0"]).toBe(e.businessIdChars);
  });

  it("reads only as many business IDs as the trader chose", () => {
    const form = new FormData();
    form.set("businessCount", "2");
    form.set("businessId0", "A1");
    form.set("businessId1", "B2");
    form.set("businessId2", "left over");
    expect(readSignupForm(form).businessIds).toEqual(["A1", "B2"]);
    form.set("businessCount", "99");
    expect(readSignupForm(form).businessIds).toHaveLength(10);
  });
});

describe("where people land", () => {
  it("sends traders and officers to their own side", () => {
    expect(homeFor("trader")).toBe("/trader");
    expect(homeFor("officer")).toBe("/officer");
  });

  it("only goes back to a page of the user's own side", () => {
    expect(safeNext("/trader?via=field&district=Maseru", "trader")).toBe("/trader?via=field&district=Maseru");
    expect(safeNext("/trader/statement?period=2026-10", "trader")).toBe("/trader/statement?period=2026-10");
    expect(safeNext("/officer/leads", "trader")).toBe("/trader");
    expect(safeNext("/trader", "officer")).toBe("/officer");
    expect(safeNext("https://evil.example/trader", "trader")).toBe("/trader");
    expect(safeNext("//evil.example", "trader")).toBe("/trader");
    expect(safeNext("/traderx", "trader")).toBe("/trader");
    expect(safeNext(null, "officer")).toBe("/officer");
  });
});

describe("accounts in the database", () => {
  let db: Db;

  // One database for the file, emptied before each test (starting PGlite is slow).
  beforeAll(async () => {
    db = await prepareDb(pgliteDb(new PGlite()), {});
  }, 60_000);
  beforeEach(async () => {
    await db.exec("truncate khoebo.users, khoebo.businesses, khoebo.sessions, khoebo.rate_events cascade");
  });

  async function trader(over: Partial<Record<string, unknown>> = {}): Promise<SignupInput> {
    const input = SignupSchema.parse(signupInput(over));
    const result = await createTrader(db, input, FAST);
    expect(result.ok).toBe(true);
    return input;
  }

  it("creates a trader with their businesses, and never stores the password", async () => {
    await trader({ businessIds: ["A1", "B2", "C3"] });
    const [user] = await db.query<{ username: string; role: string; password_hash: string }>(
      "select username, role, password_hash from khoebo.users",
    );
    expect(user).toMatchObject({ username: "palesa.m", role: "trader" });
    expect(user.password_hash).not.toContain("fruit-stall-42");
    const businesses = await db.query<{ business_id: string }>("select business_id from khoebo.businesses order by position");
    expect(businesses.map((b) => b.business_id)).toEqual(["A1", "B2", "C3"]);
  });

  it("refuses a taken username or business ID, and leaves nothing half made", async () => {
    await trader({ businessIds: ["A1"] });
    const again = SignupSchema.parse(signupInput({ businessIds: ["Z9"] }));
    expect(await createTrader(db, again, FAST)).toEqual({ ok: false, error: "username_taken" });
    const sameId = SignupSchema.parse(signupInput({ username: "thabo", businessIds: ["Q1", "a1"] }));
    expect(await createTrader(db, sameId, FAST)).toEqual({ ok: false, error: "business_id_taken", index: 1 });
    expect(await db.query("select 1 from khoebo.users")).toHaveLength(1);
    expect(await db.query("select 1 from khoebo.businesses")).toHaveLength(1);
  });

  it("logs in with the right password only, with the same answer for an unknown name", async () => {
    await trader();
    const ok = await checkLogin(db, "palesa.m", "fruit-stall-42", FAST);
    expect(ok).toMatchObject({ ok: true, account: { username: "palesa.m", fullName: "Palesa Mokoena", role: "trader", businessIds: ["MS 1234/26"] } });
    expect(await checkLogin(db, "palesa.m", "wrong-password", FAST)).toEqual({ ok: false, error: "invalid" });
    expect(await checkLogin(db, "nobody", "fruit-stall-42", FAST)).toEqual({ ok: false, error: "invalid" });
  });

  it("locks an account after five wrong passwords, even for the right one", async () => {
    await trader();
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await checkLogin(db, "palesa.m", "wrong", FAST)).ok).toBe(false);
    }
    expect(await checkLogin(db, "palesa.m", "wrong", FAST)).toEqual({ ok: false, error: "locked" });
    expect(await checkLogin(db, "palesa.m", "fruit-stall-42", FAST)).toEqual({ ok: false, error: "locked" });
    await db.query("update khoebo.users set locked_until = now() - interval '1 minute'");
    expect((await checkLogin(db, "palesa.m", "fruit-stall-42", FAST)).ok).toBe(true);
  });

  it("keeps only a hash of the session token, and ends sessions", async () => {
    await trader();
    const login = await checkLogin(db, "palesa.m", "fruit-stall-42", FAST);
    if (!login.ok) throw new Error("login failed");
    const { token, expires } = await createSession(db, login.account.id);
    expect(expires.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
    const [row] = await db.query<{ token_hash: string }>("select token_hash from khoebo.sessions");
    expect(row.token_hash).toBe(hashToken(token));
    expect(row.token_hash).not.toBe(token);

    expect(await sessionAccount(db, token)).toMatchObject({ username: "palesa.m", role: "trader" });
    expect(await sessionAccount(db, "made-up")).toBeNull();
    expect(await sessionAccount(db, `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`)).toBeNull();

    await endSession(db, token);
    expect(await sessionAccount(db, token)).toBeNull();
  });

  it("refuses an expired session", async () => {
    await trader();
    const [user] = await db.query<{ id: string }>("select id from khoebo.users");
    const { token } = await createSession(db, user.id);
    await db.query("update khoebo.sessions set expires_at = now() - interval '1 second'");
    expect(await sessionAccount(db, token)).toBeNull();
  });

  it("limits tries per network address", async () => {
    for (let i = 0; i < RATE_LIMITS.signup; i++) await recordRateEvent(db, "signup", "198.51.100.7");
    expect(await rateLimited(db, "signup", "198.51.100.7")).toBe(true);
    expect(await rateLimited(db, "signup", "198.51.100.8")).toBe(false);
    expect(await rateLimited(db, "login", "198.51.100.7")).toBe(false);
    const [row] = await db.query<{ key_hash: string }>("select key_hash from khoebo.rate_events limit 1");
    expect(row.key_hash).not.toContain("198.51");
  });

  it("creates the first officer from the environment once, and never changes it", async () => {
    await prepareDb(db, { OFFICER_USERNAME: "Officer.Lebo", OFFICER_PASSWORD: "worklist-2026" });
    const login = await checkLogin(db, "officer.lebo", "worklist-2026");
    expect(login).toMatchObject({ ok: true, account: { role: "officer", fullName: "RSL officer" } });
    await prepareDb(db, { OFFICER_USERNAME: "officer.lebo", OFFICER_PASSWORD: "another-password" });
    expect((await checkLogin(db, "officer.lebo", "worklist-2026")).ok).toBe(true);
    expect(await db.query("select 1 from khoebo.users where role = 'officer'")).toHaveLength(1);
  }, 30_000);

  it("keeps the tables out of the public schema, with row level security on", async () => {
    const tables = await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'khoebo' order by tablename",
    );
    expect(tables.map((t) => t.tablename)).toEqual(["businesses", "rate_events", "sessions", "users"]);
    expect(tables.every((t) => t.rowsecurity)).toBe(true);
    expect(await db.query("select 1 from pg_tables where schemaname = 'public'")).toHaveLength(0);
  });
});

describe("records per account in the browser", () => {
  function memoryStore() {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      data,
    };
  }

  it("adds the account to each key, and hands older records to the first account", () => {
    const store = memoryStore();
    store.setItem("khoebo.trader.v1", "old records");
    setStorageScope("user-1");
    try {
      expect(scopedKey("khoebo.trader.v1")).toBe("khoebo.trader.v1:user-1");
      claimUnscoped(["khoebo.trader.v1"], store);
      expect(store.getItem("khoebo.trader.v1:user-1")).toBe("old records");
      expect(store.getItem("khoebo.trader.v1")).toBeNull();

      setStorageScope("user-2");
      claimUnscoped(["khoebo.trader.v1"], store);
      expect(store.getItem("khoebo.trader.v1:user-2")).toBeNull();
    } finally {
      setStorageScope(null);
    }
    expect(scopedKey("khoebo.trader.v1")).toBe("khoebo.trader.v1");
  });
});
