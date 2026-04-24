-- LCK Edge MVP seed data
-- Safe to re-run: every insert uses ON CONFLICT DO NOTHING.
-- Run AFTER schema.sql in the Supabase SQL Editor.
-- =====================================================================

-- ---------- current patch ----------
insert into patches (version, released_on)
values ('16.6', date '2026-04-01')
on conflict (version) do nothing;

-- ---------- teams (current LCK roster snapshot) ----------
insert into teams (name, tag, region, leaguepedia_slug) values
  ('Gen.G',          'GEN', 'LCK', 'Gen.G'),
  ('T1',             'T1',  'LCK', 'T1'),
  ('Hanwha Life Esports', 'HLE', 'LCK', 'Hanwha_Life_Esports'),
  ('KT Rolster',     'KT',  'LCK', 'KT_Rolster'),
  ('Dplus KIA',      'DK',  'LCK', 'Dplus_KIA'),
  ('DRX',            'DRX', 'LCK', 'DRX'),
  ('Nongshim RedForce','NS','LCK', 'Nongshim_RedForce'),
  ('FearX',          'FOX', 'LCK', 'FearX'),
  ('BNK FearX',      'BNK', 'LCK', 'BNK_FearX'),
  ('OKSavingsBank BRION','BRO','LCK','OKSavingsBank_Brion')
on conflict (name) do nothing;

-- ---------- a handful of star players so player cards have data ----------
-- Illustrative only; rosters change. Re-seed as needed.
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Chovy','MID', t.id, 'Chovy', 'Jeong Ji-hoon' from teams t where t.tag='GEN'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Canyon','JNG', t.id, 'Canyon', 'Kim Geon-bu' from teams t where t.tag='GEN'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Peyz','ADC', t.id, 'Peyz', 'Kim Su-hwan' from teams t where t.tag='GEN'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Kiin','TOP', t.id, 'Kiin', 'Kim Gi-in' from teams t where t.tag='GEN'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Duro','SUP', t.id, 'Duro', 'Joo Min-kyu' from teams t where t.tag='GEN'
  on conflict (ign, team_id) do nothing;

insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Faker','MID', t.id, 'Faker', 'Lee Sang-hyeok' from teams t where t.tag='T1'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Oner','JNG', t.id, 'Oner', 'Mun Hyeon-jun' from teams t where t.tag='T1'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Gumayusi','ADC', t.id, 'Gumayusi', 'Lee Min-hyeong' from teams t where t.tag='T1'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Doran','TOP', t.id, 'Doran', 'Choi Hyeon-jun' from teams t where t.tag='T1'
  on conflict (ign, team_id) do nothing;
insert into players (ign, role, team_id, leaguepedia_slug, real_name)
select 'Keria','SUP', t.id, 'Keria', 'Ryu Min-seok' from teams t where t.tag='T1'
  on conflict (ign, team_id) do nothing;

-- ---------- one upcoming sample match so the UI has something to render ----------
insert into matches (start_at, status, best_of, team_a_id, team_b_id, patch_id, split)
select
  now() + interval '2 days',
  'scheduled',
  3,
  a.id,
  b.id,
  p.id,
  'LCK 2026 Spring'
from teams a, teams b, patches p
where a.tag = 'GEN' and b.tag = 'T1' and p.version = '16.6'
and not exists (
  select 1 from matches m
  where m.team_a_id = a.id and m.team_b_id = b.id and m.start_at > now()
);

-- ---------- one finished match for recent-form data ----------
insert into matches (start_at, status, best_of, team_a_id, team_b_id, winner_team_id, patch_id, split)
select
  now() - interval '3 days',
  'completed',
  3,
  a.id,
  b.id,
  a.id,      -- team A wins the sample
  p.id,
  'LCK 2026 Spring'
from teams a, teams b, patches p
where a.tag = 'HLE' and b.tag = 'DK' and p.version = '16.6'
and not exists (
  select 1 from matches m
  where m.team_a_id = a.id and m.team_b_id = b.id and m.start_at < now() and m.status='completed'
);
