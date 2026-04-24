-- Add the 28 champions that were missing from the original seed but appeared in
-- real 2026 LCK drafts. Run once in Supabase SQL editor. Safe to re-run.

insert into champions (key, display_name, primary_role) values
  ('ambessa',     'Ambessa',     'TOP'),
  ('anivia',      'Anivia',      'MID'),
  ('annie',       'Annie',       'MID'),
  ('aurora',      'Aurora',      'MID'),
  ('cassiopeia',  'Cassiopeia',  'MID'),
  ('elise',       'Elise',       'JNG'),
  ('gwen',        'Gwen',        'TOP'),
  ('jayce',       'Jayce',       'TOP'),
  ('khazix',      'Kha''Zix',    'JNG'),
  ('mel',         'Mel',         'MID'),
  ('naafiri',     'Naafiri',     'MID'),
  ('neeko',       'Neeko',       'MID'),
  ('pantheon',    'Pantheon',    'SUP'),
  ('poppy',       'Poppy',       'TOP'),
  ('pyke',        'Pyke',        'SUP'),
  ('senna',       'Senna',       'SUP'),
  ('seraphine',   'Seraphine',   'SUP'),
  ('sivir',       'Sivir',       'ADC'),
  ('skarner',     'Skarner',     'JNG'),
  ('syndra',      'Syndra',      'MID'),
  ('vayne',       'Vayne',       'ADC'),
  ('wukong',      'Wukong',      'JNG'),
  ('yorick',      'Yorick',      'TOP'),
  ('yunara',      'Yunara',      'ADC'),
  ('yuumi',       'Yuumi',       'SUP'),
  ('zaahen',      'Zaahen',      'MID'),
  ('ziggs',       'Ziggs',       'ADC'),
  ('zoe',         'Zoe',         'MID')
on conflict (key) do nothing;
