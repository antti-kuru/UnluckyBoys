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
