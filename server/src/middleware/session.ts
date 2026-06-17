import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import crypto from "node:crypto";
import { query } from "../lib/db.js";
import { config } from "../config.js";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
};

const cookieName = "ub_session";

function sign(value: string) {
  return crypto.createHmac("sha256", config.SESSION_SECRET).update(value).digest("base64url");
}

function encodeSession(id: string) {
  return `${id}.${sign(id)}`;
}

function decodeSession(value?: string) {
  if (!value) return null;
  const [id, signature] = value.split(".");
  if (!id || !signature) return null;
  const expected = sign(id);
  if (signature.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}

export async function createSession(c: Context, adminId: string) {
  const id = crypto.randomUUID();
  await query("insert into sessions (id, admin_id, expires_at) values ($1, $2, now() + interval '14 days')", [id, adminId]);
  setCookie(c, cookieName, encodeSession(id), {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function destroySession(c: Context) {
  const sessionId = decodeSession(getCookie(c, cookieName));
  if (sessionId) {
    await query("delete from sessions where id = $1", [sessionId]);
  }
  deleteCookie(c, cookieName, { path: "/" });
}

export async function getAdminFromSession(c: Context): Promise<AdminUser | null> {
  const sessionId = decodeSession(getCookie(c, cookieName));
  if (!sessionId) return null;
  const result = await query<AdminUser>(
    `select a.id, a.email, a.display_name as "displayName"
     from sessions s
     join admins a on a.id = s.admin_id
     where s.id = $1 and s.expires_at > now()`,
    [sessionId]
  );
  return result.rows[0] ?? null;
}

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const admin = await getAdminFromSession(c);
  if (!admin) {
    return c.json({ error: "Authentication required" }, 401);
  }
  await next();
};
