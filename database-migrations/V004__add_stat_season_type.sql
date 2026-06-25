alter table player_season_stats add column season_type text not null default 'regular';
alter table goalie_season_stats add column season_type text not null default 'regular';
