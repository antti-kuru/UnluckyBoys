import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheJson, readCacheJson, writeCacheJson } from "../lib/cache.js";
import { query } from "../lib/db.js";
import { notFound, parsePagination } from "../lib/http.js";
import { config, teamNames } from "../config.js";
import {
  fetchLeaguePlayoffs,
  fetchLeagueStandings,
  fetchPlayerCareerStats,
  fetchTeamSchedule,
  fetchTeamSeasonStats,
  type GoalieSeason,
  type SkaterSeason
} from "../integrations/sportsgamer.js";

export const publicRoutes = new Hono();

const uploadMimeTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

function normalizePlayerRows<T extends { captain?: unknown; alternateCaptain?: unknown }>(rows: T[]) {
  return rows.map((row) => ({
    ...row,
    captain: Boolean(row.captain),
    alternateCaptain: Boolean(row.alternateCaptain)
  }));
}

publicRoutes.get("/news", async (c) => {
  const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"), { limit: 10, max: 50 });
  const result = await query(
    `select slug, title, summary, body, cover_image_url as "coverImageUrl",
            video_url as "videoUrl", published_at as "publishedAt"
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
    `select slug, title, summary, body, cover_image_url as "coverImageUrl",
            video_url as "videoUrl", published_at as "publishedAt"
     from news where slug = $1 and published_at is not null`,
    [c.req.param("slug")]
  );
  if (!result.rows[0]) notFound("News article not found");
  return c.json(result.rows[0]);
});

publicRoutes.get("/uploads/:kind/:filename", async (c) => {
  const kind = c.req.param("kind");
  const filename = c.req.param("filename");

  if (!["news", "players"].includes(kind) || !/^[a-f0-9-]+\.(?:gif|jpe?g|png|webp)$/i.test(filename)) {
    notFound("Upload not found");
  }

  const extension = path.extname(filename).toLowerCase();
  const filePath = path.join(config.UPLOAD_ROOT, kind, filename);

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": uploadMimeTypes[extension] ?? "application/octet-stream"
      }
    });
  } catch {
    notFound("Upload not found");
  }
});

publicRoutes.get("/roster", async (c) => {
  const result = await query(
    `select slug, name, nickname, position, jersey_number as "number", nationality,
            handedness, captain, alternate_captain as "alternateCaptain", image_url as "imageUrl"
     from players
     where active = true
     order by roster_order asc, name asc`
  );
  return c.json({ items: normalizePlayerRows(result.rows) });
});

publicRoutes.get("/hall-of-fame", async (c) => {
  const result = await query(
    `select slug, name, nickname, position, jersey_number as "number", nationality,
            handedness, captain, alternate_captain as "alternateCaptain", image_url as "imageUrl"
     from players
     where active = false
     order by roster_order asc, name asc`
  );
  return c.json({ items: normalizePlayerRows(result.rows) });
});

publicRoutes.get("/players/:slug", async (c) => {
  const result = await query(
    `select id, slug, name, nickname, position, jersey_number as "number", nationality,
            handedness, captain, alternate_captain as "alternateCaptain", image_url as "imageUrl",
            bio, sportsgamer_url as "sportsGamerUrl"
     from players where slug = $1`,
    [c.req.param("slug")]
  );
  if (!result.rows[0]) notFound("Player not found");
  return c.json(normalizePlayerRows(result.rows)[0]);
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
        skaterPlayoffs: liveStats.skaterPlayoffs.map(mapSkaterSeason),
        goalie: liveStats.goalie.map(mapGoalieSeason),
        goaliePlayoffs: liveStats.goaliePlayoffs.map(mapGoalieSeason)
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

publicRoutes.get("/league-standings/:leagueId", async (c) => {
  const leagueId = Number(c.req.param("leagueId"));

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return c.json({ error: "Invalid league id" }, 400);
  }

  const standings = await cacheJson(`sportsgamer:league-standings:${leagueId}`, 300, () => fetchLeagueStandings(leagueId));
  return c.json(standings);
});

publicRoutes.get("/team-schedule/:leagueId/:teamId", async (c) => {
  const leagueId = Number(c.req.param("leagueId"));
  const teamId = Number(c.req.param("teamId"));
  const status = c.req.query("status") ?? "all";

  if (!Number.isInteger(leagueId) || leagueId <= 0 || !Number.isInteger(teamId) || teamId <= 0) {
    return c.json({ error: "Invalid schedule id" }, 400);
  }

  if (status !== "all" && status !== "played" && status !== "unplayed") {
    return c.json({ error: "Invalid schedule status" }, 400);
  }

  const schedule = await cacheJson(`sportsgamer:team-schedule:${leagueId}:${teamId}:${status}`, 300, () =>
    fetchTeamSchedule(leagueId, teamId, status)
  );
  return c.json(schedule);
});

publicRoutes.get("/team-season-stats/:leagueId/:teamId", async (c) => {
  const leagueId = Number(c.req.param("leagueId"));
  const teamId = Number(c.req.param("teamId"));

  if (!Number.isInteger(leagueId) || leagueId <= 0 || !Number.isInteger(teamId) || teamId <= 0) {
    return c.json({ error: "Invalid team stats id" }, 400);
  }

  const stats = await cacheJson(`sportsgamer:team-season-stats:${leagueId}:${teamId}`, 300, () => fetchTeamSeasonStats(leagueId, teamId));
  return c.json(stats);
});

publicRoutes.get("/league-playoffs/:leagueId", async (c) => {
  const leagueId = Number(c.req.param("leagueId"));

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return c.json({ error: "Invalid league id" }, 400);
  }

  const playoffs = await cacheJson(`sportsgamer:league-playoffs:${leagueId}`, 300, () => fetchLeaguePlayoffs(leagueId));
  return c.json(playoffs);
});

async function readSportsGamerStatsCache(slug: string) {
  const parsed = await readCacheJson<{ source?: string }>(`player-stats:${slug}`);
  return parsed?.source === "sportsgamer" ? parsed : null;
}

async function writeSportsGamerStatsCache(slug: string, stats: unknown) {
  await writeCacheJson(`player-stats:${slug}`, stats, 300);
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
  const result = await query<{ stats: string }>(
    "select stats from sportsgamer_player_stat_snapshots where player_id = $1",
    [playerId]
  );
  return result.rows[0]?.stats ? JSON.parse(result.rows[0].stats) : null;
}

async function loadStoredPlayerStats(playerId: string) {
  const skaterSelect = `select league, team_name as "teamName", games_played as "gamesPlayed", goals, assists, points,
                              plus_minus as "plusMinus", penalty_minutes as "penaltyMinutes",
                              powerplay_goals as "powerplayGoals", shorthanded_goals as "shorthandedGoals",
                              game_winning_goals as "gameWinningGoals", shots, shooting_percentage as "shootingPercentage",
                              hits, faceoff_win_percentage as "faceoffWinPercentage"
                       from player_season_stats
                       where player_id = $1 and season_type = $2
                       order by league desc`;
  const goalieSelect = `select league, team_name as "teamName", games_played as "gamesPlayed", wins, losses,
                              overtime_losses as "overtimeLosses", saves, goals_against as "goalsAgainst",
                              save_percentage as "savePercentage", goals_against_average as "goalsAgainstAverage",
                              shutouts, penalty_minutes as "penaltyMinutes"
                       from goalie_season_stats
                       where player_id = $1 and season_type = $2
                       order by league desc`;
  const skater = await query(
    `select league, team_name as "teamName", games_played as "gamesPlayed", goals, assists, points,
            plus_minus as "plusMinus", penalty_minutes as "penaltyMinutes",
            powerplay_goals as "powerplayGoals", shorthanded_goals as "shorthandedGoals",
            game_winning_goals as "gameWinningGoals", shots, shooting_percentage as "shootingPercentage",
            hits, faceoff_win_percentage as "faceoffWinPercentage"
     from player_season_stats where player_id = $1 and season_type = 'regular' order by league desc`,
    [playerId]
  );
  const skaterPlayoffs = await query(
    skaterSelect,
    [playerId, "playoffs"]
  );
  const goalie = await query(
    `select league, team_name as "teamName", games_played as "gamesPlayed", wins, losses,
            overtime_losses as "overtimeLosses", saves, goals_against as "goalsAgainst",
            save_percentage as "savePercentage", goals_against_average as "goalsAgainstAverage",
            shutouts, penalty_minutes as "penaltyMinutes"
     from goalie_season_stats where player_id = $1 and season_type = 'regular' order by league desc`,
    [playerId]
  );
  const goaliePlayoffs = await query(
    goalieSelect,
    [playerId, "playoffs"]
  );
  return { source: "database", skater: skater.rows, skaterPlayoffs: skaterPlayoffs.rows, goalie: goalie.rows, goaliePlayoffs: goaliePlayoffs.rows };
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
    const teamNamePlaceholders = teamNames.map((_, index) => `$${index + 1}`).join(", ");
    const skaterTotals = await query<{
      name: string;
      slug: string;
      gamesPlayed: number;
      goals: number;
      assists: number;
      points: number;
      plusMinus: number;
      penaltyMinutes: number;
      shots: number;
      hits: number;
    }>(
      `select p.name,
              p.slug,
              coalesce(sum(s.games_played), 0) as "gamesPlayed",
              coalesce(sum(s.goals), 0) as goals,
              coalesce(sum(s.assists), 0) as assists,
              coalesce(sum(s.points), 0) as points,
              coalesce(sum(s.plus_minus), 0) as "plusMinus",
              coalesce(sum(s.penalty_minutes), 0) as "penaltyMinutes",
              coalesce(sum(s.shots), 0) as shots,
              coalesce(sum(s.hits), 0) as hits
       from players p
       join player_season_stats s on s.player_id = p.id
       where s.team_name in (${teamNamePlaceholders})
       group by p.id, p.name, p.slug`,
      teamNames
    );
    const goalieTotals = await query<{
      name: string;
      slug: string;
      goalieGamesPlayed: number;
      goalieWins: number;
      saves: number;
      shutouts: number;
    }>(
      `select p.name,
              p.slug,
              coalesce(sum(g.games_played), 0) as "goalieGamesPlayed",
              coalesce(sum(g.wins), 0) as "goalieWins",
              coalesce(sum(g.saves), 0) as saves,
              coalesce(sum(g.shutouts), 0) as shutouts
       from players p
       join goalie_season_stats g on g.player_id = p.id
       where g.team_name in (${teamNamePlaceholders})
       group by p.id, p.name, p.slug`,
      teamNames
    );

    type Leader = { name: string; slug: string; value: number };
    const leaders: Record<string, Leader | null> = {
      gamesPlayed: null,
      goals: null,
      assists: null,
      points: null,
      plusMinus: null,
      penaltyMinutes: null,
      shots: null,
      hits: null,
      goalieGamesPlayed: null,
      goalieWins: null,
      saves: null,
      shutouts: null
    };

    function setLeader(key: keyof typeof leaders, candidate: Leader) {
      const current = leaders[key];
      if (!current || candidate.value > current.value || (candidate.value === current.value && candidate.name.localeCompare(current.name) < 0)) {
        leaders[key] = candidate;
      }
    }

    for (const row of skaterTotals.rows) {
      for (const [key, value] of Object.entries({
        gamesPlayed: row.gamesPlayed,
        goals: row.goals,
        assists: row.assists,
        points: row.points,
        plusMinus: row.plusMinus,
        penaltyMinutes: row.penaltyMinutes,
        shots: row.shots,
        hits: row.hits
      })) {
        setLeader(key as keyof typeof leaders, { name: row.name, slug: row.slug, value: Number(value) });
      }
    }

    for (const row of goalieTotals.rows) {
      for (const [key, value] of Object.entries({
        goalieGamesPlayed: row.goalieGamesPlayed,
        goalieWins: row.goalieWins,
        saves: row.saves,
        shutouts: row.shutouts
      })) {
        setLeader(key as keyof typeof leaders, { name: row.name, slug: row.slug, value });
      }
    }

    return leaders;
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
