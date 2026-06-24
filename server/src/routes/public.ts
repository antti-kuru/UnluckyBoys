import { Hono } from "hono";
import { cacheJson, readCacheJson, writeCacheJson } from "../lib/cache.js";
import { query } from "../lib/db.js";
import { notFound, parsePagination } from "../lib/http.js";
import { teamNames } from "../config.js";
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
            handedness, captain, alternate_captain as "alternateCaptain", image_url as "imageUrl"
     from players
     where active = true
     order by roster_order asc, name asc`
  );
  return c.json({ items: result.rows });
});

publicRoutes.get("/hall-of-fame", async (c) => {
  const result = await query(
    `select slug, name, nickname, position, jersey_number as "number", nationality,
            handedness, captain, alternate_captain as "alternateCaptain", image_url as "imageUrl"
     from players
     where active = false
     order by roster_order asc, name asc`
  );
  return c.json({ items: result.rows });
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
  return { source: "database", skater: skater.rows, skaterPlayoffs: [], goalie: goalie.rows, goaliePlayoffs: [] };
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
    const snapshots = await query<{ name: string; slug: string; stats: string }>(
      `select p.name, p.slug, s.stats
       from players p
       join sportsgamer_player_stat_snapshots s on s.player_id = p.id`
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

    for (const row of snapshots.rows) {
      const stats = JSON.parse(row.stats) as {
        skater?: Array<Record<string, unknown>>;
        goalie?: Array<Record<string, unknown>>;
      };
      const skaterRows = (stats.skater ?? []).filter((stat) => teamNames.includes(String(stat.teamName ?? "")));
      const goalieRows = (stats.goalie ?? []).filter((stat) => teamNames.includes(String(stat.teamName ?? "")));
      const skaterTotals = {
        gamesPlayed: 0,
        goals: 0,
        assists: 0,
        points: 0,
        plusMinus: 0,
        penaltyMinutes: 0,
        shots: 0,
        hits: 0
      };
      const goalieTotals = {
        goalieGamesPlayed: 0,
        goalieWins: 0,
        saves: 0,
        shutouts: 0
      };

      for (const stat of skaterRows) {
        skaterTotals.gamesPlayed += Number(stat.gamesPlayed ?? 0);
        skaterTotals.goals += Number(stat.goals ?? 0);
        skaterTotals.assists += Number(stat.assists ?? 0);
        skaterTotals.points += Number(stat.points ?? 0);
        skaterTotals.plusMinus += Number(stat.plusMinus ?? 0);
        skaterTotals.penaltyMinutes += Number(stat.penaltyMinutes ?? 0);
        skaterTotals.shots += Number(stat.shots ?? 0);
        skaterTotals.hits += Number(stat.hits ?? 0);
      }

      for (const stat of goalieRows) {
        goalieTotals.goalieGamesPlayed += Number(stat.gamesPlayed ?? 0);
        goalieTotals.goalieWins += Number(stat.wins ?? 0);
        goalieTotals.saves += Number(stat.saves ?? 0);
        goalieTotals.shutouts += Number(stat.shutouts ?? 0);
      }

      for (const [key, value] of Object.entries({ ...skaterTotals, ...goalieTotals })) {
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
