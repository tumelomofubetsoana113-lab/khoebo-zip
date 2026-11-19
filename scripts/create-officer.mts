// Creates an RSL officer account (added 19 Nov 2026). There is no public
// sign-up for officers: they are only made here, or the first one from
// OFFICER_USERNAME and OFFICER_PASSWORD in Vercel.
//
//   POSTGRES_URL=... NEW_OFFICER_PASSWORD=... npm run officer:create -- <username> "<Full name>"
//
// POSTGRES_URL is the Supabase connection string (Vercel → Storage →
// Supabase → .env.local tab). The password is read from NEW_OFFICER_PASSWORD
// so it isn't left in the shell history as an argument.

import postgres from "postgres";
import { hashPassword } from "../lib/server/password.ts";
import { SCHEMA_SQL } from "../lib/server/schema.ts";

const [usernameArg, ...nameParts] = process.argv.slice(2);
const username = usernameArg?.trim().toLowerCase();
const fullName = nameParts.join(" ").trim() || "RSL officer";
const password = process.env.NEW_OFFICER_PASSWORD ?? "";
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!username || !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
  console.error("Give a username of 3 to 30 letters, numbers, . _ or -");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Set NEW_OFFICER_PASSWORD to a password of at least 8 characters.");
  process.exit(1);
}
if (!url) {
  console.error("Set POSTGRES_URL to the Supabase connection string.");
  process.exit(1);
}

const clean = new URL(url);
clean.search = "";
const sql = postgres(clean.toString(), { ssl: "require", prepare: false, max: 1 });
try {
  await sql.unsafe(SCHEMA_SQL);
  const rows = await sql.unsafe(
    `insert into khoebo.users (id, username, full_name, role, password_hash)
     values ($1, $2, $3, 'officer', $4) on conflict (username) do nothing returning id`,
    [crypto.randomUUID(), username, fullName, await hashPassword(password)],
  );
  console.log(rows.length ? `Officer account "${username}" created.` : `"${username}" already exists; nothing changed.`);
} finally {
  await sql.end();
}
