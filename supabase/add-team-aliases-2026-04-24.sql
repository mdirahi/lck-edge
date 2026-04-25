-- ---------------------------------------------------------------------------
-- Team alias names — used to map external odds-provider team names to our
-- canonical teams.id rows. Stored as lowercased text[] so we can match with a
-- single ANY() lookup. Re-runnable; updates aliases on each run.
-- ---------------------------------------------------------------------------

alter table teams
  add column if not exists alias_names text[] not null default '{}';

create index if not exists teams_alias_names_idx on teams using gin (alias_names);

-- Seed common spellings + abbreviations seen on The Odds API and other books.
-- Keep entries lowercase (we normalize on the read side too).
update teams set alias_names = array[
  'gen.g','geng','gen g','gen.g esports','gen g esports'
] where tag = 'GEN';

update teams set alias_names = array[
  't1','t1 esports','sk telecom t1','skt','skt t1'
] where tag = 'T1';

update teams set alias_names = array[
  'hanwha life esports','hanwha life','hle','hanwha'
] where tag = 'HLE';

update teams set alias_names = array[
  'kt rolster','kt','ktr','kt rolster esports'
] where tag = 'KT';

update teams set alias_names = array[
  'dplus kia','dplus','dk','damwon kia','damwon gaming','damwon','dwg kia','dwg'
] where tag = 'DK';

update teams set alias_names = array[
  'drx','dragon x'
] where tag = 'DRX';

update teams set alias_names = array[
  'nongshim redforce','nongshim','ns redforce','ns','team dynamics'
] where tag = 'NS';

update teams set alias_names = array[
  'fearx','fear x','fox','liiv sandbox','sandbox gaming'
] where tag = 'FOX';

update teams set alias_names = array[
  'bnk fearx','bnk fear x','bnk','bnk gaming'
] where tag = 'BNK';

update teams set alias_names = array[
  'oksavingsbank brion','ok brion','brion','bro','kwangdong freecs','kdf'
] where tag = 'BRO';
