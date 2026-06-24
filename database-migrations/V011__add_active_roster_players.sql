alter table players
  add column if not exists handedness text;

insert into players (
  slug,
  name,
  nickname,
  position,
  jersey_number,
  nationality,
  handedness,
  captain,
  alternate_captain,
  image_url,
  bio,
  active,
  roster_order,
  sportsgamer_url
) values
  (
    'miikkael-henriksson',
    'Miikkael Henriksson',
    'MCH_98',
    'LD',
    15,
    'FIN',
    'Right',
    false,
    false,
    '/brand/mch98.png',
    'MCH made his UB debut with the team UB All Stars in FCL 2025 - 6v6 🇫🇮 - Regular season, playing in total 6 games for the burger jersey. Not everyone can play their first games for the club in the All Stars lineup.',
    true,
    3,
    'https://sportsgamer.gg/players/1168'
  ),
  (
    'william-sall',
    'William Säll',
    'sallee42',
    'G',
    35,
    'SWE',
    'Left',
    false,
    false,
    '/brand/sallee42.png',
    'Salle will continue the great legacy of Swedish goaltending for the Unlucky Boys. Salle is an extremely potential young goalie who made his Elite debut in ECL ''26: Spring - Elite with FOCUS.',
    true,
    4,
    'https://sportsgamer.gg/players/12498'
  )
on conflict (slug) do update set
  name = excluded.name,
  nickname = excluded.nickname,
  position = excluded.position,
  jersey_number = excluded.jersey_number,
  nationality = excluded.nationality,
  handedness = excluded.handedness,
  captain = excluded.captain,
  alternate_captain = excluded.alternate_captain,
  image_url = excluded.image_url,
  bio = excluded.bio,
  active = excluded.active,
  roster_order = excluded.roster_order,
  sportsgamer_url = excluded.sportsgamer_url,
  updated_at = now();
