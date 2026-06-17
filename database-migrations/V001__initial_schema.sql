create extension if not exists pgcrypto;

create table admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key,
  admin_id uuid not null references admins(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  body text not null,
  cover_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  position text not null,
  jersey_number integer not null check (jersey_number between 0 and 99),
  image_url text,
  bio text not null default '',
  active boolean not null default true,
  roster_order integer not null default 0,
  sportsgamer_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  alias text not null,
  source text not null default 'manual',
  unique (player_id, alias)
);

create table achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sportsgamer_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_url text not null unique,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table player_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  league text not null,
  team_name text not null,
  games_played integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  points integer not null default 0,
  plus_minus integer not null default 0,
  penalty_minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create table goalie_season_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  league text not null,
  team_name text not null,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  overtime_losses integer not null default 0,
  saves integer not null default 0,
  goals_against integer not null default 0,
  save_percentage numeric(5, 2),
  goals_against_average numeric(5, 2),
  shutouts integer not null default 0,
  penalty_minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create table upcoming_games (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  competition text not null,
  starts_at timestamptz not null,
  sportsgamer_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null check (status in ('success', 'failed')),
  message text not null,
  created_at timestamptz not null default now()
);

create index news_published_at_idx on news (published_at desc);
create index players_active_order_idx on players (active, roster_order, name);
create index player_season_stats_player_idx on player_season_stats (player_id);
create index goalie_season_stats_player_idx on goalie_season_stats (player_id);
create index upcoming_games_starts_at_idx on upcoming_games (starts_at);
create index sessions_expires_at_idx on sessions (expires_at);
