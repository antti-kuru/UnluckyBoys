import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { config } from "./config.js";
import { query } from "./lib/db.js";
import { publicRoutes } from "./routes/public.js";
import { adminRoutes } from "./routes/admin.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: config.CORS_ORIGIN, credentials: true }));

app.get("/api/health", (c) => c.json({ ok: true, service: "unlucky-boys-server" }));
app.route("/api", publicRoutes);
app.route("/api/admin", adminRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
  if (error instanceof ZodError) {
    return c.json({ error: "Validation failed", issues: error.issues }, 400);
  }
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

async function ensureDefaultAdmin() {
  const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);
  await query(
    `insert into admins (email, display_name, password_hash)
     values ($1, 'Team Admin', $2)
     on conflict (email) do nothing`,
    [config.ADMIN_EMAIL.toLowerCase(), passwordHash]
  );
}

ensureDefaultAdmin()
  .then(() => {
    serve({ fetch: app.fetch, port: config.PORT });
    console.log(`Unlucky Boys API listening on ${config.PORT}`);
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
