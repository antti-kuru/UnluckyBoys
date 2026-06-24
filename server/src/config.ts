import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().default(8000),
  SQLITE_PATH: z.string().default("/app/data/unlucky-boys.sqlite"),
  SQLITE_MIGRATIONS_DIR: z.string().default("/app/database-migrations"),
  SESSION_SECRET: z.string().min(32).default("change-this-session-secret-before-production"),
  CORS_ORIGIN: z.string().default("http://localhost:8000"),
  SPORTSGAMER_BASE_URL: z.string().url().default("https://sportsgamer.gg"),
  UPLOAD_ROOT: z.string().default("/app/uploads"),
  TEAM_NAMES: z.string().default("Unlucky Boys,Unlucky Boys HC,YMCA Esports"),
  ADMIN_EMAIL: z.string().email().default("admin@unluckyboys.local"),
  ADMIN_PASSWORD: z.string().min(8).default("change-me-now")
});

export const config = envSchema.parse(process.env);

export const teamNames = config.TEAM_NAMES.split(",").map((name) => name.trim()).filter(Boolean);
