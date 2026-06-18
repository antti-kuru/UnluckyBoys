import { Hono } from "hono";
import { cacheJson } from "../lib/redis.js";
import { redis } from "../lib/redis.js";
import { query } from "../lib/db.js";
import { notFound, parsePagination } from "../lib/http.js";
import { teamNames } from "../config.js";
import { fetchPlayerCareerStats, type GoalieSeason, type SkaterSeason } from "../integrations/sportsgamer.js";

export const publicRoutes = new Hono();

publicRoutes.get("/news", async (c) => {
  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"), { limit: 10, max: 50 });
  const result = await query(
    `select slug, title, summary, body, cover_image_url as "coverImageUrl", published_at as "publishedAt"
     from news
     where published_at is not null
     order by published_at desc
     limit $1 offset $2`,
    [limit, offset]
  );
  return c.json({ items: result.rows, limit, offset });
});

publicRoutes.get("/news/:slug", async (c) => {
  const result = await query(
    `select slug, title, summary, body, cover_image_url as "coverImageUrl", published_at as "publishedAt"
     from news where slug = $1 and published_at is not null`,
    [c.req.param("slug")]
  );
  if (!result.rows[0]) notFound("News article not found");
  return c.json(result.rows[0]);
});

publicRoutes.get("/roster", async (c) => {
  const result = await query(
    `select slug, name, nickname, position, jersey_number as "number", nationality,
            captain, alternate_captain as "alternateCaptain", image_url as "imageUrl"
     from players
     where active = true
     order by roster_order asc, name asc`
  );
  return c.json({ items: result.rows });
});

publicRoutes.get("/hall-of-fame", async (c) => {
  const result = await query(
    `select slug, name, nickname, position, jersey_number as "number", nationality,
            captain, alternate_captain as "alternateCaptain", image_url as "imageUrl"
     from players
     where active = false
     order by roster_order asc, name asc`
  );
  return c.json({ items: result.rows });
});

publicRoutes.get("/players/:slug", async (c) => {
  const result = await query(
    `select id, slug, name, nickname, position, jersey_number as "number", nationality,
            captain, alternate_captain as "alternateCaptain", image_url as "imageUrl",
            bio, sportsgamer_url as "sportsGamerUrl"
     from players where slug = $1`,
    [c.req.param("slug")]
  );
  if (!result.rows[0]) notFound("Player not found");
  return c.json(result.rows[0]);
});

publicRoutes.get("/players/:slug/stats", async (c) => {
  const slug = c.req.param("slug");
  const player = await query<{ id: string; sportsgamer_url: string | null }>(
    "select id, sportsgamer_url from players where slug = $1",
    [slug]
  );
  if (!player.rows[0]) notFound("Player not found");

  if (player.rows[0].sportsgamer_url) {
    const cachedLiveStats = await readSportsGamerStatsCache(slug);
    if (cachedLiveStats) return c.json(cachedLiveStats);

    try {
      const liveStats = await fetchPlayerCareerStats(player.rows[0].sportsgamer_url, null);
      const mappedLiveStats = {
        source: "sportsgamer",
        skater: liveStats.skater.map(mapSkaterSeason),
        goalie: liveStats.goalie.map(mapGoalieSeason)
      };
      await saveSportsGamerStatsSnapshot(player.rows[0].id, player.rows[0].sportsgamer_url, mappedLiveStats);
      await writeSportsGamerStatsCache(slug, mappedLiveStats);
      return c.json(mappedLiveStats);
    } catch (caught) {
      console.warn(`SportsGamer live stats failed for ${slug}`, caught);
    }

    const snapshot = await loadSportsGamerStatsSnapshot(player.rows[0].id);
    if (snapshot) return c.json(snapshot);
  }

  return c.json(await loadStoredPlayerStats(player.rows[0].id));
});

async function readSportsGamerStatsCache(slug: string) {
  try {
    if (redis.status === "wait") await redis.connect();
    const cached = await redis.get(`player-stats:${slug}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as { source?: string };
    return parsed.source === "sportsgamer" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeSportsGamerStatsCache(slug: string, stats: unknown) {
  try {
    if (redis.status === "wait") await redis.connect();
    await redis.set(`player-stats:${slug}`, JSON.stringify(stats), "EX", 300);
  } catch {
    // Stats still render without Redis; cache is only a speed-up.
  }
}

async function saveSportsGamerStatsSnapshot(playerId: string, sourceUrl: string, stats: unknown) {
  await query(
    `insert into sportsgamer_player_stat_snapshots (player_id, source_url, stats, synced_at)
     values ($1, $2, $3, now())
     on conflict (player_id) do update set
       source_url = excluded.source_url,
       stats = excluded.stats,
       synced_at = excluded.synced_at`,
    [playerId, sourceUrl, JSON.stringify(stats)]
  );
}

async function loadSportsGamerStatsSnapshot(playerId: string) {
  const result = await query<{ stats: unknown }>(
    "select stats from sportsgamer_player_stat_snapshots where player_id = $1",
    [playerId]
  );
  return result.rows[0]?.stats ?? null;
}

async function loadStoredPlayerStats(playerId: string) {
  const skater = await query(
    `select league, team_name as "teamName", games_played as "gamesPlayed", goals, assists, points,
            plus_minus as "plusMinus", penalty_minutes as "penaltyMinutes",
            powerplay_goals as "powerplayGoals", shorthanded_goals as "shorthandedGoals",
            game_winning_goals as "gameWinningGoals", shots, shooting_percentage as "shootingPercentage",
            hits, faceoff_win_percentage as "faceoffWinPercentage"
     from player_season_stats where player_id = $1 order by league desc`,
    [playerId]
  );
  const goalie = await query(
    `select league, team_name as "teamName", games_played as "gamesPlayed", wins, losses,
            overtime_losses as "overtimeLosses", saves, goals_against as "goalsAgainst",
            save_percentage as "savePercentage", goals_against_average as "goalsAgainstAverage",
            shutouts, penalty_minutes as "penaltyMinutes"
     from goalie_season_stats where player_id = $1 order by league desc`,
    [playerId]
  );
  return { source: "database", skater: skater.rows, goalie: goalie.rows };
}

function mapSkaterSeason(row: SkaterSeason) {
  return {
    league: row.league,
    teamName: row.team,
    gamesPlayed: row.gp,
    goals: row.goals,
    assists: row.assists,
    points: row.points,
    plusMinus: row.plusMinus,
    penaltyMinutes: row.pim,
    powerplayGoals: row.powerplayGoals,
    shorthandedGoals: row.shorthandedGoals,
    gameWinningGoals: row.gameWinningGoals,
    shots: row.shots,
    shootingPercentage: row.shootingPercentage,
    hits: row.hits,
    faceoffWinPercentage: row.faceoffWinPercentage
  };
}

function mapGoalieSeason(row: GoalieSeason) {
  return {
    league: row.league,
    teamName: row.team,
    gamesPlayed: row.gp,
    wins: row.wins,
    losses: row.losses,
    overtimeLosses: row.otl,
    saves: row.saves,
    goalsAgainst: row.goalsAgainst,
    savePercentage: row.savePercentage,
    goalsAgainstAverage: row.gaa,
    shutouts: row.shutouts,
    penaltyMinutes: row.pim
  };
}

publicRoutes.get("/achievements", async (c) => {
  const result = await query(
    `select id, title, body, display_order as "displayOrder"
     from achievements order by display_order asc, created_at desc`
  );
  return c.json({ items: result.rows });
});

publicRoutes.get("/records", async (c) => {
  const data = await cacheJson("records:all-time", 300, async () => {
    const leaders = await query(
      `with snapshot_skater as (
        select
          p.name,
          p.slug,
          coalesce(sum((row.value->>'gamesPlayed')::integer), 0) as games_played,
          coalesce(sum((row.value->>'goals')::integer), 0) as goals,
          coalesce(sum((row.value->>'assists')::integer), 0) as assists,
          coalesce(sum((row.value->>'points')::integer), 0) as points,
          coalesce(sum((row.value->>'plusMinus')::integer), 0) as plus_minus,
          coalesce(sum((row.value->>'penaltyMinutes')::integer), 0) as penalty_minutes,
          coalesce(sum((row.value->>'shots')::integer), 0) as shots,
          coalesce(sum((row.value->>'hits')::integer), 0) as hits
        from players p
        join sportsgamer_player_stat_snapshots s on s.player_id = p.id
        cross join lateral jsonb_array_elements(s.stats->'skater') as row(value)
        where row.value->>'teamName' = any($1::text[])
        group by p.id
      ), snapshot_goalie as (
        select
          p.name,
          p.slug,
          coalesce(sum((row.value->>'gamesPlayed')::integer), 0) as goalie_games_played,
          coalesce(sum((row.value->>'wins')::integer), 0) as wins,
          coalesce(sum((row.value->>'saves')::integer), 0) as saves,
          coalesce(sum((row.value->>'shutouts')::integer), 0) as shutouts
        from players p
        join sportsgamer_player_stat_snapshots s on s.player_id = p.id
        cross join lateral jsonb_array_elements(s.stats->'goalie') as row(value)
        where row.value->>'teamName' = any($1::text[])
        group by p.id
      )
      select
        (select jsonb_build_object('name', name, 'slug', slug, 'value', games_played) from snapshot_skater order by games_played desc, name asc limit 1) as "gamesPlayed",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', goals) from snapshot_skater order by goals desc, name asc limit 1) as "goals",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', assists) from snapshot_skater order by assists desc, name asc limit 1) as "assists",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', points) from snapshot_skater order by points desc, name asc limit 1) as "points",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', plus_minus) from snapshot_skater order by plus_minus desc, name asc limit 1) as "plusMinus",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', penalty_minutes) from snapshot_skater order by penalty_minutes desc, name asc limit 1) as "penaltyMinutes",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', shots) from snapshot_skater order by shots desc, name asc limit 1) as "shots",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', hits) from snapshot_skater order by hits desc, name asc limit 1) as "hits",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', goalie_games_played) from snapshot_goalie order by goalie_games_played desc, name asc limit 1) as "goalieGamesPlayed",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', wins) from snapshot_goalie order by wins desc, name asc limit 1) as "goalieWins",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', saves) from snapshot_goalie order by saves desc, name asc limit 1) as "saves",
        (select jsonb_build_object('name', name, 'slug', slug, 'value', shutouts) from snapshot_goalie order by shutouts desc, name asc limit 1) as "shutouts"`,
      [teamNames]
    );
    return leaders.rows[0];
  });
  return c.json(data);
});

publicRoutes.get("/games/upcoming", async (c) => {
  const result = await query(
    `select opponent, competition, starts_at as "startsAt", sportsgamer_url as "sportsGamerUrl"
     from upcoming_games
     where starts_at >= now()
     order by starts_at asc
     limit 8`
  );
  return c.json({ items: result.rows });
});
