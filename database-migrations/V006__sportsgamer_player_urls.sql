update players
set sportsgamer_url = 'https://sportsgamer.gg/players/967',
    updated_at = now()
where slug = 'antti-kuru';

update players
set sportsgamer_url = 'https://sportsgamer.gg/players/1335',
    updated_at = now()
where slug = 'joona-muona';

delete from player_season_stats using players
where player_season_stats.player_id = players.id
  and players.slug in ('antti-kuru', 'joona-muona')
  and player_season_stats.league = 'Sample Season';
