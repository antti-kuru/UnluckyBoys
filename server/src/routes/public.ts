import { Hono } from "hono";
import { cacheJson } from "../lib/redis.js";
import { query } from "../lib/db.js";
import { notFound, parsePagination } from "../lib/http.js";

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
  const data = await cacheJson(`player-stats:${slug}`, 300, async () => {
    const player = await query<{ id: string }>("select id from players where slug = $1", [slug]);
    if (!player.rows[0]) notFound("Player not found");
    const skater = await query(
      `select league, team_name as "teamName", games_played as "gamesPlayed", goals, assists, points,
              plus_minus as "plusMinus", penalty_minutes as "penaltyMinutes"
       from player_season_stats where player_id = $1 order by league desc`,
      [player.rows[0].id]
    );
    const goalie = await query(
      `select league, team_name as "teamName", games_played as "gamesPlayed", wins, losses,
              overtime_losses as "overtimeLosses", saves, goals_against as "goalsAgainst",
              save_percentage as "savePercentage", goals_against_average as "goalsAgainstAverage",
              shutouts, penalty_minutes as "penaltyMinutes"
       from goalie_season_stats where player_id = $1 order by league desc`,
      [player.rows[0].id]
    );
    return { skater: skater.rows, goalie: goalie.rows };
  });
  return c.json(data);
});

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
      `with totals as (
        select p.name, p.slug,
               coalesce(sum(s.goals), 0) as goals,
               coalesce(sum(s.assists), 0) as assists,
               coalesce(sum(s.points), 0) as points,
               coalesce(sum(s.games_played), 0) as games_played,
               coalesce(sum(s.penalty_minutes), 0) as penalty_minutes,
               coalesce(sum(s.plus_minus), 0) as plus_minus
        from players p
        left join player_season_stats s on s.player_id = p.id
        group by p.id
      ), goalie_totals as (
        select p.name, p.slug, coalesce(sum(g.games_played), 0) as goalie_games_played
        from players p
        left join goalie_season_stats g on g.player_id = p.id
        group by p.id
      )
      select
        (select row_to_json(t) from totals t order by goals desc, name asc limit 1) as "goals",
        (select row_to_json(t) from totals t order by assists desc, name asc limit 1) as "assists",
        (select row_to_json(t) from totals t order by points desc, name asc limit 1) as "points",
        (select row_to_json(t) from totals t order by games_played desc, name asc limit 1) as "gamesPlayed",
        (select row_to_json(t) from totals t order by penalty_minutes desc, name asc limit 1) as "penaltyMinutes",
        (select row_to_json(t) from totals t order by plus_minus desc, name asc limit 1) as "plusMinus",
        (select row_to_json(g) from goalie_totals g order by goalie_games_played desc, name asc limit 1) as "goalieGamesPlayed"`
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
