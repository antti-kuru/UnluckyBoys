alter table player_season_stats
  add column if not exists powerplay_goals integer not null default 0,
  add column if not exists shorthanded_goals integer not null default 0,
  add column if not exists game_winning_goals integer not null default 0,
  add column if not exists shots integer not null default 0,
  add column if not exists shooting_percentage numeric(5, 2),
  add column if not exists hits integer not null default 0,
  add column if not exists faceoff_win_percentage numeric(5, 2);

update players
set sportsgamer_url = 'https://sportsgamer.gg/players/967',
    updated_at = now()
where slug = 'antti-kuru'
  and (sportsgamer_url is null or sportsgamer_url = '');
