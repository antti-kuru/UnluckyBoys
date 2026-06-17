insert into news (slug, title, summary, body, published_at) values
  (
    'unlucky-boys-site-launch',
    'Unlucky Boys Site Launch',
    'The new Unlucky Boys team hub is ready for news, roster updates, games, and records.',
    'Welcome to the new Unlucky Boys hub. This site will collect team news, roster information, upcoming fixtures, player profiles, achievements, and all-time records in one place.',
    now() - interval '2 days'
  ),
  (
    'roster-preparations-continue',
    'Roster Preparations Continue',
    'The team is preparing the active roster for upcoming NHL esports tournaments.',
    'Roster data can be managed from the admin dashboard. Player cards already support images, numbers, positions, bios, and SportsGamer profile links.',
    now() - interval '1 day'
  ),
  (
    'records-system-ready',
    'Records System Ready',
    'All-time leaders will update from stored SportsGamer stat snapshots.',
    'The records page calculates leaders for goals, assists, points, games played, penalty minutes, plus/minus, and goalie games played from the normalized stats tables.',
    now() - interval '6 hours'
  );

insert into players (slug, name, position, jersey_number, bio, active, roster_order, sportsgamer_url) values
  ('anhel-kuru', 'Anhel_Kuru', 'C', 53, 'Founder-era Unlucky Boys player profile placeholder. Connect the SportsGamer URL and run sync to replace sample rows with live snapshots.', true, 1, 'https://sportsgamer.gg/players/967'),
  ('ub-captain', 'UB Captain', 'LD', 8, 'Add the real player bio and image from the admin dashboard.', true, 2, null),
  ('ub-goalie', 'UB Goalie', 'G', 31, 'Goalie profile placeholder for roster layout and record calculations.', true, 3, null);

insert into achievements (title, body, display_order) values
  ('ECL Legacy', 'Unlucky Boys has competed across multiple SportsGamer eras under the Unlucky Boys, Unlucky Boys HC, and YMCA Esports names.', 1),
  ('Built for the Next Run', 'Use the admin dashboard to replace these starter paragraphs with the team history, tournament placements, and memorable playoff runs.', 2);

insert into player_season_stats (player_id, league, team_name, games_played, goals, assists, points, plus_minus, penalty_minutes)
select id, 'Sample Season', 'Unlucky Boys', 10, 6, 8, 14, 5, 4
from players where slug = 'anhel-kuru';

insert into player_season_stats (player_id, league, team_name, games_played, goals, assists, points, plus_minus, penalty_minutes)
select id, 'Sample Season', 'Unlucky Boys HC', 8, 2, 10, 12, 3, 6
from players where slug = 'ub-captain';

insert into goalie_season_stats (player_id, league, team_name, games_played, wins, losses, overtime_losses, saves, goals_against, save_percentage, goals_against_average, shutouts, penalty_minutes)
select id, 'Sample Season', 'YMCA Esports', 12, 8, 3, 1, 140, 24, 85.37, 2.00, 2, 0
from players where slug = 'ub-goalie';

insert into upcoming_games (opponent, competition, starts_at, sportsgamer_url) values
  ('Next Opponent', 'SportsGamer Tournament', now() + interval '7 days', 'https://sportsgamer.gg');
