// Password hashing with scrypt from Node's own crypto module (added 19 Nov
// 2026). The default cost is OWASP's recommendation (N = 2^17, r = 8, p = 1).
// The cost is stored with each hash, so it can be raised later without
// breaking older hashes.
//
// Only node:crypto is imported, so scripts/create-officer.mts can use this
// file directly.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export type ScryptCost = { N: number; r: number; p: number };

export const DEFAULT_COST: ScryptCost = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
const MAX_N = 2 ** 20; // refuse stored costs big enough to exhaust memory

function derive(password: string, salt: Buffer, cost: ScryptCost): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: cost.N, r: cost.r, p: cost.p, maxmem: 256 * cost.N * cost.r },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

// "scrypt$N$r$p$salt$hash", with the salt and hash in base64url.
export async function hashPassword(password: string, cost: ScryptCost = DEFAULT_COST): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, cost);
  return ["scrypt", cost.N, cost.r, cost.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

// False for a wrong password or a hash it can't read. Never throws.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [kind, n, r, p, saltText, keyText] = stored.split("$");
    const cost = { N: Number(n), r: Number(r), p: Number(p) };
    if (kind !== "scrypt" || !saltText || !keyText) return false;
    if (![cost.N, cost.r, cost.p].every(Number.isInteger) || cost.N < 2 || cost.N > MAX_N || cost.r > 32 || cost.p > 16) {
      return false;
    }
    const expected = Buffer.from(keyText, "base64url");
    const actual = await derive(password, Buffer.from(saltText, "base64url"), cost);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
