-- LCK Edge: Draft schema + champion seed (Step 5a)
-- Paste into Supabase SQL editor and run once.
--
-- NOTE: this drops the `champions` and `drafts` tables from the original
-- schema.sql. Those were scaffolded with a different (game-scoped) shape and
-- were never populated. The app uses a match-scoped draft model with a
-- separate draft_slots table, so we replace them cleanly. Safe to re-run.

drop table if exists draft_slots cascade;
drop table if exists drafts cascade;
drop table if exists champions cascade;

-- ---------- Tables ----------

create table champions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  display_name text not null,
  primary_role text check (primary_role in ('TOP','JNG','MID','ADC','SUP'))
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id) on delete cascade,
  blue_team_id uuid references teams(id),
  red_team_id uuid references teams(id),
  source text default 'manual',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table draft_slots (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references drafts(id) on delete cascade,
  side text not null check (side in ('blue','red')),
  slot_type text not null check (slot_type in ('pick','ban')),
  slot_index int not null check (slot_index between 0 and 4),
  role text check (role in ('TOP','JNG','MID','ADC','SUP')),
  champion_id uuid references champions(id),
  unique (draft_id, side, slot_type, slot_index)
);

create index draft_slots_draft_idx on draft_slots(draft_id);
create index drafts_match_idx on drafts(match_id);

-- ---------- RLS ----------

alter table champions enable row level security;
alter table drafts enable row level security;
alter table draft_slots enable row level security;

drop policy if exists "read all champions" on champions;
create policy "read all champions" on champions for select using (true);

drop policy if exists "read all drafts" on drafts;
create policy "read all drafts" on drafts for select using (true);

drop policy if exists "read all draft slots" on draft_slots;
create policy "read all draft slots" on draft_slots for select using (true);

-- ---------- Champion seed (~65 common LCK picks) ----------

insert into champions (key, display_name, primary_role) values
  ('aatrox',        'Aatrox',        'TOP'),
  ('camille',       'Camille',       'TOP'),
  ('gnar',          'Gnar',          'TOP'),
  ('gragas',        'Gragas',        'TOP'),
  ('jax',           'Jax',           'TOP'),
  ('ksante',        'K''Sante',      'TOP'),
  ('kennen',        'Kennen',        'TOP'),
  ('nasus',         'Nasus',         'TOP'),
  ('ornn',          'Ornn',          'TOP'),
  ('renekton',      'Renekton',      'TOP'),
  ('rumble',        'Rumble',        'TOP'),
  ('sion',          'Sion',          'TOP'),
  ('volibear',      'Volibear',      'TOP'),
  ('graves',        'Graves',        'JNG'),
  ('ivern',         'Ivern',         'JNG'),
  ('jarvan_iv',     'Jarvan IV',     'JNG'),
  ('kindred',       'Kindred',       'JNG'),
  ('lee_sin',       'Lee Sin',       'JNG'),
  ('maokai',        'Maokai',        'JNG'),
  ('nocturne',      'Nocturne',      'JNG'),
  ('sejuani',       'Sejuani',       'JNG'),
  ('vi',            'Vi',            'JNG'),
  ('viego',         'Viego',         'JNG'),
  ('xin_zhao',      'Xin Zhao',      'JNG'),
  ('zac',           'Zac',           'JNG'),
  ('ahri',          'Ahri',          'MID'),
  ('akali',         'Akali',         'MID'),
  ('azir',          'Azir',          'MID'),
  ('corki',         'Corki',         'MID'),
  ('irelia',        'Irelia',        'MID'),
  ('leblanc',       'LeBlanc',       'MID'),
  ('lissandra',     'Lissandra',     'MID'),
  ('orianna',       'Orianna',       'MID'),
  ('ryze',          'Ryze',          'MID'),
  ('sylas',         'Sylas',         'MID'),
  ('taliyah',       'Taliyah',       'MID'),
  ('twisted_fate',  'Twisted Fate',  'MID'),
  ('viktor',        'Viktor',        'MID'),
  ('yasuo',         'Yasuo',         'MID'),
  ('yone',          'Yone',          'MID'),
  ('aphelios',      'Aphelios',      'ADC'),
  ('ashe',          'Ashe',          'ADC'),
  ('caitlyn',       'Caitlyn',       'ADC'),
  ('ezreal',        'Ezreal',        'ADC'),
  ('jhin',          'Jhin',          'ADC'),
  ('jinx',          'Jinx',          'ADC'),
  ('kaisa',         'Kai''Sa',       'ADC'),
  ('kalista',       'Kalista',       'ADC'),
  ('lucian',        'Lucian',        'ADC'),
  ('miss_fortune',  'Miss Fortune',  'ADC'),
  ('varus',         'Varus',         'ADC'),
  ('xayah',         'Xayah',         'ADC'),
  ('zeri',          'Zeri',          'ADC'),
  ('alistar',       'Alistar',       'SUP'),
  ('bard',          'Bard',          'SUP'),
  ('braum',         'Braum',         'SUP'),
  ('karma',         'Karma',         'SUP'),
  ('leona',         'Leona',         'SUP'),
  ('lulu',          'Lulu',          'SUP'),
  ('nami',          'Nami',          'SUP'),
  ('nautilus',      'Nautilus',      'SUP'),
  ('rakan',         'Rakan',         'SUP'),
  ('rell',          'Rell',          'SUP'),
  ('renata_glasc',  'Renata Glasc',  'SUP'),
  ('tahm_kench',    'Tahm Kench',    'SUP'),
  ('thresh',        'Thresh',        'SUP')
on conflict (key) do nothing;
