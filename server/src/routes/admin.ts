import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../lib/db.js";
import { badRequest } from "../lib/http.js";
import { slugify } from "../lib/slug.js";
import { createSession, destroySession, getAdminFromSession, requireAdmin } from "../middleware/session.js";
import { syncAllSportsGamerPlayers } from "../integrations/sportsgamer.js";

export const adminRoutes = new Hono();

const newsSchema = z.object({
  title: z.string().min(2),
  summary: z.string().min(2),
  body: z.string().min(2),
  coverImageUrl: z.string().min(1),
  publishedAt: z.string().datetime().optional().nullable()
});

const achievementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  displayOrder: z.number().int().min(0).default(0)
});

const playerSchema = z.object({
  name: z.string().min(2),
  nickname: z.string().optional().default(""),
  position: z.string().min(1),
  number: z.number().int().min(0).max(99),
  nationality: z.string().optional().default(""),
  captain: z.boolean().default(false),
  alternateCaptain: z.boolean().default(false),
  imageUrl: z.string().url().optional().or(z.literal("")),
  bio: z.string().optional().default(""),
  active: z.boolean().default(true),
  rosterOrder: z.number().int().min(0).default(0),
  sportsGamerUrl: z.string().url().optional().or(z.literal(""))
});

adminRoutes.post("/auth/login", async (c) => {
  const credentials = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await c.req.json());
  const result = await query<{ id: string; email: string; password_hash: string }>(
    "select id, email, password_hash from admins where email = $1",
    [credentials.email.toLowerCase()]
  );
  const admin = result.rows[0];
  if (!admin || !(await bcrypt.compare(credentials.password, admin.password_hash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  await createSession(c, admin.id);
  return c.json({ ok: true });
});

adminRoutes.post("/auth/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

adminRoutes.get("/auth/me", async (c) => {
  return c.json({ admin: await getAdminFromSession(c) });
});

adminRoutes.use("*", requireAdmin);

adminRoutes.post("/news", async (c) => {
  const payload = newsSchema.parse(await c.req.json());
  const slug = slugify(payload.title);
  const result = await query(
    `insert into news (slug, title, summary, body, cover_image_url, published_at)
     values ($1,$2,$3,$4,$5,$6)
     returning *`,
    [slug, payload.title, payload.summary, payload.body, payload.coverImageUrl, payload.publishedAt ?? new Date().toISOString()]
  );
  return c.json(result.rows[0], 201);
});

adminRoutes.put("/news/:slug", async (c) => {
  const payload = newsSchema.parse(await c.req.json());
  const result = await query(
    `update news
     set title=$2, summary=$3, body=$4, cover_image_url=$5, published_at=$6, updated_at=now()
     where slug=$1 returning *`,
    [c.req.param("slug"), payload.title, payload.summary, payload.body, payload.coverImageUrl, payload.publishedAt]
  );
  if (!result.rows[0]) badRequest("News article not found");
  return c.json(result.rows[0]);
});

adminRoutes.delete("/news/:slug", async (c) => {
  await query("delete from news where slug = $1", [c.req.param("slug")]);
  return c.json({ ok: true });
});

adminRoutes.post("/achievements", async (c) => {
  const payload = achievementSchema.parse(await c.req.json());
  const result = await query(
    `insert into achievements (title, body, display_order) values ($1,$2,$3) returning *`,
    [payload.title, payload.body, payload.displayOrder]
  );
  return c.json(result.rows[0], 201);
});

adminRoutes.put("/achievements/:id", async (c) => {
  const payload = achievementSchema.parse(await c.req.json());
  const result = await query(
    `update achievements set title=$2, body=$3, display_order=$4, updated_at=now() where id=$1 returning *`,
    [c.req.param("id"), payload.title, payload.body, payload.displayOrder]
  );
  if (!result.rows[0]) badRequest("Achievement not found");
  return c.json(result.rows[0]);
});

adminRoutes.delete("/achievements/:id", async (c) => {
  await query("delete from achievements where id = $1", [c.req.param("id")]);
  return c.json({ ok: true });
});

adminRoutes.post("/players", async (c) => {
  const payload = playerSchema.parse(await c.req.json());
  const result = await query(
    `insert into players
     (slug, name, nickname, position, jersey_number, nationality, captain, alternate_captain, image_url, bio, active, roster_order, sportsgamer_url)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [
      slugify(payload.name),
      payload.name,
      payload.nickname || null,
      payload.position,
      payload.number,
      payload.nationality || null,
      payload.captain,
      payload.alternateCaptain,
      payload.imageUrl || null,
      payload.bio,
      payload.active,
      payload.rosterOrder,
      payload.sportsGamerUrl || null
    ]
  );
  return c.json(result.rows[0], 201);
});

adminRoutes.put("/players/:slug", async (c) => {
  const payload = playerSchema.parse(await c.req.json());
  const result = await query(
    `update players
     set name=$2, nickname=$3, position=$4, jersey_number=$5, nationality=$6,
         captain=$7, alternate_captain=$8, image_url=$9, bio=$10, active=$11,
         roster_order=$12, sportsgamer_url=$13, updated_at=now()
     where slug=$1 returning *`,
    [
      c.req.param("slug"),
      payload.name,
      payload.nickname || null,
      payload.position,
      payload.number,
      payload.nationality || null,
      payload.captain,
      payload.alternateCaptain,
      payload.imageUrl || null,
      payload.bio,
      payload.active,
      payload.rosterOrder,
      payload.sportsGamerUrl || null
    ]
  );
  if (!result.rows[0]) badRequest("Player not found");
  return c.json(result.rows[0]);
});

adminRoutes.delete("/players/:slug", async (c) => {
  await query("update players set active = false where slug = $1", [c.req.param("slug")]);
  return c.json({ ok: true });
});

adminRoutes.post("/integrations/sportsgamer/sync", async (c) => {
  try {
    const result = await syncAllSportsGamerPlayers();
    return c.json(result);
  } catch (error) {
    await query("insert into sync_runs (source, status, message) values ('sportsgamer', 'failed', $1)", [
      error instanceof Error ? error.message : "Unknown sync failure"
    ]);
    return c.json({ error: "SportsGamer sync failed" }, 502);
  }
});
