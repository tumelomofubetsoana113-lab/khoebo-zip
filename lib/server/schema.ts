// The accounts database (added 19 Nov 2026). Only accounts live here: a
// trader's sales, purchases and returns still stay in their browser.
//
// The tables sit in their own "khoebo" schema, not "public", so Supabase's
// automatic REST API can't reach them, and row level security is switched on
// with no policies as a second lock. The app connects as the database owner,
// which row level security doesn't restrict.
//
// Every statement can run again safely, so the app runs this on start-up.
// No imports, so scripts/create-officer.mts can use this file directly.

export const SCHEMA_SQL = `
create schema if not exists khoebo;
revoke all on schema khoebo from public;

create table if not exists khoebo.users (
  id uuid primary key,
  username text not null unique,
  full_name text not null,
  role text not null check (role in ('trader', 'officer')),
  password_hash text not null,
  failed_logins integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists khoebo.businesses (
  user_id uuid not null references khoebo.users (id) on delete cascade,
  position smallint not null,
  business_id text not null unique,
  primary key (user_id, position)
);

create table if not exists khoebo.sessions (
  token_hash text primary key,
  user_id uuid not null references khoebo.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on khoebo.sessions (user_id);

create table if not exists khoebo.rate_events (
  bucket text not null,
  key_hash text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_idx on khoebo.rate_events (bucket, key_hash, at);

alter table khoebo.users enable row level security;
alter table khoebo.businesses enable row level security;
alter table khoebo.sessions enable row level security;
alter table khoebo.rate_events enable row level security;
`;
