import { z } from "zod";

export const DEFAULT_ADMIN_EMAIL = "admin@unluckyboys.local";
export const DEFAULT_ADMIN_PASSWORD = "change-me-now";
export const DEFAULT_SESSION_SECRET = "change-this-session-secret-before-production";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().default(8000),
  SQLITE_PATH: z.string().default("/app/data/unlucky-boys.sqlite"),
  SQLITE_MIGRATIONS_DIR: z.string().default("/app/database-migrations"),
  SESSION_SECRET: z.string().min(32).default(DEFAULT_SESSION_SECRET),
  CORS_ORIGIN: z.string().default("http://localhost:8000"),
  SPORTSGAMER_BASE_URL: z.string().url().default("https://sportsgamer.gg"),
  UPLOAD_ROOT: z.string().default("/app/uploads"),
  TEAM_NAMES: z.string().default("Unlucky Boys,Unlucky Boys HC,YMCA Esports"),
  ADMIN_EMAIL: z.string().email().default(DEFAULT_ADMIN_EMAIL),
  ADMIN_PASSWORD: z.string().min(8).default(DEFAULT_ADMIN_PASSWORD)
});

export const config = envSchema.parse(process.env);

if (config.NODE_ENV === "production") {
  const missing: string[] = [];
  if (config.SESSION_SECRET === DEFAULT_SESSION_SECRET || config.SESSION_SECRET.startsWith("replace-with")) {
    missing.push("SESSION_SECRET");
  }
  if (config.ADMIN_EMAIL === DEFAULT_ADMIN_EMAIL || config.ADMIN_EMAIL.startsWith("change-this-")) {
    missing.push("ADMIN_EMAIL");
  }
  if (config.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD || config.ADMIN_PASSWORD.startsWith("replace-with")) {
    missing.push("ADMIN_PASSWORD");
  }

  if (missing.length > 0) {
    throw new Error(`Unsafe production defaults are still configured: ${missing.join(", ")}`);
  }
}

export const teamNames = config.TEAM_NAMES.split(",").map((name) => name.trim()).filter(Boolean);
