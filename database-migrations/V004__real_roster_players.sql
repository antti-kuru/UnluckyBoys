alter table players
  add column if not exists nickname text,
  add column if not exists nationality text,
  add column if not exists captain boolean not null default false,
  add column if not exists alternate_captain boolean not null default false;

update players
set
  slug = 'antti-kuru',
  name = 'Antti Kuru',
  nickname = 'Anhel_Kuru',
  position = 'RD',
  jersey_number = 17,
  nationality = 'FIN',
  captain = true,
  alternate_captain = false,
  image_url = '/brand/kuru.png',
  bio = 'Captain of Unlucky Boys and a right defenseman for Burgernation.',
  active = true,
  roster_order = 1,
  updated_at = now()
where slug = 'anhel-kuru';

insert into players (
  slug,
  name,
  nickname,
  position,
  jersey_number,
  nationality,
  captain,
  alternate_captain,
  image_url,
  bio,
  active,
  roster_order,
  sportsgamer_url
) values (
  'joona-muona',
  'Joona Muona',
  'jm98II',
  'LW',
  29,
  'FIN',
  false,
  true,
  '/brand/jm98.png',
  'Alternate captain of Unlucky Boys and a left wing for Burgernation.',
  true,
  2,
  null
)
on conflict (slug) do update set
  name = excluded.name,
  nickname = excluded.nickname,
  position = excluded.position,
  jersey_number = excluded.jersey_number,
  nationality = excluded.nationality,
  captain = excluded.captain,
  alternate_captain = excluded.alternate_captain,
  image_url = excluded.image_url,
  bio = excluded.bio,
  active = excluded.active,
  roster_order = excluded.roster_order,
  updated_at = now();

update players
set active = false, updated_at = now()
where slug in ('ub-captain', 'ub-goalie');
