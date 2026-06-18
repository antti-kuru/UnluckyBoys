update players
set name = 'Ilmari Töyrylä',
    updated_at = now()
where slug = 'ilmari-toyryla';

update players
set name = 'Aleksi Kähkönen',
    bio = replace(bio, 'Kankaanpaa', 'Kankaanpää'),
    updated_at = now()
where slug = 'aleksi-kahkonen';

update players
set bio = replace(bio, 'Kankaanpaa', 'Kankaanpää'),
    updated_at = now()
where slug = 'janne-viitanen';
