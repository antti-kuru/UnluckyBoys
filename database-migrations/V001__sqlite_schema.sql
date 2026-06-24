create table admins (
  id text primary key default (lower(hex(randomblob(16)))),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table sessions (
  id text primary key,
  admin_id text not null references admins(id) on delete cascade,
  expires_at text not null,
  created_at text not null default (datetime('now'))
);

create table news (
  id text primary key default (lower(hex(randomblob(16)))),
  slug text not null unique,
  title text not null,
  summary text not null,
  body text not null,
  cover_image_url text not null default '/brand/banner.png',
  published_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table players (
  id text primary key default (lower(hex(randomblob(16)))),
  slug text not null unique,
  name text not null,
  nickname text,
  position text not null,
  jersey_number integer not null check (jersey_number between 0 and 99),
  nationality text,
  handedness text,
  captain integer not null default 0,
  alternate_captain integer not null default 0,
  image_url text,
  bio text not null default '',
  active integer not null default 1,
  roster_order integer not null default 0,
  sportsgamer_url text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table player_aliases (
  id text primary key default (lower(hex(randomblob(16)))),
  player_id text not null references players(id) on delete cascade,
  alias text not null,
  source text not null default 'manual',
  unique (player_id, alias)
);

create table achievements (
  id text primary key default (lower(hex(randomblob(16)))),
  title text not null,
  body text not null,
  display_order integer not null default 0,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table sportsgamer_sources (
  id text primary key default (lower(hex(randomblob(16)))),
  source_type text not null,
  source_url text not null unique,
  last_synced_at text,
  created_at text not null default (datetime('now'))
);

create table player_season_stats (
  id text primary key default (lower(hex(randomblob(16)))),
  player_id text not null references players(id) on delete cascade,
  league text not null,
  team_name text not null,
  games_played integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  points integer not null default 0,
  plus_minus integer not null default 0,
  penalty_minutes integer not null default 0,
  powerplay_goals integer not null default 0,
  shorthanded_goals integer not null default 0,
  game_winning_goals integer not null default 0,
  shots integer not null default 0,
  shooting_percentage real,
  hits integer not null default 0,
  faceoff_win_percentage real,
  created_at text not null default (datetime('now'))
);

create table goalie_season_stats (
  id text primary key default (lower(hex(randomblob(16)))),
  player_id text not null references players(id) on delete cascade,
  league text not null,
  team_name text not null,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  overtime_losses integer not null default 0,
  saves integer not null default 0,
  goals_against integer not null default 0,
  save_percentage real,
  goals_against_average real,
  shutouts integer not null default 0,
  penalty_minutes integer not null default 0,
  created_at text not null default (datetime('now'))
);

create table sportsgamer_player_stat_snapshots (
  player_id text primary key references players(id) on delete cascade,
  source_url text not null,
  stats text not null,
  synced_at text not null default (datetime('now'))
);

create table upcoming_games (
  id text primary key default (lower(hex(randomblob(16)))),
  opponent text not null,
  competition text not null,
  starts_at text not null,
  sportsgamer_url text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table sync_runs (
  id text primary key default (lower(hex(randomblob(16)))),
  source text not null,
  status text not null check (status in ('success', 'failed')),
  message text not null,
  created_at text not null default (datetime('now'))
);

create index news_published_at_idx on news (published_at desc);
create index players_active_order_idx on players (active, roster_order, name);
create index player_season_stats_player_idx on player_season_stats (player_id);
create index goalie_season_stats_player_idx on goalie_season_stats (player_id);
create index upcoming_games_starts_at_idx on upcoming_games (starts_at);
create index sessions_expires_at_idx on sessions (expires_at);
