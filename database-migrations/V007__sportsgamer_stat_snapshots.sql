create table if not exists sportsgamer_player_stat_snapshots (
  player_id uuid primary key references players(id) on delete cascade,
  source_url text not null,
  stats jsonb not null,
  synced_at timestamptz not null default now()
);
