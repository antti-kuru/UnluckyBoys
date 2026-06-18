import * as cheerio from "cheerio";
import type pg from "pg";
import { config, teamNames } from "../config.js";
import { withTransaction } from "../lib/db.js";
import { redis } from "../lib/redis.js";

export type SkaterSeason = {
  league: string;
  team: string;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  powerplayGoals: number;
  shorthandedGoals: number;
  gameWinningGoals: number;
  shots: number;
  shootingPercentage: number | null;
  hits: number;
  faceoffWinPercentage: number | null;
};

export type GoalieSeason = {
  league: string;
  team: string;
  gp: number;
  wins: number;
  losses: number;
  otl: number;
  saves: number;
  goalsAgainst: number;
  savePercentage: number | null;
  gaa: number | null;
  shutouts: number;
  pim: number;
};

export type PlayerCareerStats = {
  skater: SkaterSeason[];
  goalie: GoalieSeason[];
};

const SPORTSGAMER_FETCH_ATTEMPTS = 3;

function num(value: string | undefined) {
  const normalized = (value ?? "").trim().replace("%", "").replace("−", "-");
  if (!normalized || normalized === "-") return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: string | undefined) {
  const normalized = value?.trim().replace("%", "").replace("−", "-");
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowCells(row: unknown, $: cheerio.CheerioAPI) {
  return $(row as never).find("td, th").map((_, cell) => $(cell).text().trim().replace(/\s+/g, " ")).get();
}

export function parsePlayerCareerStats(html: string, teamFilter: string[] | null = teamNames) {
  const $ = cheerio.load(html);
  const skater: SkaterSeason[] = [];
  const goalie: GoalieSeason[] = [];

  $("table").each((_, table) => {
    const header = $(table).find("tr").first().text().replace(/\s+/g, " ");
    const rows = $(table).find("tr").slice(1).toArray();
    if (header.includes("GP") && header.includes("G") && header.includes("A") && header.includes("+/-")) {
      for (const row of rows) {
        const cells = rowCells(row, $);
        if (cells.length < 8 || (teamFilter && !teamFilter.includes(cells[1]))) continue;
        skater.push({
          league: cells[0],
          team: cells[1],
          gp: num(cells[2]),
          goals: num(cells[3]),
          assists: num(cells[4]),
          points: num(cells[5]),
          plusMinus: num(cells[6]),
          pim: num(cells[7]),
          powerplayGoals: num(cells[8]),
          shorthandedGoals: num(cells[9]),
          gameWinningGoals: num(cells[10]),
          shots: num(cells[11]),
          shootingPercentage: nullableNum(cells[12]),
          hits: num(cells[13]),
          faceoffWinPercentage: nullableNum(cells[14])
        });
      }
    }
    if (header.includes("GP") && header.includes("W") && header.includes("SV%") && header.includes("GAA")) {
      for (const row of rows) {
        const cells = rowCells(row, $);
        if (cells.length < 11 || (teamFilter && !teamFilter.includes(cells[1]))) continue;
        goalie.push({
          league: cells[0],
          team: cells[1],
          gp: num(cells[2]),
          wins: num(cells[3]),
          losses: num(cells[4]),
          otl: num(cells[5]),
          saves: num(cells[6]),
          goalsAgainst: num(cells[7]),
          savePercentage: nullableNum(cells[8]),
          gaa: nullableNum(cells[9]),
          shutouts: num(cells[10]),
          pim: num(cells[11])
        });
      }
    }
  });

  return { skater, goalie };
}

export async function fetchPlayerCareerStats(sourceUrl: string, teamFilter: string[] | null = teamNames): Promise<PlayerCareerStats> {
  const url = sourceUrl.startsWith("http") ? sourceUrl : `${config.SPORTSGAMER_BASE_URL}${sourceUrl}`;
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`SportsGamer request failed: ${response.status}`);
  }
  const html = await response.text();
  return parsePlayerCareerStats(html, teamFilter);
}

async function fetchWithRetry(url: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= SPORTSGAMER_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500 || attempt === SPORTSGAMER_FETCH_ATTEMPTS) {
        return response;
      }
      lastError = new Error(`SportsGamer request failed: ${response.status}`);
    } catch (caught) {
      lastError = caught;
      if (attempt === SPORTSGAMER_FETCH_ATTEMPTS) break;
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 700));
  }

  throw lastError instanceof Error ? lastError : new Error("SportsGamer request failed");
}

export async function syncPlayerFromSportsGamer(client: pg.PoolClient, playerId: string, sourceUrl: string) {
  const parsed = await fetchPlayerCareerStats(sourceUrl);

  await client.query("delete from player_season_stats where player_id = $1", [playerId]);
  await client.query("delete from goalie_season_stats where player_id = $1", [playerId]);

  for (const row of parsed.skater) {
    await client.query(
      `insert into player_season_stats
       (player_id, league, team_name, games_played, goals, assists, points, plus_minus, penalty_minutes,
        powerplay_goals, shorthanded_goals, game_winning_goals, shots, shooting_percentage, hits, faceoff_win_percentage)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        playerId,
        row.league,
        row.team,
        row.gp,
        row.goals,
        row.assists,
        row.points,
        row.plusMinus,
        row.pim,
        row.powerplayGoals,
        row.shorthandedGoals,
        row.gameWinningGoals,
        row.shots,
        row.shootingPercentage,
        row.hits,
        row.faceoffWinPercentage
      ]
    );
  }

  for (const row of parsed.goalie) {
    await client.query(
      `insert into goalie_season_stats
       (player_id, league, team_name, games_played, wins, losses, overtime_losses, saves, goals_against, save_percentage, goals_against_average, shutouts, penalty_minutes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [playerId, row.league, row.team, row.gp, row.wins, row.losses, row.otl, row.saves, row.goalsAgainst, row.savePercentage, row.gaa, row.shutouts, row.pim]
    );
  }

  await client.query(
    `insert into sync_runs (source, status, message)
     values ('sportsgamer', 'success', $1)`,
    [`Synced ${parsed.skater.length} skater and ${parsed.goalie.length} goalie rows for ${playerId}`]
  );
}

export async function syncAllSportsGamerPlayers() {
  return withTransaction(async (client) => {
    const players = await client.query<{ id: string; slug: string; sportsgamer_url: string | null }>(
      "select id, slug, sportsgamer_url from players where sportsgamer_url is not null order by name"
    );
    for (const player of players.rows) {
      await syncPlayerFromSportsGamer(client, player.id, player.sportsgamer_url!);
    }
    try {
      await redis.del("records:all-time", ...players.rows.map((player) => `player-stats:${player.slug}`));
    } catch {
      // Redis is an optimization; a failed cache clear should not undo a completed database sync.
    }
    return { syncedPlayers: players.rowCount ?? 0 };
  });
}
