import { Hono, type Context } from "hono";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../lib/db.js";
import { deleteCacheKeys } from "../lib/cache.js";
import { badRequest } from "../lib/http.js";
import { slugify } from "../lib/slug.js";
import { createSession, destroySession, getAdminFromSession, requireAdmin } from "../middleware/session.js";
import { syncAllSportsGamerPlayers } from "../integrations/sportsgamer.js";

export const adminRoutes = new Hono();

const loginAttempts = new Map<string, { attempts: number; resetAt: number }>();
const maxLoginAttempts = 8;
const loginWindowMs = 15 * 60 * 1000;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function cleanUrl(value: unknown) {
  const cleaned = cleanString(value);
  if (cleaned === "") return undefined;
  if (typeof cleaned !== "string") return cleaned;
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function booleanValue(value: unknown) {
  if (value === "true" || value === "on" || value === "1") return true;
  if (value === "false" || value === "off" || value === "0" || value === "" || value === undefined) return false;
  return value;
}

const requiredString = z.preprocess(cleanString, z.string().min(1));
const optionalUrl = z.preprocess(cleanUrl, z.string().url().optional());
const optionalString = z.preprocess((value) => {
  const cleaned = cleanString(value);
  return cleaned === "" ? undefined : cleaned;
}, z.string().optional());
const optionalText = z.preprocess((value) => {
  const cleaned = cleanString(value);
  return cleaned === "" ? undefined : cleaned;
}, z.string().default(""));

const newsSchema = z.object({
  title: requiredString,
  summary: requiredString,
  body: requiredString,
  coverImageUrl: requiredString,
  videoUrl: optionalUrl,
  publishedAt: z.string().datetime().optional().nullable()
});

const achievementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  displayOrder: z.coerce.number().int().min(0).default(0)
});

const playerImageSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/(?:brand|players)\/[a-zA-Z0-9._/-]+$/)
]);

const playerSchema = z.object({
  name: z.preprocess(cleanString, z.string().min(2)),
  nickname: optionalString.default(""),
  position: requiredString,
  number: z.coerce.number().int().min(0).max(99),
  nationality: optionalString.default(""),
  captain: z.preprocess(booleanValue, z.boolean().default(false)),
  alternateCaptain: z.preprocess(booleanValue, z.boolean().default(false)),
  imageUrl: z.preprocess((value) => {
    const cleaned = cleanString(value);
    return cleaned === "" ? undefined : cleaned;
  }, playerImageSchema.optional()),
  bio: optionalText,
  active: z.preprocess(booleanValue, z.boolean().default(true)),
  rosterOrder: z.coerce.number().int().min(0).default(0),
  sportsGamerUrl: optionalUrl
});

function clientAddress(c: Context) {
  return c.req.header("cf-connecting-ip")
    ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

function loginAttemptKey(c: Context, email: string) {
  return `${clientAddress(c)}:${email.toLowerCase()}`;
}

function isLoginThrottled(key: string) {
  const attempt = loginAttempts.get(key);
  if (!attempt) return false;
  if (attempt.resetAt <= Date.now()) {
    loginAttempts.delete(key);
    return false;
  }
  return attempt.attempts >= maxLoginAttempts;
}

function recordFailedLogin(key: string) {
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(key, { attempts: 1, resetAt: now + loginWindowMs });
    return;
  }
  attempt.attempts += 1;
}

adminRoutes.post("/auth/login", async (c) => {
  const credentials = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await c.req.json());
  const attemptKey = loginAttemptKey(c, credentials.email);

  if (isLoginThrottled(attemptKey)) {
    return c.json({ error: "Too many login attempts. Try again later." }, 429);
  }

  const result = await query<{ id: string; email: string; password_hash: string }>(
    "select id, email, password_hash from admins where email = $1",
    [credentials.email.toLowerCase()]
  );
  const admin = result.rows[0];
  if (!admin || !(await bcrypt.compare(credentials.password, admin.password_hash))) {
    recordFailedLogin(attemptKey);
    return c.json({ error: "Invalid email or password" }, 401);
  }
  loginAttempts.delete(attemptKey);
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

const uploadKinds = ["news", "players"] as const;
const imageExtensions: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
const maxImageBytes = 8 * 1024 * 1024;

adminRoutes.post("/uploads/:kind", async (c) => {
  const kind = c.req.param("kind");
  if (!uploadKinds.includes(kind as (typeof uploadKinds)[number])) {
    return c.json({ error: "Invalid upload category" }, 400);
  }

  const body = await c.req.parseBody();
  const image = body.image;
  if (!(image instanceof File)) return c.json({ error: "Select an image to upload" }, 400);

  const extension = imageExtensions[image.type];
  if (!extension) return c.json({ error: "Use a JPG, PNG, WebP, or GIF image" }, 400);
  if (image.size > maxImageBytes) return c.json({ error: "Image must be 8 MB or smaller" }, 400);

  const uploadDirectory = path.join(config.UPLOAD_ROOT, kind);
  const filename = `${randomUUID()}${extension}`;
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, filename), Buffer.from(await image.arrayBuffer()));

  return c.json({ url: `/${kind}/${filename}` }, 201);
});

adminRoutes.post("/news", async (c) => {
  const payload = newsSchema.parse(await c.req.json());
  const slug = slugify(payload.title);
  const result = await query(
    `insert into news (slug, title, summary, body, cover_image_url, video_url, published_at)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [
      slug,
      payload.title,
      payload.summary,
      payload.body,
      payload.coverImageUrl,
      payload.videoUrl || null,
      payload.publishedAt ?? new Date().toISOString()
    ]
  );
  return c.json(result.rows[0], 201);
});

adminRoutes.put("/news/:slug", async (c) => {
  const payload = newsSchema.parse(await c.req.json());
  const result = await query(
    `update news
     set title=$2, summary=$3, body=$4, cover_image_url=$5, video_url=$6, published_at=$7, updated_at=now()
     where slug=$1 returning *`,
    [
      c.req.param("slug"),
      payload.title,
      payload.summary,
      payload.body,
      payload.coverImageUrl,
      payload.videoUrl || null,
      payload.publishedAt
    ]
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
  const slug = c.req.param("slug");
  await query("delete from players where slug = $1", [slug]);
  await deleteCacheKeys(["records:all-time", `player-stats:${slug}`]);
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
