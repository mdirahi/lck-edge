-- LCK Edge MVP schema
-- Run this once in Supabase SQL Editor.
-- Re-runs are safe: everything is CREATE IF NOT EXISTS or idempotent.
-- =====================================================================

-- UUID helpers
create extension if not exists "pgcrypto";

-- ---------- teams ----------
create table if not exists teams (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  tag              text not null unique,
  region           text not null default 'LCK',
  logo_url         text,
  leaguepedia_slug text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- players ----------
create table if not exists players (
  id               uuid primary key default gen_random_uuid(),
  ign              text not null,
  real_name        text,
  role             text not null check (role in ('TOP','JNG','MID','ADC','SUP')),
  team_id          uuid references teams(id) on delete set null,
  leaguepedia_slug text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (ign, team_id)
);

-- ---------- champions ----------
create table if not exists champions (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,        -- Data Dragon key, e.g. "Ahri"
  name            text not null,
  role_primary    text,
  tags            text[],
  created_at      timestamptz not null default now()
);

-- ---------- patches ----------
create table if not exists patches (
  id           uuid primary key default gen_random_uuid(),
  version      text not null unique,           -- e.g. "16.6"
  released_on  date not null,
  notes_url    text,
  created_at   timestamptz not null default now()
);

-- ---------- matches ----------
create table if not exists matches (
  id              uuid primary key default gen_random_uuid(),
  start_at        timestamptz not null,
  status          text not null default 'scheduled' check (status in ('scheduled','live','completed')),
  best_of         int  not null default 3 check (best_of in (1,3,5)),
  team_a_id       uuid not null references teams(id),
  team_b_id       uuid not null references teams(id),
  winner_team_id  uuid references teams(id),
  patch_id        uuid references patches(id),
  split           text not null default 'LCK 2026 Spring',
  external_ids    jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint teams_differ check (team_a_id <> team_b_id)
);

create index if not exists matches_start_at_idx on matches (start_at desc);
create index if not exists matches_status_idx   on matches (status);

-- ---------- games (one match contains up to 5 games) ----------
create table if not exists games (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  game_index        int  not null,
  duration_seconds  int,
  blue_team_id      uuid references teams(id),
  red_team_id       uuid references teams(id),
  winner_team_id    uuid references teams(id),
  created_at        timestamptz not null default now(),
  unique (match_id, game_index)
);

-- ---------- drafts ----------
create table if not exists drafts (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  team_id    uuid not null references teams(id),
  side       text not null check (side in ('blue','red')),
  bans       text[] not null default '{}',
  pick_top   text,
  pick_jng   text,
  pick_mid   text,
  pick_adc   text,
  pick_sup   text,
  created_at timestamptz not null default now(),
  unique (game_id, team_id)
);

-- ---------- per-player per-game stats ----------
create table if not exists player_game_stats (
  id                        uuid primary key default gen_random_uuid(),
  player_id                 uuid not null references players(id) on delete cascade,
  game_id                   uuid not null references games(id) on delete cascade,
  champion_key              text,
  kills                     int,
  deaths                    int,
  assists                   int,
  cs                        int,
  cs_per_min                numeric(6,2),
  damage_to_champs          int,
  damage_share_pct          numeric(5,2),
  gold_earned               int,
  gold_share_pct            numeric(5,2),
  vision_score              numeric(6,1),
  kill_participation_pct    numeric(5,2),
  first_blood               boolean,
  created_at                timestamptz not null default now(),
  unique (player_id, game_id)
);

-- ---------- per-team per-game stats ----------
create table if not exists team_game_stats (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references teams(id),
  game_id           uuid not null references games(id) on delete cascade,
  side              text not null check (side in ('blue','red')),
  drakes            int,
  heralds           int,
  barons            int,
  towers            int,
  first_blood       boolean,
  first_tower       boolean,
  gold_at_15        int,
  gold_diff_at_15   int,
  created_at        timestamptz not null default now(),
  unique (team_id, game_id)
);

-- ---------- odds snapshots (manual + any future automated input) ----------
create table if not exists odds_snapshots (
  id                     uuid primary key default gen_random_uuid(),
  match_id               uuid not null references matches(id) on delete cascade,
  source                 text not null default 'manual',   -- e.g. 'manual','kalshi','polymarket','rainbet_manual'
  captured_at            timestamptz not null default now(),
  format                 text not null check (format in ('decimal','american','implied_prob')),
  team_a_price           numeric not null,
  team_b_price           numeric not null,
  team_a_implied_prob    numeric(6,4) not null,   -- 0..1
  team_b_implied_prob    numeric(6,4) not null,
  novig_a                numeric(6,4) not null,
  novig_b                numeric(6,4) not null,
  raw                    jsonb not null default '{}'::jsonb
);

create index if not exists odds_match_time_idx on odds_snapshots (match_id, captured_at desc);

-- ---------- predictions ----------
create table if not exists predictions (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  model_version     text not null default 'v0.1',
  team_a_score      numeric(6,2) not null,     -- 0..100
  team_b_score      numeric(6,2) not null,
  team_a_prob       numeric(6,4) not null,     -- 0..1 model-only
  final_prob_a      numeric(6,4),              -- 0..1 confidence-adjusted with market
  confidence        text not null check (confidence in ('low','medium','high')),
  lean              text not null check (lean in ('team_a','team_b','pass')),
  recommendation    text not null check (recommendation in ('play','watch','avoid')),
  market_delta      numeric(6,4),              -- model_prob_a - novig_a
  reasons           text[] not null default '{}',
  risks             text[] not null default '{}',
  odds_snapshot_id  uuid references odds_snapshots(id),
  created_at        timestamptz not null default now()
);

create index if not exists predictions_match_idx on predictions (match_id, created_at desc);

-- ---------- prediction factors (one row per factor per prediction) ----------
create table if not exists prediction_factors (
  id             uuid primary key default gen_random_uuid(),
  prediction_id  uuid not null references predictions(id) on delete cascade,
  factor_key     text not null,               -- e.g. 'recent_form'
  weight         numeric(4,3) not null,       -- e.g. 0.200
  team_a_value   numeric,                      -- raw value (anything)
  team_b_value   numeric,
  team_a_score   numeric(5,2) not null,       -- normalized 0..100
  team_b_score   numeric(5,2) not null,
  note           text
);

create index if not exists prediction_factors_pred_idx on prediction_factors (prediction_id);

-- ---------- draft uploads (future feature; table ready now) ----------
create table if not exists draft_uploads (
  id                uuid primary key default gen_random_uuid(),
  image_path        text not null,
  match_id          uuid references matches(id),
  parsed_blue       jsonb,
  parsed_red        jsonb,
  players_detected  jsonb,
  draft_score_a     numeric(5,2),
  draft_score_b     numeric(5,2),
  notes             text,
  created_at        timestamptz not null default now()
);

-- ---------- auto-touch updated_at ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists t_teams_updated   on teams;
create trigger t_teams_updated   before update on teams   for each row execute function touch_updated_at();

drop trigger if exists t_players_updated on players;
create trigger t_players_updated before update on players for each row execute function touch_updated_at();

drop trigger if exists t_matches_updated on matches;
create trigger t_matches_updated before update on matches for each row execute function touch_updated_at();

-- =====================================================================
-- Row-Level Security (optional, but good default even for a solo project)
-- Anon can read public tables. Writes are done from server-side code
-- using the service_role key (which bypasses RLS).
-- =====================================================================
alter table teams               enable row level security;
alter table players             enable row level security;
alter table champions           enable row level security;
alter table patches             enable row level security;
alter table matches             enable row level security;
alter table games               enable row level security;
alter table drafts              enable row level security;
alter table player_game_stats   enable row level security;
alter table team_game_stats     enable row level security;
alter table odds_snapshots      enable row level security;
alter table predictions         enable row level security;
alter table prediction_factors  enable row level security;
alter table draft_uploads       enable row level security;

-- Public read for display
do $$ begin
  if not exists (select 1 from pg_policies where tablename='teams' and policyname='read_all') then
    create policy read_all on teams              for select using (true);
    create policy read_all on players            for select using (true);
    create policy read_all on champions          for select using (true);
    create policy read_all on patches            for select using (true);
    create policy read_all on matches            for select using (true);
    create policy read_all on games              for select using (true);
    create policy read_all on drafts             for select using (true);
    create policy read_all on player_game_stats  for select using (true);
    create policy read_all on team_game_stats    for select using (true);
    create policy read_all on odds_snapshots     for select using (true);
    create policy read_all on predictions        for select using (true);
    create policy read_all on prediction_factors for select using (true);
    create policy read_all on draft_uploads      for select using (true);
  end if;
end $$;
