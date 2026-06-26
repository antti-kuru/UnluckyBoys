insert into players (
  slug, name, nickname, position, jersey_number, nationality, handedness, captain, alternate_captain,
  image_url, bio, active, roster_order, sportsgamer_url
) values (
  'j-arjalainen',
  'J Arjalainen',
  'Arjalainen',
  'RD',
  88,
  'FIN',
  'Left',
  0,
  0,
  '/brand/arjalainen.png',
  'Arjalainen brought a steady left-handed presence to the Unlucky Boys blue line and earned his place among the names remembered in the burger jersey.',
  0,
  12,
  null
)
on conflict (slug) do update set
  name = excluded.name,
  nickname = excluded.nickname,
  position = excluded.position,
  jersey_number = excluded.jersey_number,
  nationality = excluded.nationality,
  handedness = excluded.handedness,
  image_url = excluded.image_url,
  bio = excluded.bio,
  active = excluded.active,
  roster_order = excluded.roster_order,
  updated_at = datetime('now');

update players set roster_order = 13 where slug = 'julius-rissanen';
update players set roster_order = 14 where slug = 'jukka-salokoski';
update players set roster_order = 15 where slug = 'aki-frilander';
update players set roster_order = 16 where slug = 'tim-hess';
update players set roster_order = 17 where slug = 'eissi83';
update players set roster_order = 18 where slug = 'ville-poutiainen';
update players set roster_order = 19 where slug = 'ben-rinnet';
update players set roster_order = 20 where slug = 'aleksi-kahkonen';
update players set roster_order = 21 where slug = 'eemil-soikkeli';
update players set roster_order = 22 where slug = 'janne-viitanen';
