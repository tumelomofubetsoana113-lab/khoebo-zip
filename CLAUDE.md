# Khoebo

Khoebo is an entry for the Revenue Services Lesotho (RSL) Taxathon 2026, Challenge 1: informal sector compliance. It has two sides:

- A phone-sized chat assistant that helps informal traders keep sales records and file returns.
- An officer worklist that sorts traders into four follow-up actions, with the reasons written out.

The full plan is in `SPEC.md`. Read it before starting any task, and build in the order set out in its "Build order" section. Don't skip ahead.

Submission deadline: 6 November 2026. Live address to submit: https://khoebo-r8lc.vercel.app (also served at khoebo.newempireai.online).

## Stack

Next.js (App Router) with TypeScript, Tailwind CSS, the Anthropic TypeScript SDK (`@anthropic-ai/sdk`) with tool use, `lucide-react` for icons, and Vitest for tests. It's hosted on Vercel, with DNS on Cloudflare. User accounts (name, username, password hash, business IDs) live in Supabase Postgres, through `postgres` (since 19 November 2026). Trader records (sales, purchases, returns) still live in the browser's localStorage, one set per account.

## Rules that must not be broken

1. **Claude never calculates anything.** The model reads messages and calls tools. All amounts, totals, profit and tax estimates come from the functions in `lib/ledger.ts` and `lib/tax.ts`. A reply may only show a number that a tool returned.
2. **The API key stays on the server.** `ANTHROPIC_API_KEY` is read only in `app/api/chat/route.ts`. It is never sent to the browser, logged or committed.
3. **Store as little as possible.** The only database holds accounts: full name, username, an scrypt password hash, business IDs, session token hashes, and keyed hashes of network addresses for rate limits (deleted after a day). Never store a password or session token in plain text, never put trader records or messages in the database without the owner's say-so, and add no analytics. Message content and form input are never logged. Server logs may record counts and errors only. All database access goes through `lib/server/`.
4. **The officer side never sees hidden simulation columns.** Anything starting with `hidden_` exists for scoring only. The export script drops it before the app sees the data.
5. **It's Khoebo.** The footer says only "© Khoebo 2026". The app doesn't use the words "prototype" or "RSL Taxathon" (the owner's decisions, 19 November 2026), and it never claims to be RSL. Never use RSL's logo, WhatsApp's name or logo, or the mokorotlo emblem from the flag.
6. **Placeholder tax rates are labelled.** Until RSL confirms the Simplified Business Tax rates, every estimate shows a note that it uses a placeholder rate.
7. **Use only the palette in `SPEC.md`.** Colours come from the Tailwind theme tokens, never from hex values typed into components.

## Commands

```bash
npm run dev        # local dev server
npm run test       # Vitest
npm run lint
npm run build
npm run data       # rebuilds data/worklist.json from the Python simulation in scripts/
npm run eval:chat  # chat eval against the running app (needs ANTHROPIC_API_KEY)
npm run eval:receipts  # receipt reading eval against the running app (needs ANTHROPIC_API_KEY)
npm run officer:create -- <username> "<Full name>"  # adds an officer account (needs POSTGRES_URL and NEW_OFFICER_PASSWORD)
```

## Environment variables

| Name | Example | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (secret) | Set in Vercel only. Locally, in `.env.local`, which is git-ignored. |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Switch to `claude-sonnet-5-5` without code changes if needed. |
| `MAX_MESSAGES_PER_SESSION` | `60` | Caps spend on a public link. |
| `POSTGRES_URL` | (secret) | Supabase connection string, set by Vercel's Supabase integration. `DATABASE_URL` also works. Without either, `npm run dev` uses an in-memory database. |
| `OFFICER_USERNAME`, `OFFICER_PASSWORD`, `OFFICER_NAME` | (secret) | The first officer account, created on start-up if it doesn't exist. Never changes an existing account. |
| `AUTH_SECRET` | (secret) | Key for hashing network addresses in rate limits. Any long random string. |
| `ACCOUNTS_DB` | `memory` | Laptop only: lets `next start` use the in-memory database. Ignored on Vercel. |
| `CHAT_EVAL_KEY` | (secret) | Laptop only: lets the chat evals call `/api/chat` without logging in. Ignored on Vercel. |

## Working style

- Small commits, one step of the build order at a time. After each step, run `npm run test` and `npm run build`, then check the step's checkpoint in `SPEC.md`.
- Mobile first. Check every trader screen at 360px wide.
- Keep user-facing text short and plain. All UI strings live in `lib/strings.ts`, so Sesotho can be added later.
- When something in `SPEC.md` is unclear or conflicts with these rules, stop and ask rather than guessing.
- Whenever you build or decide anything `SPEC.md` doesn't cover (extra files, judgement calls, changes from the plan), record it in `SPEC.md` in the same step: update the section it belongs to, and add it to section 14, "Decisions made during the build". Commit the spec change with the step.