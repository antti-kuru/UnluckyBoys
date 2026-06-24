export type News = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  coverImageUrl?: string | null;
  publishedAt: string;
};

export type Player = {
  id?: string;
  slug: string;
  name: string;
  nickname?: string | null;
  position: string;
  number: number;
  nationality?: string | null;
  handedness?: string | null;
  captain?: boolean;
  alternateCaptain?: boolean;
  imageUrl?: string | null;
  bio?: string;
  sportsGamerUrl?: string | null;
};

export type Achievement = {
  id: string;
  title: string;
  body: string;
  displayOrder: number;
};

export type UpcomingGame = {
  opponent: string;
  competition: string;
  startsAt: string;
  sportsGamerUrl?: string | null;
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

export type SkaterStat = {
  league: string;
  teamName: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerplayGoals: number;
  shorthandedGoals: number;
  gameWinningGoals: number;
  shots: number;
  shootingPercentage: number | null;
  hits: number;
  faceoffWinPercentage: number | null;
};

export type GoalieStat = {
  league: string;
  teamName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  saves: number;
  goalsAgainst: number;
  savePercentage: number | null;
  goalsAgainstAverage: number | null;
  shutouts: number;
  penaltyMinutes: number;
};

export type PlayerStatsResponse = {
  source: "sportsgamer" | "database";
  skater: SkaterStat[];
  skaterPlayoffs?: SkaterStat[];
  goalie: GoalieStat[];
  goaliePlayoffs?: GoalieStat[];
};
