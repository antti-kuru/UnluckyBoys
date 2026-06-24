import * as cheerio from "cheerio";
import { config, teamNames } from "../config.js";
import { query, withTransaction } from "../lib/db.js";
import { deleteCacheKeys } from "../lib/cache.js";

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
  skaterPlayoffs: SkaterSeason[];
  goalie: GoalieSeason[];
  goaliePlayoffs: GoalieSeason[];
};

export type LeagueStandingTeam = {
  rank: number;
  teamId: number;
  teamName: string;
  abbreviation: string | null;
  logoUrl: string | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  overtimeWins: number;
  overtimeLosses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  powerplayPercentage: number | null;
  penaltyKillPercentage: number | null;
  penaltyMinutes: number;
  shots: number;
  hits: number;
  currentStreak: string | null;
};

export type LeagueStandingGroup = {
  groupId: number;
  groupName: string | null;
  teams: LeagueStandingTeam[];
};

export type LeagueStandings = {
  leagueId: number;
  leagueName: string;
  sourceUrl: string;
  groups: LeagueStandingGroup[];
};

export type ScheduleTeam = {
  id: number;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
};

export type TeamScheduleGame = {
  id: number;
  type: string | null;
  date: string;
  status: string | null;
  played: boolean;
  overtime: boolean;
  homeTeam: ScheduleTeam;
  awayTeam: ScheduleTeam;
  goalsHome: number | null;
  goalsAway: number | null;
  sportsGamerUrl: string | null;
};

export type TeamSchedule = {
  leagueId: number;
  leagueName: string;
  teamId: number;
  status: "all" | "played" | "unplayed";
  sourceUrl: string;
  games: TeamScheduleGame[];
};

export type SeasonStatLine = {
  gamesPlayed: number;
  goals: number;
  assists: number;
  totalPoints: number;
  penaltyMinutes: number;
  plusMinus: number;
};

export type SeasonGoalieStatLine = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  savePercentage: number | null;
  goalsAgainstAverage: number | null;
  shutouts: number;
};

export type TeamSeasonPlayerStats = {
  playerName: string;
  playerUrl: string | null;
  regular: SeasonStatLine;
  playoffs: SeasonStatLine;
};

export type TeamSeasonGoalieStats = {
  playerName: string;
  playerUrl: string | null;
  regular: SeasonGoalieStatLine;
  playoffs: SeasonGoalieStatLine;
};

export type TeamSeasonStats = {
  leagueId: number;
  leagueName: string;
  teamId: number;
  teamName: string;
  sourceUrl: string;
  players: TeamSeasonPlayerStats[];
  goalies: TeamSeasonGoalieStats[];
};

export type PlayoffMatchup = {
  id: number;
  complete: boolean;
  bracketKey: string | null;
  homeWins: number;
  awayWins: number;
  homeTeam: ScheduleTeam;
  awayTeam: ScheduleTeam;
};

export type PlayoffRound = {
  id: number;
  description: string;
  bestOutOf: number | null;
  winsNeeded: number | null;
  relegation: boolean;
  matchups: PlayoffMatchup[];
};

export type LeaguePlayoffs = {
  leagueId: number;
  leagueName: string;
  sourceUrl: string;
  rounds: PlayoffRound[];
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

function decodeText(value: unknown) {
  if (typeof value !== "string") return "";
  return cheerio.load(value).text();
}

export function parsePlayerCareerStats(html: string, teamFilter: string[] | null = teamNames) {
  const $ = cheerio.load(html);
  const skater: SkaterSeason[] = [];
  const skaterPlayoffs: SkaterSeason[] = [];
  const goalie: GoalieSeason[] = [];
  const goaliePlayoffs: GoalieSeason[] = [];

  $("table").each((_, table) => {
    const header = $(table).find("tr").first().text().replace(/\s+/g, " ");
    const rows = $(table).find("tr").slice(1).toArray();
    if (header.includes("GP") && header.includes("G") && header.includes("A") && header.includes("+/-")) {
      for (const row of rows) {
        const cells = rowCells(row, $);
        if (cells.length < 8 || (teamFilter && !teamFilter.includes(cells[1]))) continue;
        const isPlayoffs = /\bplayoffs?\b/i.test(cells[0]);
        const season: SkaterSeason = {
          league: cleanPlayerLeagueName(cells[0]),
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
        };
        if (isPlayoffs) skaterPlayoffs.push(season);
        else skater.push(season);
      }
    }
    if (header.includes("GP") && header.includes("W") && header.includes("SV%") && header.includes("GAA")) {
      for (const row of rows) {
        const cells = rowCells(row, $);
        if (cells.length < 11 || (teamFilter && !teamFilter.includes(cells[1]))) continue;
        const isPlayoffs = /\bplayoffs?\b/i.test(cells[0]);
        const season: GoalieSeason = {
          league: cleanPlayerLeagueName(cells[0]),
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
        };
        if (isPlayoffs) goaliePlayoffs.push(season);
        else goalie.push(season);
      }
    }
  });

  return { skater, skaterPlayoffs, goalie, goaliePlayoffs };
}

function cleanPlayerLeagueName(value: string) {
  return value
    .replace(/\s*-\s*(Regular season|Playoffs?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

type SportsGamerStandingTeam = {
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  otWins?: number;
  otLosses?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  ppPercentage?: number | null;
  pkPercentage?: number | null;
  penaltyMinutes?: number;
  shots?: number;
  hits?: number;
  currentStreak?: string | null;
  team?: {
    id?: number;
    name?: string;
    abbreviation?: string | null;
    logo?: string | null;
  };
};

type SportsGamerStandingGroup = {
  groupId?: number;
  teams?: SportsGamerStandingTeam[];
};

type SportsGamerStandingsPage = {
  props?: {
    league?: {
      id?: number;
      name?: string;
      groups?: SportsGamerStandingGroup[];
    };
    groupNames?: string[];
  };
};

type SportsGamerTeam = {
  id?: number;
  name?: string;
  abbreviation?: string | null;
  logo?: string | null;
};

type SportsGamerScheduleResult = {
  status?: string | null;
  overtime?: boolean;
  goalsHome?: number | null;
  goalsAway?: number | null;
  url?: string | null;
};

type SportsGamerScheduleMatchup = {
  id?: number;
  type?: string | null;
  date?: string;
  stream?: string | null;
  result?: SportsGamerScheduleResult | null;
  match?: {
    matchID?: number;
    goalsHome?: number | null;
    goalsAway?: number | null;
    overtime?: boolean;
  } | null;
  homeTeam?: SportsGamerTeam;
  awayTeam?: SportsGamerTeam;
};

type SportsGamerSchedulePage = {
  props?: {
    league?: {
      id?: number;
      name?: string;
    };
    teamId?: string | number;
    filters?: {
      status?: string;
    };
    matchups?: SportsGamerScheduleMatchup[];
  };
};

type SportsGamerPlayoffMatchup = {
  id?: number;
  complete?: boolean;
  bracketKey?: string | null;
  homeWins?: number;
  awayWins?: number;
  homeTeam?: SportsGamerTeam;
  awayTeam?: SportsGamerTeam;
};

type SportsGamerPlayoffRound = {
  id?: number;
  description?: string;
  bestOutOf?: number | null;
  winsNeeded?: number | null;
  relegation?: boolean;
  matchups?: SportsGamerPlayoffMatchup[];
};

type SportsGamerPlayoffsPage = {
  props?: {
    league?: {
      id?: number;
      name?: string;
      playoffRounds?: SportsGamerPlayoffRound[];
    };
  };
};

export function parseLeagueStandingsPage(html: string, fallbackLeagueId: number, sourceUrl: string): LeagueStandings {
  const $ = cheerio.load(html);
  const pageData = $("[data-page]").attr("data-page");

  if (!pageData) {
    throw new Error("SportsGamer standings data not found");
  }

  const parsed = JSON.parse(pageData) as SportsGamerStandingsPage;
  const league = parsed.props?.league;
  const groups = league?.groups ?? [];

  return {
    leagueId: league?.id ?? fallbackLeagueId,
    leagueName: decodeText(league?.name) || `League ${fallbackLeagueId}`,
    sourceUrl,
    groups: groups.map((group, groupIndex) => ({
      groupId: group.groupId ?? groupIndex,
      groupName: parsed.props?.groupNames?.[groupIndex] ? decodeText(parsed.props.groupNames[groupIndex]) : null,
      teams: (group.teams ?? []).map((standing, index) => {
        const goalsFor = num(String(standing.goalsFor ?? 0));
        const goalsAgainst = num(String(standing.goalsAgainst ?? 0));

        return {
          rank: index + 1,
          teamId: standing.team?.id ?? 0,
          teamName: decodeText(standing.team?.name) || "Unknown team",
          abbreviation: standing.team?.abbreviation ? decodeText(standing.team.abbreviation) : null,
          logoUrl: standing.team?.logo ?? null,
          gamesPlayed: num(String(standing.gamesPlayed ?? 0)),
          wins: num(String(standing.wins ?? 0)),
          losses: num(String(standing.losses ?? 0)),
          ties: num(String(standing.ties ?? 0)),
          overtimeWins: num(String(standing.otWins ?? 0)),
          overtimeLosses: num(String(standing.otLosses ?? 0)),
          points: num(String(standing.points ?? 0)),
          goalsFor,
          goalsAgainst,
          goalDifference: goalsFor - goalsAgainst,
          powerplayPercentage: nullableNum(String(standing.ppPercentage ?? "")),
          penaltyKillPercentage: nullableNum(String(standing.pkPercentage ?? "")),
          penaltyMinutes: num(String(standing.penaltyMinutes ?? 0)),
          shots: num(String(standing.shots ?? 0)),
          hits: num(String(standing.hits ?? 0)),
          currentStreak: standing.currentStreak ?? null
        };
      })
    }))
  };
}

function emptyStatLine(): SeasonStatLine {
  return {
    gamesPlayed: 0,
    goals: 0,
    assists: 0,
    totalPoints: 0,
    penaltyMinutes: 0,
    plusMinus: 0
  };
}

function emptyGoalieStatLine(): SeasonGoalieStatLine {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    overtimeLosses: 0,
    savePercentage: null,
    goalsAgainstAverage: null,
    shutouts: 0
  };
}

function parseSeasonStatTable(table: unknown, $: cheerio.CheerioAPI) {
  return $(table as never)
    .find("tr")
    .slice(1)
    .toArray()
    .map((row) => {
      const cells = rowCells(row, $);
      const nameCell = $(row).find("td, th").eq(1);
      const link = nameCell.find("a[href*='/players/']").first();
      const playerName = link.find("b").first().text().trim() || link.text().trim() || cells[1]?.split(",")[0]?.trim() || "Unknown player";
      const playerHref = link.attr("href");

      return {
        playerName,
        playerUrl: playerHref ? (playerHref.startsWith("http") ? playerHref : `${config.SPORTSGAMER_BASE_URL}${playerHref}`) : null,
        statLine: {
          gamesPlayed: num(cells[2]),
          goals: num(cells[3]),
          assists: num(cells[4]),
          totalPoints: num(cells[5]),
          plusMinus: num(cells[6]),
          penaltyMinutes: num(cells[7])
        }
      };
    })
    .filter((row) => row.playerName !== "Unknown player" && row.statLine.gamesPlayed > 0);
}

function parseSeasonGoalieTable(table: unknown, $: cheerio.CheerioAPI) {
  return $(table as never)
    .find("tr")
    .slice(1)
    .toArray()
    .map((row) => {
      const cells = rowCells(row, $);
      const nameCell = $(row).find("td, th").eq(1);
      const link = nameCell.find("a[href*='/players/']").first();
      const playerName = link.find("b").first().text().trim() || link.text().trim() || cells[1]?.split(",")[0]?.trim() || "Unknown player";
      const playerHref = link.attr("href");

      return {
        playerName,
        playerUrl: playerHref ? (playerHref.startsWith("http") ? playerHref : `${config.SPORTSGAMER_BASE_URL}${playerHref}`) : null,
        statLine: {
          gamesPlayed: num(cells[2]),
          wins: num(cells[3]),
          losses: num(cells[4]),
          overtimeLosses: num(cells[5]),
          savePercentage: nullableNum(cells[8]),
          goalsAgainstAverage: nullableNum(cells[9]),
          shutouts: num(cells[10])
        }
      };
    })
    .filter((row) => row.playerName !== "Unknown player" && row.statLine.gamesPlayed > 0);
}

export function parseTeamSeasonStatsPage(html: string, leagueId: number, teamId: number, sourceUrl: string): TeamSeasonStats {
  const $ = cheerio.load(html);
  const titleParts = $("title").text().trim().split(" - ");
  const teamName = decodeText($(".profile-name").first().text().trim()) || titleParts[0] || "Unlucky Boys";
  const leagueName = titleParts.length > 2 ? decodeText(titleParts.slice(1, -1).join(" - ")) : `League ${leagueId}`;
  const skaterTables = $("table")
    .toArray()
    .filter((table) => {
      const header = rowCells($(table).find("tr").first()[0], $);
      return header.includes("GP") && header.includes("G") && header.includes("A") && header.includes("P") && header.includes("+/-");
    })
    .slice(0, 2);
  const goalieTables = $("table")
    .toArray()
    .filter((table) => {
      const header = rowCells($(table).find("tr").first()[0], $);
      return header.includes("GP") && header.includes("W") && header.includes("OTL") && header.includes("SV%") && header.includes("GAA") && header.includes("SO");
    })
    .slice(0, 2);

  const regular = skaterTables[0] ? parseSeasonStatTable(skaterTables[0], $) : [];
  const playoffs = skaterTables[1] ? parseSeasonStatTable(skaterTables[1], $) : [];
  const regularGoalies = goalieTables[0] ? parseSeasonGoalieTable(goalieTables[0], $) : [];
  const playoffGoalies = goalieTables[1] ? parseSeasonGoalieTable(goalieTables[1], $) : [];
  const playersByName = new Map<string, TeamSeasonPlayerStats>();
  const goaliesByName = new Map<string, TeamSeasonGoalieStats>();

  for (const row of regular) {
    playersByName.set(row.playerName, {
      playerName: row.playerName,
      playerUrl: row.playerUrl,
      regular: row.statLine,
      playoffs: emptyStatLine()
    });
  }

  for (const row of playoffs) {
    const existing = playersByName.get(row.playerName);
    if (existing) {
      existing.playoffs = row.statLine;
      existing.playerUrl = existing.playerUrl ?? row.playerUrl;
    } else {
      playersByName.set(row.playerName, {
        playerName: row.playerName,
        playerUrl: row.playerUrl,
        regular: emptyStatLine(),
        playoffs: row.statLine
      });
    }
  }

  for (const row of regularGoalies) {
    goaliesByName.set(row.playerName, {
      playerName: row.playerName,
      playerUrl: row.playerUrl,
      regular: row.statLine,
      playoffs: emptyGoalieStatLine()
    });
  }

  for (const row of playoffGoalies) {
    const existing = goaliesByName.get(row.playerName);
    if (existing) {
      existing.playoffs = row.statLine;
      existing.playerUrl = existing.playerUrl ?? row.playerUrl;
    } else {
      goaliesByName.set(row.playerName, {
        playerName: row.playerName,
        playerUrl: row.playerUrl,
        regular: emptyGoalieStatLine(),
        playoffs: row.statLine
      });
    }
  }

  return {
    leagueId,
    leagueName,
    teamId,
    teamName,
    sourceUrl,
    players: [...playersByName.values()].sort(
      (a, b) =>
        b.regular.totalPoints - a.regular.totalPoints ||
        b.regular.goals - a.regular.goals ||
        b.playoffs.totalPoints - a.playoffs.totalPoints ||
        a.playerName.localeCompare(b.playerName)
    ),
    goalies: [...goaliesByName.values()].sort(
      (a, b) =>
        b.regular.gamesPlayed - a.regular.gamesPlayed ||
        b.playoffs.gamesPlayed - a.playoffs.gamesPlayed ||
        a.playerName.localeCompare(b.playerName)
    )
  };
}

function mapScheduleTeam(team: SportsGamerTeam | undefined): ScheduleTeam {
  return {
    id: team?.id ?? 0,
    name: decodeText(team?.name) || "Unknown team",
    abbreviation: team?.abbreviation ? decodeText(team.abbreviation) : null,
    logoUrl: team?.logo ?? null
  };
}

export function parseLeaguePlayoffsPage(html: string, fallbackLeagueId: number, sourceUrl: string): LeaguePlayoffs {
  const $ = cheerio.load(html);
  const pageData = $("[data-page]").attr("data-page");

  if (!pageData) {
    throw new Error("SportsGamer playoff data not found");
  }

  const parsed = JSON.parse(pageData) as SportsGamerPlayoffsPage;
  const league = parsed.props?.league;

  return {
    leagueId: league?.id ?? fallbackLeagueId,
    leagueName: decodeText(league?.name) || `League ${fallbackLeagueId}`,
    sourceUrl,
    rounds: (league?.playoffRounds ?? []).map((round) => ({
      id: round.id ?? 0,
      description: decodeText(round.description) || "Playoffs",
      bestOutOf: round.bestOutOf ?? null,
      winsNeeded: round.winsNeeded ?? null,
      relegation: Boolean(round.relegation),
      matchups: (round.matchups ?? []).map((matchup) => ({
        id: matchup.id ?? 0,
        complete: Boolean(matchup.complete),
        bracketKey: matchup.bracketKey ?? null,
        homeWins: num(String(matchup.homeWins ?? 0)),
        awayWins: num(String(matchup.awayWins ?? 0)),
        homeTeam: mapScheduleTeam(matchup.homeTeam),
        awayTeam: mapScheduleTeam(matchup.awayTeam)
      }))
    }))
  };
}

export function parseTeamSchedulePage(
  html: string,
  fallbackLeagueId: number,
  fallbackTeamId: number,
  fallbackStatus: "all" | "played" | "unplayed",
  sourceUrl: string
): TeamSchedule {
  const $ = cheerio.load(html);
  const pageData = $("[data-page]").attr("data-page");

  if (!pageData) {
    throw new Error("SportsGamer schedule data not found");
  }

  const parsed = JSON.parse(pageData) as SportsGamerSchedulePage;
  const league = parsed.props?.league;
  const teamId = Number(parsed.props?.teamId ?? fallbackTeamId);
  const status = parsed.props?.filters?.status;

  return {
    leagueId: league?.id ?? fallbackLeagueId,
    leagueName: decodeText(league?.name) || `League ${fallbackLeagueId}`,
    teamId: Number.isFinite(teamId) ? teamId : fallbackTeamId,
    status: status === "played" || status === "unplayed" || status === "all" ? status : fallbackStatus,
    sourceUrl,
    games: (parsed.props?.matchups ?? [])
      .map((matchup) => {
        const result = matchup.result ?? null;
        const goalsHome = result?.goalsHome ?? matchup.match?.goalsHome ?? null;
        const goalsAway = result?.goalsAway ?? matchup.match?.goalsAway ?? null;
        const sportsGamerUrl = result?.url ?? (matchup.match?.matchID ? `${config.SPORTSGAMER_BASE_URL}/matchesnew/${matchup.match.matchID}` : null);

        return {
          id: matchup.id ?? matchup.match?.matchID ?? 0,
          type: matchup.type ?? null,
          date: matchup.date ?? "",
          status: result?.status ?? null,
          played: Boolean(result) || (goalsHome !== null && goalsAway !== null),
          overtime: Boolean(result?.overtime ?? matchup.match?.overtime),
          homeTeam: mapScheduleTeam(matchup.homeTeam),
          awayTeam: mapScheduleTeam(matchup.awayTeam),
          goalsHome,
          goalsAway,
          sportsGamerUrl
        };
      })
      .filter((game) => game.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  };
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

export async function fetchLeagueStandings(leagueId: number): Promise<LeagueStandings> {
  const sourceUrl = `${config.SPORTSGAMER_BASE_URL}/leagues/${leagueId}/standings`;
  const response = await fetchWithRetry(sourceUrl);

  if (!response.ok) {
    throw new Error(`SportsGamer standings request failed: ${response.status}`);
  }

  const html = await response.text();
  return parseLeagueStandingsPage(html, leagueId, sourceUrl);
}

export async function fetchTeamSeasonStats(leagueId: number, teamId: number): Promise<TeamSeasonStats> {
  const sourceUrl = `${config.SPORTSGAMER_BASE_URL}/leagues/${leagueId}/teams/${teamId}`;
  const response = await fetchWithRetry(sourceUrl);

  if (!response.ok) {
    throw new Error(`SportsGamer team stats request failed: ${response.status}`);
  }

  const html = await response.text();
  return parseTeamSeasonStatsPage(html, leagueId, teamId, sourceUrl);
}

export async function fetchTeamSchedule(
  leagueId: number,
  teamId: number,
  status: "all" | "played" | "unplayed" = "all"
): Promise<TeamSchedule> {
  const sourceUrl = `${config.SPORTSGAMER_BASE_URL}/leagues/${leagueId}/schedule/${teamId}?type=all&status=${status}`;
  const response = await fetchWithRetry(sourceUrl);

  if (!response.ok) {
    throw new Error(`SportsGamer schedule request failed: ${response.status}`);
  }

  const html = await response.text();
  return parseTeamSchedulePage(html, leagueId, teamId, status, sourceUrl);
}

export async function fetchLeaguePlayoffs(leagueId: number): Promise<LeaguePlayoffs> {
  const sourceUrl = `${config.SPORTSGAMER_BASE_URL}/leagues/${leagueId}/playoffs`;
  const response = await fetchWithRetry(sourceUrl);

  if (!response.ok) {
    throw new Error(`SportsGamer playoffs request failed: ${response.status}`);
  }

  const html = await response.text();
  return parseLeaguePlayoffsPage(html, leagueId, sourceUrl);
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

export async function syncPlayerFromSportsGamer(playerId: string, sourceUrl: string) {
  const parsed = await fetchPlayerCareerStats(sourceUrl);

  await query("delete from player_season_stats where player_id = $1", [playerId]);
  await query("delete from goalie_season_stats where player_id = $1", [playerId]);

  for (const row of parsed.skater) {
    await query(
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
    await query(
      `insert into goalie_season_stats
       (player_id, league, team_name, games_played, wins, losses, overtime_losses, saves, goals_against, save_percentage, goals_against_average, shutouts, penalty_minutes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [playerId, row.league, row.team, row.gp, row.wins, row.losses, row.otl, row.saves, row.goalsAgainst, row.savePercentage, row.gaa, row.shutouts, row.pim]
    );
  }

  await query(
    `insert into sync_runs (source, status, message)
     values ('sportsgamer', 'success', $1)`,
    [`Synced ${parsed.skater.length} skater and ${parsed.goalie.length} goalie rows for ${playerId}`]
  );
}

export async function syncAllSportsGamerPlayers() {
  return withTransaction(async () => {
    const players = await query<{ id: string; slug: string; sportsgamer_url: string | null }>(
      "select id, slug, sportsgamer_url from players where sportsgamer_url is not null order by name"
    );
    for (const player of players.rows) {
      await syncPlayerFromSportsGamer(player.id, player.sportsgamer_url!);
    }
    await deleteCacheKeys(["records:all-time", ...players.rows.map((player) => `player-stats:${player.slug}`)]);
    return { syncedPlayers: players.rowCount ?? 0 };
  });
}
