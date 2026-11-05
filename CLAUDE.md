# Khoebo

Khoebo is a prototype for the Revenue Services Lesotho (RSL) Taxathon 2026, Challenge 1: informal sector compliance. It has two sides:

- A phone-sized chat assistant that helps informal traders keep sales records and file returns.
- An officer worklist that sorts traders into four follow-up actions, with the reasons written out.

The full plan is in `SPEC.md`. Read it before starting any task, and build in the order set out in its "Build order" section. Don't skip ahead.

Submission deadline: 6 November 2026. Live address to submit: https://khoebo-r8lc.vercel.app (also served at khoebo.newempireai.online).

## Stack

Next.js (App Router) with TypeScript, Tailwind CSS, the Anthropic TypeScript SDK (`@anthropic-ai/sdk`) with tool use, `lucide-react` for icons, and Vitest for tests. It's hosted on Vercel, with DNS on Cloudflare. There is no database: trader records live in the browser's localStorage.

## Rules that must not be broken

1. **Claude never calculates anything.** The model reads messages and calls tools. All amounts, totals, profit and tax estimates come from the functions in `lib/ledger.ts` and `lib/tax.ts`. A reply may only show a number that a tool returned.
2. **The API key stays on the server.** `ANTHROPIC_API_KEY` is read only in `app/api/chat/route.ts`. It is never sent to the browser, logged or committed.
3. **No real trader data is stored.** No database, no analytics, and message content is never logged. Server logs may record counts and errors only.
4. **The officer side never sees hidden simulation columns.** Anything starting with `hidden_` exists for scoring only. The export script drops it before the app sees the data.
5. **It's a prototype, and it says so.** Every page shows the "Prototype for the RSL Taxathon 2026" label. Never use RSL's logo, WhatsApp's name or logo, or the mokorotlo emblem from the flag.
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
```

## Environment variables

| Name | Example | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (secret) | Set in Vercel only. Locally, in `.env.local`, which is git-ignored. |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Switch to `claude-sonnet-5-5` without code changes if needed. |
| `MAX_MESSAGES_PER_SESSION` | `60` | Caps spend on a public link. |

## Working style

- Small commits, one step of the build order at a time. After each step, run `npm run test` and `npm run build`, then check the step's checkpoint in `SPEC.md`.
- Mobile first. Check every trader screen at 360px wide.
- Keep user-facing text short and plain. All UI strings live in `lib/strings.ts`, so Sesotho can be added later.
- When something in `SPEC.md` is unclear or conflicts with these rules, stop and ask rather than guessing.
- Whenever you build or decide anything `SPEC.md` doesn't cover (extra files, judgement calls, changes from the plan), record it in `SPEC.md` in the same step: update the section it belongs to, and add it to section 14, "Decisions made during the build". Commit the spec change with the step.