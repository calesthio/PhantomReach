import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
const LOCAL_USER_EMAIL = "local@phantomreach.local";
const LOCAL_CREDITS = 999999;

function log(quiet, message) {
  if (!quiet) console.log(message);
}

function resolveDbPath(cwd) {
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    return process.env.DATABASE_URL.slice("file:".length);
  }

  return path.join(cwd, "data", "phantom-reach.db");
}

function ensureInstanceKey(cwd) {
  const keyDir = path.join(cwd, ".phantom-reach");
  const keyPath = path.join(keyDir, "instance.key");
  fs.mkdirSync(keyDir, { recursive: true });

  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, `${crypto.randomBytes(32).toString("hex")}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  const key = fs.readFileSync(keyPath, "utf8").trim();
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error(
      "Invalid .phantom-reach/instance.key. Delete it and re-enter saved API keys in Settings."
    );
  }

  return keyPath;
}

function initSchema(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      auth_user_id TEXT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      plan TEXT NOT NULL DEFAULT 'agency',
      stripe_customer_id TEXT,
      audit_credits_remaining INTEGER NOT NULL DEFAULT 999999,
      scout_credits_remaining INTEGER NOT NULL DEFAULT 999999,
      widget_api_key TEXT,
      white_label_config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      input TEXT NOT NULL,
      result TEXT,
      scores TEXT,
      pdf_storage_path TEXT,
      email_sent_at TEXT,
      expires_at TEXT,
      is_widget_generated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      credits_consumed INTEGER NOT NULL DEFAULT 1,
      stripe_metered_event_id TEXT,
      created_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS widget_leads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      visitor_email TEXT NOT NULL,
      visitor_name TEXT,
      business_audited TEXT NOT NULL,
      report_id TEXT,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_secrets (
      key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_tested_at TEXT,
      last_test_status TEXT,
      last_test_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_user_action_created ON api_usage(user_id, action, created_at);
    CREATE INDEX IF NOT EXISTS idx_widget_leads_user_id ON widget_leads(user_id);
  `);
}

function seedLocalWorkspace(sqlite) {
  const existing = sqlite.prepare("SELECT id FROM users WHERE id = ?").get(LOCAL_USER_ID);
  if (existing) return;

  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO users (
      id, auth_user_id, email, name, plan, stripe_customer_id,
      audit_credits_remaining, scout_credits_remaining, widget_api_key,
      white_label_config, created_at, updated_at
    ) VALUES (
      @id, NULL, @email, @name, 'agency', NULL,
      @audit_credits_remaining, @scout_credits_remaining, NULL,
      @white_label_config, @created_at, @updated_at
    )
  `).run({
    id: LOCAL_USER_ID,
    email: LOCAL_USER_EMAIL,
    name: "Local Workspace",
    audit_credits_remaining: LOCAL_CREDITS,
    scout_credits_remaining: LOCAL_CREDITS,
    white_label_config: "{}",
    created_at: now,
    updated_at: now,
  });
}

function ensureSqlite(cwd) {
  const dbPath = resolveDbPath(cwd);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma("journal_mode = WAL");
    initSchema(sqlite);
    seedLocalWorkspace(sqlite);
  } finally {
    sqlite.close();
  }
  return dbPath;
}

function removeNextCache(cwd) {
  const nextDir = path.resolve(cwd, ".next");
  const resolvedCwd = path.resolve(cwd);
  if (!nextDir.startsWith(resolvedCwd + path.sep)) {
    throw new Error(`Refusing to remove unexpected path: ${nextDir}`);
  }
  fs.rmSync(nextDir, { recursive: true, force: true });
}

export async function runPreflight(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const quiet = options.quiet === true;
  const cleanNext = options.cleanNext !== false;

  const keyPath = ensureInstanceKey(cwd);
  const dbPath = ensureSqlite(cwd);

  if (cleanNext) {
    removeNextCache(cwd);
  }

  log(quiet, "Phantom Reach local workspace is ready.");
  log(quiet, `Instance key: ${path.relative(cwd, keyPath)}`);
  log(quiet, `SQLite DB: ${path.relative(cwd, dbPath)}`);
  if (cleanNext) log(quiet, "Cleared stale Next.js dev assets.");

  return { keyPath, dbPath };
}

function parseCliArgs(argv) {
  return {
    cleanNext: !argv.includes("--keep-next"),
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  runPreflight(parseCliArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
