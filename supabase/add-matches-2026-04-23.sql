-- Tomorrow's LCK matches (April 23, 2026 KST)
-- Re-runnable: every insert checks for existing rows first.

-- 1. Add DN Freecs (tag DNS) — not in the initial seed.
--    If the real team name is different, edit the name after running.
insert into teams (name, tag, region, leaguepedia_slug)
values ('DN Freecs', 'DNS', 'LCK', 'DN_Freecs')
on conflict (name) do nothing;

-- 2. BRO vs DK at April 23, 04:00 KST (= April 22, 19:00 UTC)
insert into matches (start_at, status, best_of, team_a_id, team_b_id, patch_id, split)
select
  timestamp with time zone '2026-04-22 19:00:00+00',
  'scheduled', 3,
  a.id, b.id, p.id, 'LCK 2026 Spring'
from teams a, teams b, patches p
where a.tag = 'BRO' and b.tag = 'DK' and p.version = '16.6'
  and not exists (
    select 1 from matches m
    where m.team_a_id = a.id and m.team_b_id = b.id
      and m.start_at = timestamp with time zone '2026-04-22 19:00:00+00'
  );

-- 3. GEN vs DNS at April 23, 06:00 KST (= April 22, 21:00 UTC)
insert into matches (start_at, status, best_of, team_a_id, team_b_id, patch_id, split)
select
  timestamp with time zone '2026-04-22 21:00:00+00',
  'scheduled', 3,
  a.id, b.id, p.id, 'LCK 2026 Spring'
from teams a, teams b, patches p
where a.tag = 'GEN' and b.tag = 'DNS' and p.version = '16.6'
  and not exists (
    select 1 from matches m
    where m.team_a_id = a.id and m.team_b_id = b.id
      and m.start_at = timestamp with time zone '2026-04-22 21:00:00+00'
  );
