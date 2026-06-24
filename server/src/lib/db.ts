import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { config } from "../config.js";

export type QueryResultRow = Record<string, unknown>;

export type QueryResult<T extends QueryResultRow = QueryResultRow> = {
  rows: T[];
  rowCount: number;
};

const databaseDirectory = path.dirname(config.SQLITE_PATH);
mkdirSync(databaseDirectory, { recursive: true });

export const db = new DatabaseSync(config.SQLITE_PATH);
db.exec("pragma foreign_keys = on");
db.exec("pragma journal_mode = wal");
db.exec("pragma busy_timeout = 5000");

function bindValue(value: unknown): SQLInputValue {
  if (value === undefined) return null;
  if (value === true) return 1;
  if (value === false) return 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || value === null) return value;
  if (value instanceof Uint8Array) return value;
  return JSON.stringify(value);
}

function normalizeSql(sql: string) {
  return sql
    .replace(/\$(\d+)/g, "?")
    .replace(/\bnow\(\)/gi, "datetime('now')")
    .replace(/datetime\('now'\)\s*\+\s*interval\s+'14 days'/gi, "datetime('now', '+14 days')")
    .replace(/datetime\('now'\)\s*-\s*interval\s+'(\d+)\s+days?'/gi, "datetime('now', '-$1 days')")
    .replace(/datetime\('now'\)\s*-\s*interval\s+'(\d+)\s+hours?'/gi, "datetime('now', '-$1 hours')")
    .replace(/datetime\('now'\)\s*\+\s*interval\s+'(\d+)\s+days?'/gi, "datetime('now', '+$1 days')")
    .replace(/datetime\('now'\)\s*\+\s*interval\s+'(\d+)\s+hours?'/gi, "datetime('now', '+$1 hours')");
}

function returnsRows(sql: string) {
  const normalized = sql.trim().toLowerCase();
  return normalized.startsWith("select") || normalized.startsWith("with") || normalized.startsWith("pragma") || /\breturning\b/i.test(sql);
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const sql = normalizeSql(text);
  const boundParams = params.map(bindValue);
  const statement = db.prepare(sql);

  if (returnsRows(sql)) {
    const rows = statement.all(...boundParams) as T[];
    return { rows, rowCount: rows.length };
  }

  const result = statement.run(...boundParams);
  return { rows: [], rowCount: Number(result.changes) };
}

export async function withTransaction<T>(callback: () => Promise<T>): Promise<T> {
  db.exec("begin");
  try {
    const value = await callback();
    db.exec("commit");
    return value;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

export function migrateDatabase() {
  db.exec(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at text not null default (datetime('now'))
    )
  `);

  const migrations = readdirSync(config.SQLITE_MIGRATIONS_DIR)
    .filter((file) => /^V\d+__.*\.sql$/.test(file))
    .sort();

  for (const file of migrations) {
    const applied = db.prepare("select version from schema_migrations where version = ?").get(file);
    if (applied) continue;

    const sql = readFileSync(path.join(config.SQLITE_MIGRATIONS_DIR, file), "utf8");
    db.exec("begin");
    try {
      db.exec(sql);
      db.prepare("insert into schema_migrations (version) values (?)").run(file);
      db.exec("commit");
      console.log(`Applied migration ${file}`);
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }
}

export function newId() {
  return randomUUID();
}
